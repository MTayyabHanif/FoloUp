## Why

Audio-only interviews can be defeated by impersonation or AI-assistance tools that candidates run undetected; recruiters have no signal beyond the audio transcript to flag these situations. Adding optional camera and screen-share recording gives hiring teams a manual-review artifact without requiring AI detection infrastructure.

## What Changes

- Add per-interview toggles (`proctoring_camera_enabled`, `proctoring_screen_enabled`) so recruiters can opt specific interviews into proctoring.
- Add a mandatory consent notice step for candidates when either toggle is on — shown before name/email collection. Locked consent copy: "This interview includes recording. With your permission, we'll capture your camera feed and a view of your screen during the session. Recordings are reviewed only by the hiring team and are automatically deleted after 90 days." Checkbox label: "I understand this session will be recorded and agree to proceed." Continue button label: "Continue". When only one modality is enabled, the copy is shortened to name only that modality.
- Add camera acquisition with soft-flag enforcement: if the candidate denies or lacks a camera, the interview proceeds but `camera_status` is flagged. A `CameraStatusChip` placeholder ("Camera unavailable — continuing without video") renders in the PIP position when camera is denied/unavailable.
- Add screen-share acquisition with a pre-start hard gate: only a full-monitor display surface is accepted; window/tab shares are rejected with a re-share prompt. After the first failed attempt, a "Can't share your screen? Exit the interview" link appears, routing to a `StatusPanel` exit. If `getDisplayMedia` is unsupported by the browser, soft-flag and proceed.
- Consent decline path: if the candidate does not consent, a `StatusPanel` renders with message "This interview requires proctoring. Please contact the hiring team if you need an alternative." (with `mailto:` link when `interview.organization.support_email` is set). No session is created.
- Record both streams via `MediaRecorder` (chunked, ~10s timeslices), uploading each chunk immediately to Supabase Storage bucket `proctoring`.
- On call end, finalize: write a manifest JSON (`camera.manifest.json` / `screen.manifest.json`) listing all chunk paths in numeric order; store manifest paths on the `response` row. Chunks are NOT deleted and are the playable artifacts. No server-side stitching (manifest-based approach avoids Vercel Hobby 10s timeout).
- Track mid-call revocation: if the camera or screen-share track fires an `ended` event, set `proctoring_interrupted = true` on the response and show a `RevocationBanner` (wrapping `Banner tone="warning"`, non-dismissible) to the candidate above the Retell widget. Copy varies by which stream(s) were stopped.
- Add a "Proctoring" review section on the response detail page for recruiters, inserted **at the top of `callInfo.tsx`** (before score gauge), showing stacked video players (screen on top, camera below) and colored status-flag chips, a human-readable consent timestamp, `Skeleton` loading states, and inline `Banner tone="warning"` error states per player.
- Implement 90-day TTL on the `proctoring` storage bucket.

## Capabilities

### New Capabilities

- `interview-proctoring`: Camera and screen recording for candidate sessions, including consent flow, chunked upload, manifest-based finalize, MSE-based recruiter playback, revocation tracking, and recruiter review surface.

### Modified Capabilities

- `candidate-session-experience`: The session start flow gains a new consent step and media-acquisition gates before the call begins.
- `response-session-resilience`: The heartbeat route is extended to accept `proctoring_interrupted` and `camera_status` updates mid-call.

## Impact

**Database**: `interview` table gains two boolean columns; `response` table gains six columns (consent timestamp, camera/screen status flags, interrupted flag, storage paths).

**API routes (new)**: `/api/proctoring/chunk`, `/api/proctoring/finalize`, `/api/proctoring/signed-url`. The signed-URL route accepts `?response_id=X&stream=camera` (returns manifest signed URL) or `?response_id=X&stream=camera&chunk_index=N` (single chunk signed URL).

**API routes (modified)**: `/api/register-call` (accept `consent_acknowledged_at`), `/api/response-heartbeat` (accept `proctoring_interrupted`, `camera_status`).

**Frontend (new components)**: `ConsentStep`, `ScreenShareGate`, `CameraPip`, `CameraStatusChip`, `RevocationBanner` (signature: `({ revokedStreams: ("camera" | "screen")[] })`), `useMediaRecorder` hook — all under `src/components/call/proctoring/`.

**Frontend (modified)**: `src/components/call/index.tsx` (recorder lifecycle, gate ordering), `src/components/dashboard/interview/editInterview.tsx` and `create-popup/details.tsx` (toggle UI), `src/components/call/callInfo.tsx` (review section).

**Infrastructure**: New private Supabase Storage bucket `proctoring` with 90-day lifecycle rule. Service-role key used server-side for Storage writes (no RLS bypass needed client-side).

**Dependencies**: No new npm packages required — `MediaRecorder` and `getDisplayMedia` are native browser APIs. `@supabase/supabase-js` already present.

**Out of scope**: AI/ML face detection, mobile browsers, per-org proctoring settings, per-persona overrides, audio re-recording, automatic alerting, real-time monitoring.
