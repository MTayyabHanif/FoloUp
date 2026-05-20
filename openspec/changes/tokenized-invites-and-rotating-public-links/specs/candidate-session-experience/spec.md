## MODIFIED Requirements

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

## ADDED Requirements

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
