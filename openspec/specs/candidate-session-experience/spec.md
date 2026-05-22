## Purpose

Defines how the candidate-facing interview session presents itself — from entry, through preflight, into the active call, exceptional states, and completion. Captures the visual and interaction language that keeps a candidate calm, oriented, and able to recover from edge cases.
## Requirements
### Requirement: Candidate entry uses a guided readiness surface
The candidate entry flow SHALL present a calm readiness experience that explains the role context, expected interview duration, interviewer presence, microphone expectations, and the next step before a session begins. When proctoring is enabled for the interview, a dedicated proctoring consent step SHALL appear BEFORE name/email collection, using the same calm visual language as other pre-call surfaces.

#### Scenario: Candidate opens a valid active interview (no proctoring)
- **WHEN** a candidate opens a valid active call link before joining and neither proctoring toggle is enabled
- **THEN** the page presents a guided preflight state with job context, time expectations, readiness cues, and a clear start or resume action — no consent step is shown

#### Scenario: Candidate opens a valid active interview (proctoring enabled)
- **WHEN** a candidate opens a valid active call link and at least one proctoring toggle is enabled
- **THEN** the proctoring consent step is shown FIRST, before the name/email preflight, using the same calm visual language

#### Scenario: Candidate receives clarity before joining
- **WHEN** the candidate has not yet started the session
- **THEN** the interface explains what will happen next instead of dropping them directly into an unframed call widget

### Requirement: Candidate exceptional states share one calm visual language
Invalid-link, closed-interview, mobile-blocked, offline, expired-session, resume-check, expired-public-link, invite-required, invite-invalid, and invite-email-mismatch states SHALL use consistent calm shells with clear explanations and next actions where possible. All token-gate error states are introduced as first-class variants of the existing exceptional-state system.

#### Scenario: Invalid link state is clear and branded
- **WHEN** a candidate opens a link that does not resolve to an interview
- **THEN** the page shows a consistent invalid-link state explaining the problem and what to do next

#### Scenario: Mobile-blocked state remains consistent
- **WHEN** a candidate opens the interview on a mobile device
- **THEN** the page shows the same system language and clearly instructs them to switch to desktop

#### Scenario: Expired public link is surfaced with a clear message
- **WHEN** `/api/validate-access` returns state `expired-public`
- **THEN** the candidate page renders an `ExpiredLinkSurface` using the calm exceptional-state visual language, explaining the link has expired and advising them to contact the recruiter

#### Scenario: Invite required is surfaced before preflight
- **WHEN** `/api/validate-access` returns state `invite-required`
- **THEN** the candidate page renders an `InviteRequiredSurface` explaining the interview requires a personal invite link and the candidate should not proceed

#### Scenario: Invite invalid is surfaced with a clear message
- **WHEN** `/api/validate-access` returns state `invite-invalid`, `invite-already-used`, or `invite-expired`
- **THEN** the candidate page renders an `InviteInvalidSurface` explaining the invite is not valid, expired, or has already been used

#### Scenario: Invite email mismatch is surfaced with a distinct message (ENG1)
- **WHEN** the candidate submits their email in `PreflightView` and the subsequent `/api/register-call` POST returns `403 { error: "invite_email_mismatch" }`
- **THEN** the `<Call>` component (or its caller in the candidate page) switches the rendered view to `<InviteEmailMismatchSurface>` with:
  - Headline: "This invite is for a different email"
  - Body: "The email you entered doesn't match the invite. Double-check the email you received the invite at, or contact the recruiter."
  - Primary button: "Try a different email" — re-mounts `PreflightView` with the email field cleared and the name field preserved
  - No secondary CTA (no "contact recruiter" button — there is no contact mechanism to wire)
- **THEN** clicking "Try a different email" unmounts `InviteEmailMismatchSurface` and remounts `PreflightView` with `email` reset to `""` and `name` preserved from the prior submission
- **NOTE:** `/api/validate-access` does NOT return `invite-email-mismatch`. The email is not yet known when validate-access is called (it is collected inside `PreflightView`, which only mounts after a `valid` validate-access response). The mismatch is detected exclusively at the `register-call` step.

### Requirement: Active and completion states emphasize focus and progress
During an active session, the candidate experience SHALL emphasize interviewer presence, current progress, and session focus instead of recruiter-style dashboard chrome. Completion and feedback states SHALL remain within the same visual system and provide clear closure.

#### Scenario: Active session remains focused
- **WHEN** the interview call is active
- **THEN** the page prioritizes the live interview experience, progress cues, and essential supporting context without exposing recruiter navigation chrome

#### Scenario: Completion state provides closure
- **WHEN** the session ends successfully
- **THEN** the candidate sees a clear completion state and any feedback collection in the same calm visual system

### Requirement: Candidate entry validates access token before preflight
The candidate entry page (`/call/[interviewId]`) SHALL call `/api/validate-access` on mount with the `?token=` param value (if present) — **no email is sent to validate-access** (email is not yet collected at this stage). Between page mount and the `/api/validate-access` response, the page SHALL render the existing `LoadingSurface` component (the same one used during the interview fetch in `src/app/(user)/call/[interviewId]/page.tsx`) — no new copy and no new component. If the result is any non-`valid` state, the page SHALL render the appropriate error surface and SHALL NOT proceed to PreflightView or register-call. The invite token SHALL be passed through to the register-call request body when present.

Additionally, after `PreflightView` collects the candidate's email and triggers `/api/register-call`, the `<Call>` component SHALL handle a `403 { error: "invite_email_mismatch" }` response from register-call by switching the view to `<InviteEmailMismatchSurface>` (with the "Try a different email" re-mount action described above). This is a separate code path from the validate-access error surfaces (ENG1).

#### Scenario: Valid token proceeds to preflight normally
- **WHEN** `/api/validate-access` returns state `valid` (without `access_mode=owner_bypass`)
- **THEN** the candidate page renders PreflightView as before, with the token available for the register-call request

#### Scenario: Non-valid state blocks preflight
- **WHEN** `/api/validate-access` returns any state other than `valid`
- **THEN** the candidate page renders the corresponding error surface and the PreflightView is not shown

#### Scenario: Owner bypass — banner shown, preflight proceeds
- **WHEN** `/api/validate-access` returns `{ state: 'valid', access_mode: 'owner_bypass' }` (OD2 — authenticated interview owner)
- **THEN** the candidate page renders a non-blocking banner ("Viewing as owner — gate bypassed") above or overlaid on the normal PreflightView; the recruiter sees the full candidate experience minus the gate

### Requirement: Consent step uses locked warm-tone copy and NoteCard disclosures
The `ConsentStep` component SHALL render the locked consent copy inside `CandidateFrame`. The main body copy, checkbox label, and button labels are fixed per the design review. Per-modality `NoteCard` (tone="soft") cards SHALL be used to disclose each recording surface. The Continue button SHALL be disabled until the checkbox is checked.

#### Scenario: Full-modality consent copy shown
- **WHEN** both `proctoring_camera_enabled` and `proctoring_screen_enabled` are true
- **THEN** the consent body reads "This interview includes recording. With your permission, we'll capture your camera feed and a view of your screen during the session. Recordings are reviewed only by the hiring team and are automatically deleted after 90 days." with one NoteCard for Camera and one for Screen

#### Scenario: Camera-only consent copy shown
- **WHEN** only `proctoring_camera_enabled` is true
- **THEN** the consent body replaces "your camera feed and a view of your screen" with "your camera feed" and only a Camera NoteCard is shown

#### Scenario: Screen-only consent copy shown
- **WHEN** only `proctoring_screen_enabled` is true
- **THEN** the consent body replaces "your camera feed and a view of your screen" with "a view of your screen" and only a Screen NoteCard is shown

### Requirement: Candidate can explicitly decline proctoring consent
The consent step SHALL provide an "I don't consent" secondary button. If clicked, the system SHALL NOT create a response row. Instead it SHALL render a `StatusPanel` with the message "This interview requires proctoring. Please contact the hiring team if you need an alternative." A `mailto:` link SHALL be included if `interview.organization.support_email` is set; otherwise the link is omitted.

#### Scenario: Candidate clicks "I don't consent"
- **WHEN** the candidate clicks the "I don't consent" button on the consent step
- **THEN** no response row is created and a `StatusPanel` with the decline message is rendered

#### Scenario: StatusPanel includes support email link when available
- **WHEN** `interview.organization.support_email` is set and the candidate declines
- **THEN** the StatusPanel includes a `mailto:` link with that address

#### Scenario: StatusPanel omits link when no support email
- **WHEN** `interview.organization.support_email` is not set and the candidate declines
- **THEN** the StatusPanel message contains no link

### Requirement: Screen-share gate provides an explicit exit path after first failure
After the FIRST failed screen-share attempt (non-monitor surface selected or picker dismissed), the `ScreenShareGate` SHALL render a "Can't share your screen? Exit the interview" link below the retry button. Clicking it routes to a `StatusPanel` without creating a response row.

#### Scenario: Exit link appears after first screen-share failure
- **WHEN** the candidate's first screen-share attempt fails (non-monitor or dismissed)
- **THEN** a "Can't share your screen? Exit the interview" link appears below the retry prompt

#### Scenario: Screen-share exit StatusPanel shown
- **WHEN** the candidate clicks the exit link from the screen-share gate
- **THEN** a `StatusPanel` reads "Interview not started. Screen sharing is required for this interview. Please contact the hiring team if you need an alternative." and no response row is created

### Requirement: RevocationBanner uses stream-specific copy and wraps existing Banner primitive
When proctoring is interrupted mid-call, the `RevocationBanner({ revokedStreams })` component SHALL use copy specific to which stream(s) were stopped, wrap `Banner tone="warning"`, be non-dismissible, position above the Retell widget, and persist until call end.

#### Scenario: Camera revocation banner shown
- **WHEN** `revokedStreams` contains only "camera"
- **THEN** the banner reads "Your camera was stopped. The interview is still in progress — the hiring team has been notified."

#### Scenario: Screen revocation banner shown
- **WHEN** `revokedStreams` contains only "screen"
- **THEN** the banner reads "Your screen share was stopped. The interview is still in progress — the hiring team has been notified."

#### Scenario: Both streams revocation banner shown
- **WHEN** `revokedStreams` contains both "camera" and "screen"
- **THEN** the banner reads "Your camera and screen share were stopped. The interview is still in progress — the hiring team has been notified."

#### Scenario: RevocationBanner is non-dismissible and persists
- **WHEN** the RevocationBanner is shown
- **THEN** it cannot be dismissed by the candidate and remains visible until the call ends

### Requirement: CameraStatusChip renders when camera is unavailable or denied
When `camera_status` is "denied" or "unavailable", the system SHALL render a `CameraStatusChip` in the PIP position (fixed bottom-right) with the label "Camera unavailable — continuing without video". When `camera_status` is "granted", the actual PIP video element is rendered instead.

#### Scenario: CameraStatusChip shown on denied camera
- **WHEN** `camera_status === "denied"`
- **THEN** a chip/pill reading "Camera unavailable — continuing without video" renders in the bottom-right position and no video PIP is shown

#### Scenario: CameraStatusChip shown on unavailable camera
- **WHEN** `camera_status === "unavailable"`
- **THEN** the same chip renders in the bottom-right position

#### Scenario: Actual PIP shown when camera granted
- **WHEN** `camera_status === "granted"`
- **THEN** the mirrored `<video>` PIP element renders with a REC dot indicator

### Requirement: Camera PIP provides self-view during active call
When camera recording is active, the system SHALL render a small mirrored self-view video element (`CameraPip`) in the bottom-right corner of the active call view, so the candidate can see their own camera feed during the interview.

#### Scenario: Camera PIP visible during active call
- **WHEN** camera recording is active and the Retell call is in progress
- **THEN** a small mirrored self-view video element is visible in the corner of the call interface

#### Scenario: No camera PIP without camera
- **WHEN** camera_status is not "granted"
- **THEN** the CameraStatusChip renders instead of the video PIP

