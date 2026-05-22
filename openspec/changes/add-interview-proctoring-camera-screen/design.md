## Context

The existing interview platform captures audio via the Retell SDK (`RetellWebClient`) and stores transcripts server-side. No video or screen recording exists today. **Cloudflare R2** is used for proctoring object storage (this feature introduces R2 to the stack for the first time; the swap from Supabase Storage was made mid-apply for zero egress fees on recruiter playback and the 10 GB free tier — see "R2 storage swap" note below). The candidate-side call flow lives in `src/components/call/index.tsx`; the `webClient` singleton fires lifecycle events (`call_started`, `call_ended`, `error`) that we hook into for recorder management.

### R2 storage swap (mid-apply addendum)

Earlier sections of this document still reference Supabase Storage in places — read those references as "object storage layer" generically. The applied implementation uses Cloudflare R2:

- `src/lib/r2Client.ts` — lazy S3-compatible client (region `"auto"`, endpoint `https://<account_id>.r2.cloudflarestorage.com`)
- Chunk uploads via `@aws-sdk/client-s3` `PutObjectCommand`
- Listing via `ListObjectsV2Command`
- Signed URLs via `@aws-sdk/s3-request-presigner` `getSignedUrl(GetObjectCommand)`
- Env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=proctoring`
- Bucket setup steps in `supabase_schema.sql` "PROCTORING BUCKET SETUP (Cloudflare R2)" block
- Auth chain (session_token → response → org_id) and path layout (`<org>/<resp>/<stream>/<n>.webm`) are **unchanged** — only the storage backend client differs
- 90-day TTL applied via R2 object lifecycle rule (set via Cloudflare dashboard)

Recruiters review session data on the response detail page (`src/components/call/callInfo.tsx`). All candidate-facing API calls authenticate via a `session_token` stored on the `response` row — this is the existing, established auth mechanism for unauthenticated candidate flows.

## Goals / Non-Goals

**Goals:**

- Record camera and screen streams in ~10s chunks and upload them reliably even over flaky connections.
- Hard-gate on full-monitor screen share before the call starts; soft-flag all other proctoring failures.
- Give recruiters a review surface (video players + status flags) without exposing storage URLs publicly.
- Keep proctoring entirely optional via per-interview boolean toggles.
- Auto-expire recordings after 90 days via bucket lifecycle rules.

**Non-Goals:**

- Real-time monitoring or AI/ML analysis of any kind.
- Mobile browser support.
- Per-org or per-persona proctoring configuration.
- Re-recording the audio channel (Retell already handles audio).
- Automatic alerting on flags.

## Decisions

### 1. State machine before call start

The candidate-side flow follows a strict ordered gate:

```
idle
  → consent-step        (if proctoring_camera_enabled OR proctoring_screen_enabled)
  → camera-acquire      (if proctoring_camera_enabled; soft-fail on deny/unavailable)
  → screen-acquire      (if proctoring_screen_enabled; hard-fail on non-monitor surface)
  → register-call       (POST /api/register-call with consent_acknowledged_at)
  → call-active         (MediaRecorders start on call_started Retell event)
  → call-ended          (call_ended event fires; POST /api/proctoring/finalize)
  → done
```

Rationale: ordering consent before media acquisition ensures we never touch the camera or screen without explicit consent. The screen-share hard gate happens before `register-call` so we never create a response row for a session that cannot be fully proctored (when screen proctoring is enabled).

### 2. Screen-share hard gate: monitor only

`getDisplayMedia` returns a `MediaStreamTrack` with `getSettings().displaySurface` values: `"monitor"`, `"window"`, `"browser"`. We only accept `"monitor"`. If the user selects a window or tab, we show `ScreenShareGate` with a "Please share your full screen" prompt and call `getDisplayMedia` again.

If `getDisplayMedia` itself is not available (browser unsupported), we set `screen_share_type = "unsupported"` and proceed — soft-flag only.

Alternatives considered: Accept any surface type and flag non-monitor shares. Rejected because window shares trivially allow hiding AI tools off-screen.

### 3. Visibility-change suppression during screen-share picker

The existing call component increments `tab_switch_count` on `visibilitychange`. Opening the `getDisplayMedia` picker fires `visibilitychange` → `hidden`. To avoid a false positive we extend `useTabSwitchPrevention` to accept an `isSuppressionActive` ref (or param). When suppression is active, the hook does NOT increment `tabSwitchCount` and does NOT show the warning.

The Call component sets this ref to `true` immediately before `getDisplayMedia` is called and clears it inside a `setTimeout(..., 0)` dispatched from the `.then()` / `.catch()` handlers. The deferred clear ensures the flag is still `true` when the picker-close `visibilitychange` event fires synchronously during promise resolution, and is only released after the browser event loop has processed it.

### 4. MediaRecorder lifecycle tied to Retell events

`MediaRecorder` instances live in `useRef`s within the Call component. They are created and `start()`-ed inside the `call_started` event handler. `stop()` is called inside `call_ended`. This ensures:
- We don't record anything before Retell confirms the call is live.
- Chunk uploads are flushed before we call finalize.

`timeslice` is set to `10_000` ms so `ondataavailable` fires every ~10 seconds with a Blob chunk.

`useMediaRecorder` maintains an internal `Set<Promise<void>>` of in-flight chunk POSTs (`pendingUploads`). The `stop()` method calls `mediaRecorder.stop()`, then awaits `Promise.allSettled(Array.from(pendingUploads))` before resolving — ensuring all in-flight uploads complete before finalize is invoked. A 30-second hard timeout wraps `Promise.allSettled` so a stuck upload does not block call-end UI indefinitely.

**MediaRecorder codec**: `mimeType: 'video/webm;codecs=vp8'` with fallback to `'video/webm'` if `MediaRecorder.isTypeSupported('video/webm;codecs=vp8')` returns `false`. `videoBitsPerSecond: 500_000` is set in all cases.

### 5. Chunked upload protocol

**Chunk route** (`POST /api/proctoring/chunk`):
```
Headers: Authorization: Bearer <session_token>
Body (multipart/form-data):
  stream: "camera" | "screen"
  chunk_index: number (0-based)
  data: Blob (.webm)
```

Server derives `response_id` and `organization_id` from `session_token` (never trusted from client). Writes to `<org_id>/<response_id>/<stream>/<chunk_index>.webm`.

**Finalize route** (`POST /api/proctoring/finalize`):
```
Headers: Authorization: Bearer <session_token>
Body: { streams: ["camera", "screen"] }
```

Server: lists all chunk objects for each stream, sorts them in **numeric** order (`parseInt(name.replace(/\.webm$/, ''), 10)` — alphabetic sort would mis-order chunk 10 before chunk 2), and writes a manifest JSON file:

```json
{
  "stream": "camera",
  "chunks": [
    {"index": 0, "path": "<org>/<response_id>/camera/0.webm"},
    {"index": 1, "path": "<org>/<response_id>/camera/1.webm"}
  ],
  "mimeType": "video/webm;codecs=vp8",
  "createdAt": "<ISO 8601>"
}
```

Manifest is written at `<org_id>/<response_id>/{camera,screen}.manifest.json`. `response.camera_storage_path` and `response.screen_storage_path` are set to the manifest paths (not a final `.webm`). Chunks are NOT deleted — they are the playable artifacts.

This approach is deliberately lightweight: the finalize route performs only a Storage list + single JSON write, completing in ~2 seconds and comfortably fitting Vercel Hobby's 10-second function timeout.

**If a chunk POST fails mid-call**: the client retries up to 3 times with exponential backoff. If still failing, it logs the chunk as lost and continues recording (the video will have a gap). POSTing the same `chunk_index` twice is idempotent: Supabase Storage overwrites the existing object, and `MediaRecorder` emits each chunk exactly once via `ondataavailable`, so retried uploads always contain identical bytes. A future enhancement could buffer to IndexedDB but is out of scope now.

### 6. Auth model: session_token bearer

All three proctoring routes authenticate via `Authorization: Bearer <session_token>`. The server performs:
```
response = supabase.from("response").select("id, interview_id").eq("session_token", token).single()
interview = supabase.from("interview").select("organization_id").eq("id", response.interview_id).single()
org_id = interview.organization_id
```

Rationale: `session_token` is already the established pattern for candidate-side API calls (e.g., heartbeat, register-call). It is a server-generated unguessable token. No new auth mechanism required.

Service-role key is used server-side for all Storage operations to avoid complex Storage RLS rules. Storage bucket is private; no public URLs are ever issued.

### 7. Signed URL delivery for recruiter review

`GET /api/proctoring/signed-url` is a Clerk-authenticated route (recruiter only). The route follows the existing ownership check pattern (e.g., `src/app/api/interviews/[id]/invites/route.ts`): after loading the response row, it verifies `interview.user_id === auth().userId` and returns `403` on mismatch. Clerk Organizations are not used in this app.

Two calling modes:
- `?response_id=<id>&stream=camera|screen` — returns a signed URL for the manifest JSON at `camera_storage_path` / `screen_storage_path`.
- `?response_id=<id>&stream=camera|screen&chunk_index=<N>` — returns a signed URL for the specific chunk at `<org>/<response_id>/<stream>/<N>.webm`.

The recruiter player on `callInfo.tsx` reads the manifest first (manifest-URL variant), then fetches per-chunk signed URLs (chunk-index variant) to feed into MediaSource Extensions.

Signed URLs expire in 1 hour, preventing link sharing.

### 8. Storage layout and 90-day TTL

```
proctoring/
  <org_id>/
    <response_id>/
      camera/
        0.webm
        1.webm
        ...
      screen/
        0.webm
        ...
      camera.manifest.json    ← written by finalize
      screen.manifest.json    ← written by finalize
```

`response.camera_storage_path` and `response.screen_storage_path` point to the manifest paths. Chunk files are retained and are the playable artifacts.

TTL: configure a lifecycle rule (Supabase dashboard) to expire ALL objects under the `proctoring` bucket after 90 days — this applies to both chunks and manifests. Document the manual step required. See the `supabase_schema.sql` comment block for exact steps.

### 9. Recruiter player: MSE-based chunk stitching

Because `response.camera_storage_path` / `response.screen_storage_path` now point to manifest JSON files rather than a single `.webm`, the recruiter player must reassemble chunks client-side.

**Primary approach (MSE)**: The player fetches the manifest via the signed-URL route (manifest-URL variant), then for each chunk in order fetches a signed URL (chunk-index variant) and appends the `ArrayBuffer` to a `MediaSource.SourceBuffer`. This gives seamless playback in a single `<video>` element.

**Fallback (sequential `<video>` elements)**: For MVP, if MSE implementation proves too complex, an acceptable fallback is to render one `<video>` element per chunk in order, advancing to the next on the `ended` event. This produces visible seams between chunks but avoids MSE complexity.

Document both options; **MSE is the primary approach**. Implement whichever is delivered during the apply phase; document the choice in a code comment.

### 10. Camera PIP (self-view) and CameraStatusChip

`CameraPip` renders a small `<video>` element in the bottom-right corner during the call (fixed position, bottom-right, appropriate z-index), mirrored (CSS `transform: scaleX(-1)`), muted, autoplay. It receives the `MediaStream` from the camera acquisition step as a prop. This reassures the candidate that the camera is active. A REC dot indicator is shown on the PIP while recording is active.

When `camera_status === "denied"` or `"unavailable"`, a `CameraStatusChip` (alternatively an inline conditional in `CameraPip.tsx`) renders in the same bottom-right position with the label "Camera unavailable — continuing without video". Use `tone="neutral"` if the chip system supports tones; otherwise `bg-stone-100 text-stone-600 border`. When `camera_status === "granted"`, the actual PIP is rendered instead.

### 11. Per-interview toggles

`proctoring_camera_enabled` and `proctoring_screen_enabled` default to `false` on the `interview` table. The recruiter can toggle them in the edit interview panel (`editInterview.tsx`) and the create-interview modal (`details.tsx`). No proctoring UI or recording logic is activated for the candidate unless at least one is `true`.

Both toggles are grouped under a new "Proctoring" `FieldLabel`-headed card in `editInterview.tsx`, placed alongside (or below) the existing "Candidate identity" card. Camera toggle helper text: "Record a camera feed of the candidate for the duration of the session. Candidates must consent before starting." Screen toggle helper text: "Record the candidate's full screen during the session. Only a full-screen share is accepted — windows or tabs are rejected. Candidates must consent before starting." In `details.tsx` (create modal), the toggles are added to the final step (Questions) or wherever existing access-control switches live — matching the existing pattern verbatim. `<Switch id="..."/>` is always paired with `<label htmlFor="..."/>` for accessibility.

## UX & Copy (Locked)

These decisions are frozen as of plan_design_review. Do NOT re-litigate them during apply.

### Consent Step

**Component**: `ConsentStep` rendered inside `CandidateFrame` as a dedicated step in the multi-step pre-call flow. Set `progressPercent` to an appropriate value for this step's position in the sequence.

**Full-modality copy (both camera and screen enabled)**:
> "This interview includes recording. With your permission, we'll capture your camera feed and a view of your screen during the session. Recordings are reviewed only by the hiring team and are automatically deleted after 90 days."

**Single-modality copy variants**:
- Camera only: replace "your camera feed and a view of your screen" with "your camera feed"
- Screen only: replace "your camera feed and a view of your screen" with "a view of your screen"

**Per-modality disclosure**: Use `NoteCard` with `tone="soft"` — one card per enabled recording surface (Camera / Screen), so the candidate sees a bullet for each recorded artifact.

**Checkbox label**: "I understand this session will be recorded and agree to proceed."

**Continue button**: "Continue" — disabled until checkbox is checked.

**Decline button**: A secondary "I don't consent" button at the bottom of the consent step. Clicking it routes to the decline `StatusPanel` (no session created).

### Decline / Exit Paths

**Consent decline `StatusPanel` message**:
> "This interview requires proctoring. Please contact the hiring team if you need an alternative."

Include a `mailto:` link if `interview.organization.support_email` is set; omit the link if not. No response row is created on decline.

**Screen-share gate exit**: After the FIRST failed attempt (displaySurface !== "monitor", or picker dismissed), render a "Can't share your screen? Exit the interview" link below the retry button. Clicking it routes to a `StatusPanel`:
> "Interview not started. Screen sharing is required for this interview. Please contact the hiring team if you need an alternative."

**Response row on decline**: Do NOT create a response row on consent decline or screen-share exit. Show the `StatusPanel` without creating a session. (Rationale: avoids orphaned response rows with no meaningful data. Document this choice in code comments in `ConsentStep.tsx` and `ScreenShareGate.tsx`.)

### RevocationBanner

**Component signature**: `RevocationBanner({ revokedStreams: ("camera" | "screen")[] })`

**Wraps**: `Banner` primitive with `tone="warning"`. Non-dismissible. Persists until call end.

**Position**: Top of `ActiveSessionView` (above the Retell widget).

**Copy variants**:
- Camera only (`revokedStreams === ["camera"]`): "Your camera was stopped. The interview is still in progress — the hiring team has been notified."
- Screen only (`revokedStreams === ["screen"]`): "Your screen share was stopped. The interview is still in progress — the hiring team has been notified."
- Both (`revokedStreams.length === 2`): "Your camera and screen share were stopped. The interview is still in progress — the hiring team has been notified."

### CameraStatusChip

Renders in the same fixed bottom-right position as `CameraPip` when `camera_status === "denied"` or `"unavailable"`.

**Label**: "Camera unavailable — continuing without video"

**Style**: `tone="neutral"` if supported; otherwise `bg-stone-100 text-stone-600 border`.

**Implementation**: Either a dedicated `CameraStatusChip` component or an inline conditional render inside `CameraPip.tsx`.

### Recruiter Section — callInfo.tsx

**Placement**: Top of `callInfo.tsx`, before the score gauge and existing analytics sections.

**Layout**: Stacked — screen video player on top (landscape-wide), camera video player below (portrait/4:3).

**Status chips** (colored):
- Green: `camera_status === "granted"`, `screen_share_type === "monitor"`, `proctoring_interrupted === false`
- Amber: `camera_status === "unavailable"`, `screen_share_type === "unsupported"`
- Red: `camera_status === "denied"`, `proctoring_interrupted === true`

**Consent timestamp**: Render `consent_acknowledged_at` as human-readable, e.g. "Consent given at 2:34 PM, May 22, 2026".

**Loading state**: `Skeleton` placeholders at video player dimensions while manifest fetches and `SourceBuffer` fills.

**Error state**: Per-chunk 404 → inline `Banner tone="warning"` under the affected player: "Some segments couldn't be loaded. Playback may be incomplete."

**Empty states**:
- `proctoring_*_enabled === true` but storage path is null: "Recording not available. The session ended before the recording could be saved. Camera status: [chip]."
- `proctoring_*_enabled === false`: do NOT render the Proctoring section at all.
- Consent was declined (no response row / proctoring_declined status): "The candidate declined proctoring consent. No recording was made."

### Design System Primitive Audit

All primitives referenced in this design were confirmed to exist in the codebase at time of plan_design_review:

| Primitive | Location | Status |
|---|---|---|
| `CandidateFrame` | `src/components/call/index.tsx` (local) | Confirmed |
| `NoteCard` | `src/components/call/index.tsx` (local) | Confirmed |
| `StatusPanel` | `src/components/call/index.tsx` (local) | Confirmed |
| `Banner` | `src/components/ui/banner.tsx` | Confirmed |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Confirmed |
| `Switch` | `src/components/ui/switch.tsx` | Confirmed |
| `FieldLabel` | `src/components/dashboard/interview/editInterview.tsx` (local) | Confirmed |

No new design-system primitives need to be created. All new components (`RevocationBanner`, `CameraStatusChip`) wrap or extend existing ones.

## Out of scope for v1.0 / Deferred to v1.1

- **Anonymous-mode + proctoring conflict warning UI**: When anonymous mode is enabled alongside proctoring, there is a UX tension (candidate identity is hidden but camera is recorded). A conflict warning or mutual-exclusion UI is deferred to v1.1.
- **Custom video-player controls**: Use browser-native `<video>` controls for v1.0. Custom scrubbing, playback speed, or chapter markers are v1.1.
- **Camera PIP drag-to-reposition**: PIP is fixed to the bottom-right corner for v1.0. Drag-to-reposition is deferred to v1.1.

## Risks / Trade-offs

**[Risk] MSE playback fails in some browsers** → Mitigation: the sequential `<video>` fallback (section 9) is acceptable for MVP. Detect MSE support via `'MediaSource' in window` at runtime.

**[Risk] getDisplayMedia picker opens slowly and candidate appears to "tab switch"** → Mitigation: `isRequestingScreenShare` flag suppresses tab-switch increment (see Decision 3).

**[Risk] createResponse returns null and we have no response_id before starting the recorder** → Mitigation: MediaRecorder start is deferred to the `call_started` event, which fires after register-call resolves. If `createResponse` returned null, the Call component already handles the error state and does not proceed to start the call.

**[Risk] Finalize fails (network error after call ends)** → Mitigation: Client retries finalize POST up to 3 times. If all retries fail, chunk files remain in Storage (not deleted); a background job or manual admin action can re-run finalize later. Chunk paths are predictable from `<org_id>/<response_id>/<stream>/<n>.webm`.

**[Risk] Supabase Storage not yet set up in this repo** → Mitigation: bucket creation is documented as a manual step (see `supabase_schema.sql` comment block) and a checklist item in tasks.md.

**[Risk] 90-day TTL requires Supabase lifecycle configuration** → Mitigation: Supabase bucket lifecycle rules are configured in the Supabase dashboard (not in code). This is documented as a required manual step in the migration plan.

**[Risk] Stop race — finalize called before last chunk uploads complete** → Mitigation: `useMediaRecorder.stop()` awaits `Promise.allSettled(Array.from(pendingUploads))` with a 30-second hard timeout before resolving; finalize is only invoked after `stop()` resolves.

**[Stream cleanup]** `ScreenShareGate.tsx` and the camera-acquisition logic in `Call` must call `stream.getTracks().forEach(t => t.stop())` in `useEffect` cleanup (unmount) for any locally-held stream not yet handed to `MediaRecorder`. On `displaySurface` validation failure, `stream.getTracks().forEach(t => t.stop())` must be called BEFORE re-prompting (otherwise the rejected stream leaks an active track).

## Known Limitations

- **Chunk route is unauthenticated beyond session_token** — the `/api/proctoring/chunk` route validates the bearer `session_token` but has no rate-limiting. If abuse is observed post-launch, add Vercel edge middleware rate-limiting. Not a blocker for MVP.
- **Finalize is manifest-only** — no single-file `.webm` is ever produced server-side. Recruiter player must support MSE or the sequential fallback. Browsers without `MediaSource` (rare on desktop) will fall back to sequential `<video>` elements.
- **Deployment tier** — Vercel Hobby (10s function timeout). The manifest-based finalize approach was chosen specifically to fit within this constraint. Finalize upper-bound is ~2 seconds (Storage list + single JSON write).

## Migration Plan

1. **Database migration** (run via Supabase SQL editor or migration tooling):
   - Add columns to `interview` and `response` tables as specified in the locked schema.

2. **Supabase Storage setup** (manual step in Supabase dashboard):
   - Create private bucket named `proctoring`.
   - Set allowed MIME types to `video/webm`.
   - Configure lifecycle rule: expire objects after 90 days.

3. **Deploy code** (standard Next.js deployment):
   - New API routes, new components, modified existing components.
   - No feature flag needed — per-interview toggles default to `false`.

4. **Rollback**:
   - New columns are nullable / have safe defaults; removing the UI is sufficient to disable the feature.
   - Storage bucket can be emptied and deleted independently.

## Open Questions

- Should chunks be stored in IndexedDB as a fallback for offline resilience? (Deferred — out of scope for v1.)
- Should a dedicated `finalize` background job be added for recovery when the finalize POST fails entirely? Chunk files are never deleted so re-running finalize is safe and chunks remain discoverable at predictable paths.
