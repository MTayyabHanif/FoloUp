# interview-proctoring Specification

## Purpose
TBD - created by archiving change add-interview-proctoring-camera-screen. Update Purpose after archive.
## Requirements
### Requirement: Per-interview proctoring toggles control recording activation
The system SHALL store `proctoring_camera_enabled` and `proctoring_screen_enabled` boolean columns on the `interview` table, both defaulting to `false`. The candidate-side recording flow SHALL activate only when the relevant toggle is `true` for that interview.

#### Scenario: Proctoring disabled — no consent step, no recording
- **WHEN** both `proctoring_camera_enabled` and `proctoring_screen_enabled` are `false` for an interview
- **THEN** the candidate sees no consent step, no camera PIP, no screen-share prompt, and no recording is initiated

#### Scenario: Camera enabled — recording activates, PIP shown
- **WHEN** `proctoring_camera_enabled` is `true`
- **THEN** the consent step is shown, camera acquisition is attempted, and a self-view PIP is rendered during the call

#### Scenario: Screen enabled — hard gate activates
- **WHEN** `proctoring_screen_enabled` is `true`
- **THEN** the screen-share gate is shown before the call starts, and only a full-monitor surface is accepted

### Requirement: Candidate acknowledges proctoring consent before media acquisition
When either proctoring toggle is enabled, the system SHALL display a dedicated consent notice step BEFORE name/email collection. The candidate MUST check a checkbox and click Continue. The consent timestamp SHALL be stored as `consent_acknowledged_at` on the `response` row.

#### Scenario: Consent step shown when proctoring is active
- **WHEN** a candidate opens an interview with at least one proctoring toggle enabled
- **THEN** the first step shown is the proctoring consent notice with a checkbox and Continue button

#### Scenario: Consent step blocks progress until acknowledged
- **WHEN** the candidate has not checked the consent checkbox
- **THEN** the Continue button is disabled and the candidate cannot proceed

#### Scenario: Consent timestamp stored on response
- **WHEN** the candidate acknowledges consent and the register-call completes
- **THEN** `consent_acknowledged_at` is set on the response row to the time of acknowledgement

### Requirement: Camera acquisition soft-fails gracefully
The system SHALL attempt `getUserMedia({ video: true })` when `proctoring_camera_enabled` is `true`. If the browser denies permission or the camera is unavailable, the system SHALL set `camera_status` to `"denied"` or `"unavailable"` respectively, proceed to the next gate, and surface no blocking error to the candidate.

#### Scenario: Camera granted — status recorded
- **WHEN** the candidate grants camera permission
- **THEN** `camera_status` is set to `"granted"` and the camera stream is used for recording and PIP

#### Scenario: Camera denied — soft flag, interview continues
- **WHEN** the candidate denies camera permission
- **THEN** `camera_status` is set to `"denied"`, no camera recording is started, and the interview proceeds without blocking

#### Scenario: Camera unavailable — soft flag, interview continues
- **WHEN** no camera device is found on the system
- **THEN** `camera_status` is set to `"unavailable"` and the interview proceeds without blocking

### Requirement: Screen-share acquisition hard-gates on full-monitor surface
When `proctoring_screen_enabled` is `true`, the system SHALL call `getDisplayMedia` and inspect `track.getSettings().displaySurface`. Only `"monitor"` is accepted. Any other surface (window, tab) SHALL trigger a re-share prompt. If `getDisplayMedia` is unsupported, the system SHALL set `screen_share_type = "unsupported"` and proceed (soft-flag). If the user denies the picker, the gate re-prompts.

#### Scenario: Full-monitor surface accepted
- **WHEN** the candidate selects their entire screen in the share picker
- **THEN** `screen_share_type` is set to `"monitor"` and the interview proceeds

#### Scenario: Window or tab surface rejected — re-share prompt shown
- **WHEN** the candidate selects a window or tab instead of a full monitor
- **THEN** the ScreenShareGate component shows a "Please share your full screen" message and prompts again

#### Scenario: getDisplayMedia unsupported — soft flag, interview continues
- **WHEN** `getDisplayMedia` is not available in the candidate's browser
- **THEN** `screen_share_type` is set to `"unsupported"` and the interview proceeds without blocking

#### Scenario: Screen-share picker opens without triggering tab-switch flag
- **WHEN** the ScreenShareGate calls `getDisplayMedia` and the browser fires a `visibilitychange` event
- **THEN** the tab-switch counter is NOT incremented during the screen-share request window

### Requirement: MediaRecorder captures streams in ~10s chunks and uploads immediately
Once the Retell `call_started` event fires, the system SHALL start `MediaRecorder` instances for each acquired stream (camera and/or screen) with a 10-second timeslice. Each `ondataavailable` Blob SHALL be immediately POSTed to `/api/proctoring/chunk` with the stream type and chunk index. On `call_ended`, `stop()` is called and `/api/proctoring/finalize` is POSTed.

#### Scenario: Recorder starts on call_started event
- **WHEN** the Retell `call_started` event fires
- **THEN** each active MediaRecorder begins recording and emitting chunks

#### Scenario: Each chunk POSTed immediately
- **WHEN** `ondataavailable` fires with a Blob
- **THEN** a multipart POST is made to `/api/proctoring/chunk` with stream, chunk_index, and the Blob

#### Scenario: Failed chunk upload retried
- **WHEN** a chunk POST fails with a network error
- **THEN** the client retries up to 3 times with exponential backoff before giving up

#### Scenario: Finalize called on call_ended
- **WHEN** the Retell `call_ended` event fires
- **THEN** `stop()` is called on all MediaRecorders and POST /api/proctoring/finalize is sent

### Requirement: Mid-call revocation is tracked and flagged
If a camera or screen-share `MediaStreamTrack` fires an `ended` event during the call, the system SHALL set `proctoring_interrupted = true` on the response row (via the heartbeat route) and SHALL display a `RevocationBanner` to the candidate. The interview SHALL continue without blocking.

#### Scenario: Track ended mid-call — interrupted flag set
- **WHEN** a `MediaStreamTrack` fires `ended` during an active call
- **THEN** `proctoring_interrupted = true` is sent to the heartbeat route and persisted on the response row

#### Scenario: RevocationBanner shown to candidate
- **WHEN** proctoring_interrupted transitions to true
- **THEN** the RevocationBanner is rendered as an overlay warning; the call is not terminated

### Requirement: Chunk and finalize routes authenticate via session_token and derive org_id server-side
The `/api/proctoring/chunk` and `/api/proctoring/finalize` routes SHALL authenticate requests using `Authorization: Bearer <session_token>`. The server SHALL derive `organization_id` by joining `session_token → response → interview → organization_id`. The client SHALL NEVER send `org_id` and the server SHALL NEVER trust a client-supplied `org_id`.

#### Scenario: Valid session_token — request proceeds
- **WHEN** a request arrives with a valid session_token in the Authorization header
- **THEN** the server derives response_id and org_id from the token and processes the request

#### Scenario: Invalid or missing session_token — 401 returned
- **WHEN** a request arrives with no or invalid Authorization header
- **THEN** the server returns 401 without processing the request

### Requirement: Finalize writes a manifest of chunks and stores manifest paths on response
The `/api/proctoring/finalize` route SHALL fetch all chunk objects for each stream, sort them in numeric (NOT lexicographic) chunk_index order, write a manifest JSON file at `<org_id>/<response_id>/<stream>.manifest.json`, and update `response.camera_storage_path` / `response.screen_storage_path` to the manifest paths. Chunk files SHALL NOT be deleted — they are the playable artifacts.

#### Scenario: Finalize produces a manifest file per stream
- **WHEN** POST /api/proctoring/finalize is called with valid streams
- **THEN** each requested stream produces one `<stream>.manifest.json` file in the proctoring bucket listing chunks in numeric order

#### Scenario: Manifest paths stored on response row
- **WHEN** finalize completes successfully for a stream
- **THEN** `camera_storage_path` or `screen_storage_path` is set to the manifest JSON path on the response row

#### Scenario: Chunk objects retained after finalize
- **WHEN** finalize completes successfully
- **THEN** the individual chunk `.webm` objects remain in the proctoring bucket and are NOT deleted

#### Scenario: Chunks listed in numeric order in manifest
- **WHEN** Storage returns chunk filenames in non-numeric order (e.g. "10.webm" before "2.webm")
- **THEN** the manifest `chunks` array lists them in ascending numeric order: [0, 1, 2, 10, 11, ...]

### Requirement: Recruiter review surface shows video players and status flags
The response detail page (`callInfo.tsx`) SHALL include a "Proctoring" section when at least one proctoring toggle was enabled for the interview. The section SHALL be inserted **at the top of `callInfo.tsx`**, before the score gauge and existing analytics. It SHALL use a stacked layout (screen player on top, camera player below) with `Skeleton` loading states and inline `Banner tone="warning"` per-player error states.

#### Scenario: Proctoring section at top of callInfo
- **WHEN** at least one proctoring toggle was enabled for the interview
- **THEN** the Proctoring section is the first section rendered on the response detail page, above the score gauge

#### Scenario: Proctoring section hidden when disabled
- **WHEN** both `proctoring_camera_enabled` and `proctoring_screen_enabled` are false
- **THEN** the Proctoring section is not rendered at all

#### Scenario: Proctoring section visible with recordings
- **WHEN** a recruiter views a response detail page where `camera_storage_path` or `screen_storage_path` is set
- **THEN** the Proctoring section renders `<video>` players backed by 1-hour signed URLs in a stacked layout (screen on top, camera below)

#### Scenario: Skeleton loading states shown
- **WHEN** the manifest fetch or SourceBuffer fill is in progress
- **THEN** `Skeleton` placeholders at the video player dimensions are shown instead of the players

#### Scenario: Per-chunk 404 error shown inline
- **WHEN** a chunk signed URL returns 404
- **THEN** an inline `Banner tone="warning"` renders below the affected player: "Some segments couldn't be loaded. Playback may be incomplete."

#### Scenario: Signed URL route is Clerk-authenticated
- **WHEN** an unauthenticated request hits GET /api/proctoring/signed-url
- **THEN** the route returns 401 without issuing a signed URL

#### Scenario: Status flags displayed alongside videos
- **WHEN** the Proctoring section renders
- **THEN** camera_status, screen_share_type, proctoring_interrupted, and consent_acknowledged_at are shown as colored chips and a human-readable timestamp ("Consent given at 2:34 PM, May 22, 2026") respectively

#### Scenario: Empty state — recording not saved
- **WHEN** a proctoring toggle is enabled but `camera_storage_path` or `screen_storage_path` is null
- **THEN** the section renders "Recording not available. The session ended before the recording could be saved. Camera status: [chip]."

#### Scenario: Empty state — consent declined
- **WHEN** the candidate declined proctoring consent (no response row or proctoring_declined status)
- **THEN** the section renders "The candidate declined proctoring consent. No recording was made."

### Requirement: Proctoring storage uses a private bucket with 90-day TTL
All recording files SHALL be stored in a private Supabase Storage bucket named `proctoring`. No public URLs SHALL be issued. A lifecycle rule SHALL automatically expire all objects after 90 days.

#### Scenario: Bucket is private — no direct URL access
- **WHEN** an attempt is made to access a proctoring file via its direct Storage URL (without a signed URL)
- **THEN** the request is rejected with a 403 or 401

#### Scenario: Objects expire after 90 days
- **WHEN** 90 days have passed since a proctoring file was uploaded
- **THEN** the lifecycle rule removes the file from storage automatically

