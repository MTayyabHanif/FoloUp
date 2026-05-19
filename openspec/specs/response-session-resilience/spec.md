# response-session-resilience Specification

## Purpose
TBD - created by archiving change resilient-interview-sessions. Update Purpose after archive.
## Requirements
### Requirement: Server mints session token on call registration
The system SHALL generate a cryptographically random UUID session token server-side in `/api/register-call` and include it in the response payload alongside the Retell `access_token` and `call_id`. The token SHALL be written to the `session_token` column of the new `response` row and to `last_active_at` (set to `now()`).

#### Scenario: Session token returned on successful call registration
- **WHEN** the client POSTs to `/api/register-call` with valid interview credentials
- **THEN** the response JSON includes `session_token` (a UUID string) alongside `registerCallResponse`

#### Scenario: Session token persisted to response row
- **WHEN** `createResponse` is called after a successful `register-call`
- **THEN** the new `response` row contains a non-null `session_token` matching the value returned by the API

### Requirement: Client appends session token to URL after call start
The client SHALL push `?session=<token>` into the browser URL via `router.replace()` (no page reload) immediately after `webClient.startCall()` resolves successfully. The clean interview URL without `?session=` SHALL remain accessible for first-time visitors.

#### Scenario: URL updated after start
- **WHEN** the candidate presses Start and `webClient.startCall()` succeeds
- **THEN** the browser URL changes to `/call/<interviewId>?session=<uuid>` without a page reload

#### Scenario: First-time visitor sees clean URL
- **WHEN** a candidate navigates to `/call/<interviewId>` without a `?session=` parameter
- **THEN** the page renders normally without attempting a session lookup

### Requirement: Reconnect endpoint validates token and 60-second window
The system SHALL expose a GET `/api/check-session` endpoint that accepts a `token` query parameter. It SHALL return `{ exists: bool, withinWindow: bool, status: string }`. The `withinWindow` flag SHALL be `true` only if the matching response row has `last_active_at` within 60 seconds of `now()` AND `status = 'ongoing'`.

#### Scenario: Valid token within window returns withinWindow true
- **WHEN** GET `/api/check-session?token=<valid-token>` is called within 60 seconds of call creation
- **THEN** the response returns `{ exists: true, withinWindow: true, status: 'ongoing' }`

#### Scenario: Expired token returns withinWindow false
- **WHEN** GET `/api/check-session?token=<valid-token>` is called more than 60 seconds after `last_active_at`
- **THEN** the response returns `{ exists: true, withinWindow: false, status: 'ongoing' }`

#### Scenario: Unknown token returns exists false
- **WHEN** GET `/api/check-session?token=<nonexistent-uuid>` is called
- **THEN** the response returns `{ exists: false, withinWindow: false, status: null }`

### Requirement: Client handles reconnect path on page load with session token
On page load, if `?session=<token>` is present in the URL, the client SHALL call `/api/check-session`. If `withinWindow = true` AND `status = 'ongoing'`, the client SHALL skip email/name entry, skip `createResponse`, call `/api/register-call` to get a new Retell call, update the existing response row's `call_id` via `updateResponse`, and present the reconnecting UI. If the window has expired or the session is not ongoing, the client SHALL display a "Your session has ended" message.

#### Scenario: Candidate reloads within 60s — reconnect succeeds
- **WHEN** a candidate with a valid `?session=<token>` reloads the page within 60 seconds
- **THEN** the system skips email entry, registers a fresh Retell call, updates the response row's `call_id`, and starts the call automatically

#### Scenario: Candidate reloads after 60s — shown session expired UI
- **WHEN** a candidate with a `?session=<token>` reloads the page after 60 seconds
- **THEN** the system displays "Your session has ended" and does not attempt to register a new call

### Requirement: Reconnect bypasses oldUserEmails lockout
When a valid `?session=<token>` is present and the `check-session` endpoint confirms `withinWindow = true`, the client SHALL skip the `getAllEmails` duplicate-email check entirely.

#### Scenario: Reconnecting candidate is not blocked by email dupe check
- **WHEN** a candidate reconnects via a valid session token within the 60-second window
- **THEN** the `oldUserEmails` check is bypassed and the candidate is not shown the lockout UI

### Requirement: Public call route passes session token to Call component
The `src/app/(user)/call/[interviewId]/page.tsx` route SHALL accept `session` as an optional field in `searchParams` and pass it as `sessionToken` prop to the `<Call>` component. The `<Call>` component's `InterviewProps` interface SHALL be widened to accept `sessionToken?: string`.

#### Scenario: session searchParam is passed down to Call
- **WHEN** the URL contains `?session=<uuid>` and the page renders
- **THEN** the `<Call>` component receives `sessionToken` equal to the UUID from the URL

