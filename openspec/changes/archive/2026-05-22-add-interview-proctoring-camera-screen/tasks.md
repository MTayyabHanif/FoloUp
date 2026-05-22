## 1. Database Schema Migration

- [x] 1.1 Add `proctoring_camera_enabled boolean NOT NULL DEFAULT false` and `proctoring_screen_enabled boolean NOT NULL DEFAULT false` columns to the `interview` table in `supabase_schema.sql`
- [x] 1.2 Add `consent_acknowledged_at timestamptz`, `camera_status text`, `screen_share_type text`, `proctoring_interrupted boolean NOT NULL DEFAULT false`, `camera_storage_path text`, and `screen_storage_path text` columns to the `response` table in `supabase_schema.sql`
- [ ] 1.3 Run the migration in the Supabase SQL editor (or migration tool) against the target environment — **DEFERRED: user runs ALTER TABLE statements from the `PROCTORING BUCKET SETUP` block in supabase_schema.sql**

## 2. Object Storage Setup (Cloudflare R2)

**ARCHITECTURE CHANGE during apply:** Originally specified as Supabase Storage. Switched to Cloudflare R2 mid-apply (operator decision) for zero egress fees on recruiter playback and the 10 GB free tier. All routes refactored to use the AWS S3 SDK targeting the R2 endpoint. The session_token auth chain and path layout are unchanged — only the storage backend client differs.

- [ ] 2.1 Create private R2 bucket named `proctoring` in Cloudflare dashboard — **DEFERRED: user follows steps in `supabase_schema.sql` "PROCTORING BUCKET SETUP (Cloudflare R2)" block**
- [ ] 2.2 Configure 90-day lifecycle rule on the `proctoring` bucket — **DEFERRED: user configures in Cloudflare dashboard**
- [x] 2.3 Add R2 env vars to `.env.example` (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)
- [x] 2.4 Install AWS S3 SDK deps (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- [x] 2.5 Create `src/lib/r2Client.ts` (lazy singleton S3 client targeting R2 endpoint)

## 3. TypeScript Types

- [x] 3.1 Update `src/types/database.types.ts` — added six new `response` columns and two new `interview` columns to Row/Insert/Update
- [x] 3.2 Update `src/types/interview.ts` — added `proctoring_camera_enabled` and `proctoring_screen_enabled` to `InterviewBase`
- [x] 3.3 Update `src/types/response.ts` — added all six new proctoring columns to the `Response` type
- [x] 3.4 Update `CreateEmptyInterviewData()` in `src/components/dashboard/interview/createInterviewModal.tsx` to initialize the new fields (both `false`)

## 4. API Route — Chunk Upload

- [x] 4.1 Created `src/app/api/proctoring/chunk/route.ts` — POST handler accepting multipart/form-data (`stream`, `chunk_index`, `data`)
- [x] 4.2 session_token auth via `Authorization: Bearer <token>`, looks up response → interview → organization_id, returns 401 on failure (see `src/lib/proctoringAuth.ts`)
- [x] 4.3 Chunks uploaded to R2 via `PutObjectCommand` at `<org_id>/<response_id>/<stream>/<chunk_index>.webm`
- [x] 4.4 Returns `{ ok: true }` on success; structured error responses on failure

## 5. API Route — Finalize

- [x] 5.1 Created `src/app/api/proctoring/finalize/route.ts` — POST handler accepting `{ streams: string[] }`
- [x] 5.2 Same session_token auth as chunk route
- [x] 5.3 Lists chunks via `ListObjectsV2Command`, sorts numerically with `parseInt(name.replace(/\.webm$/, ''), 10)` (NOT lexicographic — explicitly noted in code comment)
- [x] 5.4 Manifest JSON written to `<org_id>/<response_id>/<stream>.manifest.json` via `PutObjectCommand`; chunks NOT deleted
- [x] 5.5 Updates `response.camera_storage_path` and/or `screen_storage_path` to the manifest paths
- [x] 5.6 Returns `{ ok: true, paths }`
- [x] 5.7 Code comment documents the route runs in ~2s and fits Vercel Hobby's 10s limit

## 6. API Route — Signed URL

- [x] 6.1 Created `src/app/api/proctoring/signed-url/route.ts` — GET handler accepting `?response_id=&stream=` and optional `&chunk_index=`
- [x] 6.2 Clerk-protected (returns 401 if no userId)
- [x] 6.3 Org-ownership check via `interview.user_id === auth().userId` (matches the existing invites pattern); returns 403 on mismatch
- [x] 6.4 No chunk_index → uses manifest path from response; calls `getSignedUrl` with `GetObjectCommand` (1h TTL)
- [x] 6.5 chunk_index present → constructs chunk path `<org_id>/<response_id>/<stream>/<chunk_index>.webm` and signs

## 7. Modified API Routes

- [x] 7.1 Consent acknowledgment threaded through the client's `createResponse` call (the response row is created client-side via `useResponses` context — not in register-call, which only mints the Retell webcall). Documented in code comment.
- [x] 7.2 Updated `src/app/api/response-heartbeat/route.ts` to accept optional `proctoring_interrupted` (boolean) and `camera_status` (string) in PATCH body

## 8. Recorder Hook

- [x] 8.1 Created `src/components/call/proctoring/useMediaRecorder.ts` — hook accepting stream, streamType, sessionToken, enabled
- [x] 8.2 MediaRecorder initialized with `mimeType: 'video/webm;codecs=vp8'` (fallback to `'video/webm'` if not supported), `videoBitsPerSecond: 500_000`, `timeslice: 10_000`
- [x] 8.3 Internal `Set<Promise<void>>` (`pendingUploads`) tracks in-flight chunk POSTs; each POST removed on `.finally`
- [x] 8.4 Exponential-backoff retry (3 attempts, 250/750/1750 ms)
- [x] 8.5 `stop()` awaits the MediaRecorder's `onstop` event, then `Promise.race([Promise.allSettled(pendingUploads), timeout(30_000)])`
- [x] 8.6 `isInterrupted` state flips true on any `MediaStreamTrack.ended` event

## 9. Consent Step Component

- [x] 9.1 Created `src/components/call/proctoring/ConsentStep.tsx` — renders consent body, `NoteCard` per enabled modality (via `renderNoteCard` injection from parent so the styled component is shared), checkbox, Continue + decline buttons. Designed to be wrapped in parent's `<CandidateFrame />`.
- [x] 9.2 Locked copy: full-modality when both camera + screen are enabled; single-modality variants when only one is enabled
- [x] 9.3 Continue button disabled until checkbox is checked
- [x] 9.4 onConsent callback receives ISO timestamp; parent advances to next gate
- [x] 9.5 "I don't consent" button calls `onDecline`; parent renders StatusPanel ("This interview requires proctoring") without creating a response row (documented in component header comment)

## 10. Screen-Share Gate Component

- [x] 10.1 Created `src/components/call/proctoring/ScreenShareGate.tsx`
- [x] 10.2 Inspects `track.getSettings().displaySurface`; only `"monitor"` is accepted
- [x] 10.3 On non-monitor: `stream.getTracks().forEach(t => t.stop())` BEFORE re-prompting
- [x] 10.4 Unsupported browsers → calls `onResolved({ kind: "unsupported" })` (soft-flag)
- [x] 10.5 `useEffect` cleanup stops any locally-held stream on unmount
- [x] 10.6 After first failed attempt, renders "Can't share your screen? Exit the interview" link; on click calls `onResolved({ kind: "exit" })`; parent renders StatusPanel without creating a response row (documented in code comment)

## 11. Camera PIP Component

- [x] 11.1 Created `src/components/call/proctoring/CameraPip.tsx` — small `<video>`, muted, autoplay, mirrored via `scaleX(-1)`, fixed bottom-right, z-40
- [x] 11.2 Accepts `stream` and `cameraStatus` props; assigns srcObject via useEffect
- [x] 11.3 When granted: renders the PIP with a red REC dot indicator
- [x] 11.4 When denied/unavailable: renders inline chip "Camera unavailable — continuing without video" in the same position (single-component approach — documented in code comment)

## 12. Revocation Banner Component

- [x] 12.1 Created `src/components/call/proctoring/RevocationBanner.tsx` with signature `({ revokedStreams: ("camera" | "screen")[] })`. Renders null when empty.
- [x] 12.2 Implements all three copy variants (camera-only, screen-only, both)
- [x] 12.3 Rendered above ActiveSessionView by the parent. Non-dismissible.

## 13. Call Component Integration

- [x] 13.1 Added gate sequence in `src/components/call/index.tsx`: ConsentStep → camera acquire → ScreenShareGate → PreflightView. Skipped entirely when both proctoring toggles are false.
- [x] 13.2 Extended `useTabSwitchPrevention` in `src/components/call/tabSwitchPrevention.tsx` to accept an `isSuppressionActive: MutableRefObject<boolean>` param. When active, increment + warning dialog are suppressed. Call component sets the ref before `getDisplayMedia` and clears it inside `setTimeout(...,0)` from the picker's then/catch.
- [x] 13.2a `useEffect` cleanup in `Call` stops any locally-held camera/screen streams on unmount.
- [x] 13.3 Recorders started in an effect watching `isCalling && activeSessionToken`, gated by `proctoring_*_enabled`
- [x] 13.4 Recorders stopped + `/api/proctoring/finalize` POSTed in an effect watching `isEnded && activeSessionToken`
- [x] 13.5 Track-ended handlers wire revokedStreams + proctoring_interrupted; heartbeat PATCH on isEnded includes `proctoring_interrupted` and `camera_status`
- [x] 13.6 `session_token` (from `activeSessionToken`) passed to recorder hooks and finalize POST
- [x] 13.7 `<CameraPip />` rendered when proctoring_camera_enabled && started; `<RevocationBanner />` rendered above ActiveSessionView when revokedStreams is non-empty

## 14. Recruiter Interview Settings UI

- [x] 14.1 Updated `src/components/dashboard/interview/editInterview.tsx` — added a "Proctoring" `FieldLabel`-headed card alongside the existing "Candidate identity" card. Both `<Switch>` controls paired with `<label htmlFor="...">` for accessibility. Helper copy matches design.md.
- [x] 14.2 Updated `src/components/dashboard/interview/create-popup/details.tsx` — added the two toggles in step 0 (Basics) below the Anonymous toggle. Same `<label htmlFor>` pattern.
- [x] 14.3 Toggles read from / write to the interview record via the existing `setInterviewData` / `InterviewService.updateInterview` patterns (spread payload — service is field-agnostic)

## 15. Recruiter Response Detail Review Surface

- [x] 15.1 Updated `src/components/call/callInfo.tsx` to render `<ProctoringReview />` at the top of the page (before the score gauge) when either toggle is enabled and a response_id is available
- [x] 15.2 Stacked layout: screen player on top, camera player below. Skeleton placeholders rendered while manifest fetches.
- [x] 15.3 Fetches manifest signed URL from `/api/proctoring/signed-url?response_id=X&stream=<s>`
- [x] 15.4 Sequential chunk playback (one `<video>` per chunk, advance on `ended`). MSE-based unified playback deferred to v1.1 — sequential is the documented fallback approach.
- [x] 15.5 Per-chunk 404 (or video element error) skips to next chunk and surfaces the "Some segments couldn't be loaded" warning banner
- [x] 15.6 Status chips (camera_status, screen_share_type, proctoring_interrupted) with color tone mapping (green/amber/red/neutral). `consent_acknowledged_at` formatted via `toLocaleString`.
- [x] 15.7 Empty state: "Recording not available..." when proctoring was enabled but storage path is null

## 16. Primitive Existence Verification (pre-apply)

- [x] 16.pre.1 `CandidateFrame` present in `src/components/call/index.tsx` — verified during apply
- [x] 16.pre.2 `NoteCard` (tone="soft") present — verified
- [x] 16.pre.3 `StatusPanel` present — verified (used inline for decline/screen-share-exit views)
- [x] 16.pre.4 `Banner` not used directly — `RevocationBanner` builds its own warning banner using existing styling tokens (matches the `Banner` look but avoids cross-component import for the bottom-of-stack layering required)
- [x] 16.pre.5 `Skeleton` present at `src/components/ui/skeleton.tsx` — used in `ProctoringReview`
- [x] 16.pre.6 `Switch` present at `src/components/ui/switch.tsx` — used in editInterview + details
- [x] 16.pre.7 `FieldLabel` local component present in `editInterview.tsx` — reused for the new Proctoring card

## 16. Manual QA Checklist — DEFERRED (requires live R2 + Supabase + browser)

- [ ] 16.1 Verify consent step appears when either toggle is on; does not appear when both off
- [ ] 16.2 Camera soft-fail (deny → continue, camera_status="denied")
- [ ] 16.3 Screen-share hard gate (window → re-prompt; monitor → pass)
- [ ] 16.4 `screen_share_type="unsupported"` on browser without `getDisplayMedia`
- [ ] 16.5 Tab-switch count NOT incremented when screen-share picker opens
- [ ] 16.6 Chunks appear in R2 during the call
- [ ] 16.7 Manifest .json files written on call end; chunks NOT deleted; response paths updated
- [ ] 16.8 Mid-call revoke → `proctoring_interrupted = true`, RevocationBanner appears
- [ ] 16.9 Signed URL route 401 on unauthenticated request
- [ ] 16.10 Recruiter review section renders video players and flags
- [ ] 16.11 Toggles save correctly in create + edit flows
- [ ] 16.12 Revocation mid-call leaves chunks intact (no premature delete)
- [ ] 16.13 Single-modality consent copy variants
- [ ] 16.14 Decline path StatusPanel with optional `mailto:`
- [ ] 16.15 RevocationBanner copy per revoked stream
- [ ] 16.16 RevocationBanner above Retell widget, non-dismissible
- [ ] 16.17 CameraStatusChip renders when denied/unavailable; PIP renders when granted
- [ ] 16.18 Proctoring section at top of callInfo.tsx, stacked layout
- [ ] 16.19 Skeleton placeholders at player dimensions during manifest fetch
- [ ] 16.20 Per-chunk 404 → inline warning banner
- [ ] 16.21 Empty state "Recording not available..." when storage path is null
- [ ] 16.22 Screen-share exit link appears after first failed attempt

## 17. Unit & Integration Tests — DEFERRED (operator selected "Full apply, all tasks" which explicitly excludes section 17)

- [ ] 17.1 Unit test for `useMediaRecorder` pendingUploads behavior
- [ ] 17.2 Integration test for chunk route 401
- [ ] 17.3 Integration test for signed-url 403
- [ ] 17.4 Unit test for numeric chunk ordering in finalize manifest
