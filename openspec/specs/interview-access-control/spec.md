# interview-access-control Specification

## Purpose
TBD - created by archiving change tokenized-invites-and-rotating-public-links. Update Purpose after archive.
## Requirements
### Requirement: Interview supports an invite-only access mode
The interview entity SHALL carry an `invite_only` boolean (default false). When `invite_only=true`, only candidates presenting a valid, unexpired, unreserved invite token SHALL be permitted to start a session. The public share link SHALL be blocked for new sessions when `invite_only=true`, regardless of the public token's expiry status.

#### Scenario: Invite-only off — public link accepted
- **WHEN** `invite_only=false` and a candidate arrives with no token or with a valid public token
- **THEN** the system grants access and allows the candidate to proceed to registration

#### Scenario: Invite-only on — valid invite token accepted
- **WHEN** `invite_only=true` and a candidate arrives with a valid, unexpired, unreserved invite token whose email matches the candidate's submitted email (case-insensitive)
- **THEN** the system grants access and allows the candidate to proceed to registration

#### Scenario: Invite-only on — public token rejected
- **WHEN** `invite_only=true` and a candidate arrives with no token or with only the public token
- **THEN** the system returns state `invite-required` and the candidate MUST NOT proceed to registration

#### Scenario: Invite-only on — invite token mismatch (ENG1)
- **WHEN** a candidate submits a valid invite token to `/api/register-call` but the candidate's submitted email does not match the invite row's email (case-insensitive)
- **THEN** `/api/register-call` returns `403 { error: "invite_email_mismatch" }` and the candidate MUST NOT proceed; the candidate page's `<Call>` component handles this 403 by switching the view to `<InviteEmailMismatchSurface>`
- **NOTE:** `/api/validate-access` does NOT check email and does NOT return `invite-email-mismatch` — email is only known after `PreflightView` collects it, which is after the validate-access call completes (ENG1)

### Requirement: invite_only and is_anonymous are mutually exclusive (OD1)
The system SHALL reject any attempt to set `invite_only=true` on an interview that has `is_anonymous=true`. This constraint SHALL be enforced at both the server layer and client layer.

Server: `interviews.service.updateInviteOnlyFlag` SHALL return a 422 error with code `invite-only-incompatible-with-anonymous` if the target interview has `is_anonymous=true`. The same check SHALL be applied at interview-creation time.

Client: The `invite_only` switch in `editInterview.tsx` SHALL be disabled (non-interactive) with tooltip "Disable Anonymous to use invite-only mode" whenever `is_anonymous=true`. Toggling `is_anonymous` ON while `invite_only` is already ON SHALL display a confirmation dialog ("Enabling anonymous mode will turn off invite-only. Continue?") — on confirm, the system SHALL set `invite_only=false` before setting `is_anonymous=true`.

#### Scenario: Server rejects invite-only on anonymous interview
- **WHEN** a recruiter calls `updateInviteOnlyFlag(true)` on an interview with `is_anonymous=true`
- **THEN** the server returns 422 with error `invite-only-incompatible-with-anonymous`

#### Scenario: Client disables invite-only switch when anonymous is on
- **WHEN** `is_anonymous=true` in the interview edit form
- **THEN** the `invite_only` switch is disabled and displays the tooltip "Disable Anonymous to use invite-only mode"

#### Scenario: Confirmation when enabling anonymous while invite-only is on
- **WHEN** the recruiter toggles `is_anonymous` ON while `invite_only=true`
- **THEN** a confirmation dialog is shown; on confirm, `invite_only` is set to false first, then `is_anonymous` is set to true; on cancel, no changes are made

---

### Requirement: Authenticated interview owner bypasses the token gate (OD2)
The system SHALL allow the authenticated interview owner (Clerk session `user_id` matches `interview.user_id`) to access the candidate URL without any token, regardless of `invite_only` value or `public_token` expiry.

`/api/validate-access` SHALL check for a Clerk session before all token-gate logic. If the authenticated user is the interview owner, it SHALL return `{ state: 'valid', access_mode: 'owner_bypass' }` immediately. `/api/register-call` SHALL apply the same bypass for the owner.

Security constraint: the owner bypass is bound to the authenticated Clerk session. It is NOT encoded in the URL. The bypass MUST NOT be activated by any token or URL parameter — only by a valid authenticated session.

The candidate page SHALL render a non-blocking banner ("Viewing as owner — gate bypassed") when `access_mode=owner_bypass`.

#### Scenario: Owner authenticated — bypass granted
- **WHEN** the authenticated Clerk user is the interview owner and accesses `/api/validate-access`
- **THEN** the system returns `{ state: 'valid', access_mode: 'owner_bypass' }` without evaluating any token

#### Scenario: Different authenticated user — no bypass
- **WHEN** an authenticated Clerk user who is NOT the interview owner accesses `/api/validate-access`
- **THEN** the system treats the request as an anonymous candidate; the token gate applies normally

#### Scenario: Unauthenticated + invite_only — blocked normally
- **WHEN** no Clerk session is present and `invite_only=true` with no valid invite token
- **THEN** the system returns `{ state: 'invite-required' }` as normal

---

### Requirement: Per-candidate invite tokens are single-use and email-bound
The `interview_invites` table SHALL store one row per invite, with fields: `id`, `interview_id`, `token` (UUID), `email` (TEXT), `created_at`, `reserved_at` (nullable), `used_at` (nullable), `revoked_at` (nullable), `expires_at` (24h after creation). A token is considered valid if and only if: not revoked, not expired, `reserved_at IS NULL`.

#### Scenario: Invite token reserved atomically at registration
- **WHEN** a candidate submits a valid invite token to `/api/register-call`
- **THEN** the system performs an atomic UPDATE setting `reserved_at = NOW()` WHERE `reserved_at IS NULL`, and returns 409 if the row was already reserved

#### Scenario: Invite token marked used on call_started webhook
- **WHEN** the Retell `call_started` webhook fires for a call whose associated response row carries an `invite_id`
- **THEN** the system sets `invite.used_at = NOW()` on the corresponding invite row

#### Scenario: Expired invite is rejected
- **WHEN** a candidate arrives with an invite token whose `expires_at` is in the past
- **THEN** the system returns state `invite-expired` and the candidate MUST NOT proceed to registration

#### Scenario: Already-reserved invite is rejected
- **WHEN** a candidate attempts to use an invite token with `reserved_at IS NOT NULL`
- **THEN** the system returns state `invite-already-used` and the candidate MUST NOT proceed to registration

#### Scenario: Revoked invite is rejected
- **WHEN** a candidate arrives with an invite token whose `revoked_at IS NOT NULL`
- **THEN** the system returns state `invite-invalid` and the candidate MUST NOT proceed to registration

### Requirement: Public share link is time-limited and rotatable
The interview entity SHALL carry a `public_token` (UUID) and `public_token_expires_at` (TIMESTAMPTZ). The public token expires when `public_token_expires_at < NOW()`. New interviews SHALL receive a 24h expiry at creation. Existing interviews at migration time SHALL receive a 30-day grandfather expiry. A recruiter MAY regenerate the public token via `POST /api/interviews/[id]/rotate-public-token`, which atomically replaces `public_token` and sets `public_token_expires_at = NOW() + 24h`.

#### Scenario: Valid public token grants access
- **WHEN** `invite_only=false` and a candidate arrives with the current `public_token` before its expiry
- **THEN** the system returns state `valid`

#### Scenario: Expired public token is rejected
- **WHEN** a candidate arrives with a token that matches `interview.public_token` but `public_token_expires_at < NOW()`
- **THEN** the system returns state `expired-public` and the candidate MUST NOT proceed to registration

#### Scenario: Stale public token (post-rotation) is rejected
- **WHEN** a candidate arrives with an old `public_token` value that no longer matches the current `interview.public_token`
- **THEN** the token lookup fails to match any invite row AND fails to match `interview.public_token`, resulting in state `invite-invalid` for invite-only or `expired-public`-equivalent rejection for public interviews

#### Scenario: Rotation does not affect ongoing sessions
- **WHEN** a recruiter rotates the public token
- **THEN** existing `response` rows with `status='ongoing'` are unaffected; their `session_token` is independent of `public_token`

### Requirement: Token resolution uses a single URL parameter with ordered lookup
The system SHALL accept a single `?token=<value>` query parameter. `/api/validate-access` SHALL first look up `interview_invites` by token value; if no matching invite row exists for the interview, it SHALL compare against `interview.public_token`. No separate `?type=` parameter is used.

`/api/validate-access` SHALL NOT accept or evaluate an `email` field. Email matching is exclusively the responsibility of `/api/register-call` (ENG1). The rationale: the candidate's email is collected inside `PreflightView`, which only mounts after a `valid` validate-access response — so the email is not available at the time of the validate-access call.

`/api/register-call` SHALL enforce email binding as the sole gate for invite email matching. When a valid invite token is present but the candidate's submitted email does not match `invite.email` (case-insensitive), `/api/register-call` SHALL return `403 { error: "invite_email_mismatch" }` (ENG1).

#### Scenario: Token resolves as invite
- **WHEN** the submitted token value matches an `interview_invites.token` for the given interview
- **THEN** the system evaluates it as an invite token (expiry, reservation, email-match checks apply)

#### Scenario: Token resolves as public token
- **WHEN** the submitted token value does not match any `interview_invites.token` for the interview but matches `interview.public_token`
- **THEN** the system evaluates it as a public token (expiry check applies)

#### Scenario: No token submitted on invite-only interview
- **WHEN** `invite_only=true` and no token is present in the request
- **THEN** the system returns state `invite-required`

#### Scenario: No token submitted on non-invite-only interview
- **WHEN** `invite_only=false` and no token is present in the request
- **THEN** the system returns state `invite-required` (the public link URL always carries the public token; absence means the link was not used)

### Requirement: Invite TTL is a fixed 24-hour hard cap (OD3)
All invite tokens SHALL expire exactly 24 hours after `created_at`. There is no per-invite or per-interview override. The system SHALL compute `expires_at = created_at + INTERVAL '24 hours'` in the service layer using the constant `INVITE_TTL_HOURS = 24` defined in `src/lib/access-control-constants.ts`. No UI for selecting an invite TTL SHALL be provided — the invite creation form SHALL display "Expires in 24 hours" as a static label.

#### Scenario: Invite expires after 24 hours
- **WHEN** an invite token is accessed more than 24 hours after its `created_at`
- **THEN** the system returns state `invite-expired` and the candidate MUST NOT proceed to registration

#### Scenario: No TTL configuration is available
- **WHEN** a recruiter creates an invite in the UI
- **THEN** no TTL selector is shown; the form displays "Expires in 24 hours" as a non-editable label

---

### Requirement: Recruiter can manage invite tokens via authenticated API
Authenticated recruiter API routes SHALL support: creating an invite (POST with `email`), listing invites for an interview (GET), and revoking an invite (DELETE sets `revoked_at`). All routes SHALL require Clerk authentication.

#### Scenario: Create invite
- **WHEN** a recruiter POSTs `{ email }` to `/api/interviews/[id]/invites`
- **THEN** the system creates a new row in `interview_invites` with a fresh UUID token and `expires_at = NOW() + 24h`, and returns the shareable URL

#### Scenario: List invites
- **WHEN** a recruiter GETs `/api/interviews/[id]/invites`
- **THEN** the system returns all invite rows for the interview with their status (pending, reserved, used, revoked, expired)

#### Scenario: Revoke invite
- **WHEN** a recruiter DELETEs `/api/interviews/[id]/invites/[token]`
- **THEN** the system sets `revoked_at = NOW()` on the invite row and the token is immediately invalid for new sessions

---

### Requirement: Access-control tables follow the project-wide no-RLS posture (ENG3)

The `interview_invites` table SHALL NOT have Row Level Security enabled. This follows the project-wide convention: no table in this project uses Supabase RLS, and adding RLS only to the new access-control surface would create an inconsistent security model. The Supabase anon key SHALL be used for both recruiter-authenticated paths (which are gated by Clerk on the route layer) and candidate paths (which are gated by the token-resolution logic in `/api/validate-access` and `/api/register-call`).

If a future change introduces RLS to this project, this requirement MUST be revisited: `/api/validate-access` would then need either a restricted SELECT policy on `interview_invites(interview_id, token)` or a refactor to use a service-role client.

#### Scenario: No RLS directives in the migration
- **WHEN** the migration `openspec/changes/tokenized-invites-and-rotating-public-links/migration.sql` is applied
- **THEN** no `ENABLE ROW LEVEL SECURITY` statement appears for `interview_invites`, and no policy is created on the table

