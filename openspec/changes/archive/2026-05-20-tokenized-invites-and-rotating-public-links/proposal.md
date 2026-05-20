## Why

Recruiters need granular control over who can enter an interview: today, anyone with the public share link can start a session, making it impossible to run invite-only cohorts or expire a link that was shared too broadly. Adding per-candidate invite tokens and time-limited, rotatable public links closes this gap and enables auditable, controlled interview access.

## What Changes

- **New `invite_only` flag on interview:** When enabled, only candidates arriving with a valid invite token can start; the public link is blocked for new sessions regardless of its expiry status.
- **New `interview_invites` table:** Stores per-candidate, single-use, 24h-expiring tokens bound to an interview and candidate email. Token is reserved (optimistic lock) at `/api/register-call` and marked used on the Retell `call_started` webhook.
- **Time-limited public token on interview:** `public_token` (UUID) + `public_token_expires_at` columns added to the interview table. New interviews get a 24h window; existing interviews are backfilled with a 30-day grandfather expiry.
- **Public token rotation:** `POST /api/interviews/[id]/rotate-public-token` regenerates the token and resets expiry to NOW + 24h. In-flight `ongoing` response rows are unaffected.
- **New preflight validation route:** `POST /api/validate-access` returns a typed access-state (valid, expired-public, invite-required, invite-invalid, invite-expired, invite-already-used) so the candidate page can render the correct error surface before attempting registration. **Note (ENG1):** `invite-email-mismatch` is NOT returned by validate-access — it is returned as a `403` by `/api/register-call` after the candidate submits their email in `PreflightView`.
- **Candidate page new states:** `ExpiredLinkSurface`, `InviteRequiredSurface`, `InviteInvalidSurface`, `InviteEmailMismatchSurface` in addition to existing states.
- **Dashboard share UI extended:** Expiry countdown + "Rotate" button in the Share link tab; new "Invites" tab for creating, listing, and revoking per-candidate invite links.
- **`invite_only` toggle:** Added to `editInterview.tsx` (same pattern as `is_anonymous`). Disabled with tooltip when `is_anonymous=true`; toggling `is_anonymous` on while `invite_only` is on prompts a confirmation dialog.
- **Owner bypass:** The authenticated interview owner can access the candidate URL regardless of `invite_only` or public token expiry. `/api/validate-access` returns `access_mode=owner_bypass`; candidate page shows a non-blocking "Viewing as owner" banner.
- **`src/lib/access-control-constants.ts`:** New constants file defining `INVITE_TTL_HOURS = 24` and related access-control constants.

## Capabilities

### New Capabilities

- `interview-access-control`: Governs the invite_only flag, per-candidate invite token lifecycle (creation, reservation, used-marking, revocation), and the public token time-limit + rotation policy. Defines the token resolution order (invite lookup first, public token fallback) and the candidate-facing error states.

### Modified Capabilities

- `candidate-session-experience`: Preflight now includes a token validation step before the existing register-call + response-creation flow. New error surfaces (expired link, invite required, invite invalid, email mismatch) added to the candidate journey.
- `recruiter-hiring-workspace`: Share workflow extended with expiry display, rotation action, and invite management UI. Interview edit form gains the `invite_only` toggle.

## Impact

- **Database:** `interview` table gains `invite_only`, `public_token`, `public_token_expires_at`; new `interview_invites` table.
- **Types:** `src/types/interview.ts`, `src/types/database.types.ts`, new `src/types/invite.ts`.
- **Services:** `src/services/interviews.service.ts` (rotatePublicToken, updateInviteOnlyFlag), new `src/services/invites.service.ts`.
- **API routes:** Modify `register-call`, `response-webhook`; add `validate-access`, `interviews/[id]/rotate-public-token`, `interviews/[id]/invites`, `interviews/[id]/invites/[token]`.
- **Candidate UI:** `src/app/(user)/call/[interviewId]/page.tsx`, `src/components/call/index.tsx`.
- **Dashboard UI:** `src/components/dashboard/interview/sharePopup.tsx`, `src/components/dashboard/interview/editInterview.tsx`.
- **Proxy:** `src/proxy.ts` — `validate-access` must be on the public-routes allowlist.
- **Migration:** `openspec/changes/tokenized-invites-and-rotating-public-links/migration.sql`.
