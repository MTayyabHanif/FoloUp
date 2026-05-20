## Context

Today every interview's public share link is a permanent, unguarded URL. Any person who has the link can start a session with no expiry and no per-candidate accountability. Recruiters cannot run invite-only cohorts, cannot expire a link that was over-shared, and cannot audit which specific candidates were invited vs. who joined cold. The system does have a session-token mechanic (`response.session_token`, minted at `/api/register-call`) but this token lives AFTER the gate, not before it.

The change adds two orthogonal access-control mechanisms:
1. **Per-candidate invite tokens** — UUID rows in a new `interview_invites` table, single-use, 24h expiry, email-bound.
2. **Time-limited, rotatable public tokens** — a UUID column on `interview`, 24h TTL for new interviews (30-day grandfather for existing ones), regenerable via a recruiter action.

Both mechanisms are consumed via a single `?token=<value>` URL param resolved in a new `/api/validate-access` preflight endpoint.

Key existing seams used:
- `src/app/api/register-call/route.ts` — chokepoint for session creation; extended with token gate.
- `src/app/api/response-webhook/route.ts:94` — `call_started` event; extended to mark invite `used_at`.
- `src/app/(user)/call/[interviewId]/page.tsx` — candidate entry; extended with pre-preflight token validation states.
- `src/components/dashboard/interview/editInterview.tsx` — toggle pattern for per-interview booleans; reused for `invite_only`.
- `src/components/dashboard/interview/sharePopup.tsx` — share UI; extended with expiry display, rotate button, and Invites tab.
- `supabase_schema.sql` — canonical DB reference; migration appends new columns and table.

## Goals / Non-Goals

**Goals:**
- Gate interview entry with single-use, email-bound, 24h invite tokens when `invite_only=true`.
- Enforce 24h expiry on public share links (30-day grandfather for existing interviews).
- Allow recruiters to rotate the public token, invalidating it for new sessions while leaving ongoing ones intact.
- Surface typed access-state errors on the candidate page (expired, invite-required, invite-invalid, email-mismatch) without reaching the register-call flow.
- Provide recruiter UI for invite management (create, list, revoke) and public link management (expiry countdown, rotate).

**Non-Goals:**
- Email delivery of invite links (out of scope; recruiter copies and sends the link).
- SSO / OAuth-gated interviews.
- Per-invite or per-interview configurable TTL windows (resolved: OD3 — 24h hard cap; see D10).
- Changing the session-token (`response.session_token`) mechanic or the reconnect-window logic.

## Decisions

### D1 — Single `?token=` param with ordered lookup (implements L4)

**Decision:** One query param `?token=<value>`. `/api/validate-access` looks up `interview_invites.token` first; if no match, compares against `interview.public_token`.

**Rationale:** A single param keeps candidate-facing URLs clean and avoids leaking token type to third parties. The lookup order is safe because invite tokens and public tokens are both UUIDs minted independently; collision probability is negligible. A `?type=` param would expose internal mechanics unnecessarily.

**Alternative considered:** Prefix-encode the token type (`inv_<uuid>` vs `pub_<uuid>`). Rejected: adds parsing complexity and non-standard URL format.

---

### D2 — UUID for all tokens (implements L5)

**Decision:** Both `interview.public_token` and `interview_invites.token` use Postgres `uuid_generate_v4()`. Consistent with `response.session_token`.

**Rationale:** UUIDs are already used for session tokens; no new dependency. Sufficient entropy (~122 bits). Native Postgres UUID type enables indexed equality lookups.

**Alternative considered:** `nanoid()` (shorter, URL-friendly). Rejected: mixing token formats across the schema creates inconsistency; UUID is already the established pattern.

---

### D3 — `reserved_at` at register-call, `used_at` at call_started (implements L1 / L6)

**Decision:** On `/api/register-call`, set `invite.reserved_at = NOW()` atomically (UPDATE WHERE reserved_at IS NULL); return 409 if already reserved. On Retell `call_started` webhook (`src/app/api/response-webhook/route.ts:94`), set `invite.used_at = NOW()` via a join through `response.call_id`.

**Rationale:** `reserved_at` prevents two browser tabs from both registering with the same invite token (race condition). `used_at` on `call_started` is the "strong signal" — the call actually connected — consistent with L6 and the existing webhook seam.

**Alternative considered:** Marking used at link-open or at response creation. Rejected: link-open is too weak (crawlers, accidental clicks); response creation (client-side) can fail silently if the network drops before the Supabase write completes.

---

### D4 — New `/api/validate-access` preflight endpoint (implements CGC seam A)

**Decision:** `POST /api/validate-access` with body `{ interviewId, token? }` (no `email` field — email is NOT accepted here; see ENG1 amendment below). Returns `{ state: 'valid' | 'expired-public' | 'invite-required' | 'invite-invalid' | 'invite-expired' | 'invite-already-used', inviteToken? }`. The candidate page (`src/app/(user)/call/[interviewId]/page.tsx`) calls this before rendering PreflightView or any register-call attempt.

**ENG1 amendment:** `invite-email-mismatch` is NOT a state returned by `/api/validate-access`. The email mismatch is detected exclusively at `/api/register-call` (which returns `403 { error: "invite_email_mismatch" }`). The reason: `PreflightView` — which collects the candidate's email — only mounts after validate-access returns `valid`. The email is therefore unavailable at validate-access time. The `<Call>` component handles the register-call 403 by switching the view to `<InviteEmailMismatchSurface>`.

**Rationale:** Separating validation from registration lets the candidate page render the correct error surface (expired link, invite required, etc.) without wasting a Retell register-call quota on an invalid access attempt. It also keeps `/api/register-call` lean — it only needs to enforce the gate, not explain it.

**Alternative considered:** Fold validation into the page's server component (`getInterviewById`). Rejected: the page is a client component; the token is a URL param not available at RSC time without changes; and interleaving gate logic with the Retell call setup creates a hard-to-test bundle.

---

### D5 — 30-day grandfather expiry for existing public tokens (implements L3)

**Decision:** Migration sets `public_token_expires_at = NOW() + INTERVAL '30 days'` for all existing interview rows. A migration comment documents the policy. New rows created after deploy get `NOW() + INTERVAL '24 hours'`.

**Rationale:** Setting 24h on existing rows would silently break every live interview share link the day after deploy. 30 days gives recruiters notice to regenerate. This is a one-time exception; the 24h policy applies to all interviews going forward.

---

### D6 — Email-bound invites; mismatch is a 403 (implements L2)

**Decision:** `interview_invites.email` is required at creation. Email matching is enforced at `/api/register-call` (not at validate-access preflight). When the candidate's submitted email does not match the invite row's email (case-insensitive), `/api/register-call` returns `403 { error: "invite_email_mismatch" }`, which is rendered as the `InviteEmailMismatchSurface` (ENG1 amendment — see D4 note).

**Rationale:** Email binding provides a basic auditability guarantee without requiring SSO. Case-insensitive comparison avoids false negatives from capitalisation differences (e.g., "Alice@example.com" vs "alice@example.com"). The check is placed at `/api/register-call` because the email is not available until after `PreflightView` (which collects it) renders — and `PreflightView` only renders after a `valid` validate-access response.

**DECISION (OD1):** `invite_only=true` is incompatible with `is_anonymous=true`. The combination is disallowed at both the server and client layers. Server: `interviews.service.updateInviteOnlyFlag` rejects with 422 if the interview has `is_anonymous=true`; the same guard applies at interview-creation time. Client: the `invite_only` switch in `editInterview.tsx` is disabled (with tooltip "Disable Anonymous to use invite-only mode") while `is_anonymous` is on. Toggling `is_anonymous` ON while `invite_only` is already ON shows a confirmation dialog: "Enabling anonymous mode will turn off invite-only. Continue?"

---

### D7 — `invite_only` toggle lives in `editInterview.tsx` (implements CGC seam F)

**Decision:** The `invite_only` Switch component is added to `src/components/dashboard/interview/editInterview.tsx`, following the identical pattern as `is_anonymous`. It is NOT duplicated in `sharePopup.tsx`.

**Rationale:** `editInterview` is the canonical location for per-interview configuration flags. Duplicating the toggle in `sharePopup` risks diverging state between two UI surfaces.

**DECISION (OD2):** The authenticated interview owner (Clerk `user_id` matches `interview.user_id`) can access the candidate URL regardless of `invite_only` value or `public_token` expiry. `/api/validate-access` and `/api/register-call` both check for a Clerk session; if the authenticated user is the interview owner, the token gate is skipped entirely and `validate-access` returns `access_mode=owner_bypass`. The candidate page renders a small non-blocking banner ("Viewing as owner — gate bypassed") when `access_mode=owner_bypass`. Security note: the owner bypass is bound to the authenticated Clerk session — it is NOT a special token in the URL. Recruiters cannot share an "owner URL"; the bypass is session-bound and cannot be forwarded to a third party.

---

### D8 — Rotation semantics: POST endpoint, replaces both columns atomically (implements L7)

**Decision:** `POST /api/interviews/[id]/rotate-public-token` (Clerk-authenticated). Single DB UPDATE: `SET public_token = uuid_generate_v4(), public_token_expires_at = NOW() + INTERVAL '24 hours'`. Returns new token + expiry. Ongoing `response` rows (status=`ongoing`) are unaffected — they hold a `session_token`, not the public token.

**Rationale:** Atomic column replacement ensures no window where the old token is cleared but the new one is not yet written. The recruiter UI refreshes the share popup with the new link.

---

### D9 — InviteService throws on recruiter-path errors; validate-access returns discriminated union (implements CGC seam G)

**Decision:** `src/services/invites.service.ts` methods used on recruiter routes (createInvite, revokeInvite, listInvitesForInterview) throw on error. Methods used on the candidate path (getInviteByToken, markInviteReserved, markInviteUsed) return discriminated unions (or throw selectively) to avoid unhandled exceptions breaking the candidate flow, consistent with the AD-5 spirit of `createResponse` returning null.

---

### DD1 — Validate-access loading state: reuse `LoadingSurface` (plan_design_review)

**Decision:** Between page mount and the `/api/validate-access` response, the candidate page renders the existing `LoadingSurface` component already used during the interview fetch in `src/app/(user)/call/[interviewId]/page.tsx`. No new loading component and no new copy is introduced.

**Rationale:** Reusing an established loading component keeps the exceptional-state surface set minimal and consistent.

---

### DD2 — Rotate-link confirmation: AlertDialog, destructive styling (plan_design_review)

**Decision:** The "Rotate link" button in `sharePopup.tsx` triggers a shadcn/ui `AlertDialog` (matching the delete-interview pattern already in the codebase). Dialog content: Title "Rotate public link?"; Description "This invalidates the current link for any new candidate. Anyone who already started an interview will continue uninterrupted, but new visitors with the old link will see an expired state. You'll need to share the new link manually."; Cancel button (default styling); Confirm button (destructive variant, label "Rotate link").

**Rationale:** Rotation is a destructive, irreversible action. An AlertDialog with a destructive confirm button matches existing codebase conventions and signals the gravity of the action without over-engineering a custom modal.

---

### DD3 — Email-mismatch CTA: "Try a different email" re-mounts PreflightView (plan_design_review)

**Decision:** `InviteEmailMismatchSurface` shows: headline "This invite is for a different email"; body "The email you entered doesn't match the invite. Double-check the email you received the invite at, or contact the recruiter."; primary button "Try a different email" which re-mounts `PreflightView` with the email field cleared and the name field preserved. No secondary "contact recruiter" button — there is no contact mechanism to wire.

**Rationale:** Clearing only the email field (not the name) reduces re-entry friction. Omitting a contact button prevents shipping a dead affordance.

---

### DD4 — Revoke confirmation depends on invite status (plan_design_review)

**Decision:** The revoke button behavior varies by invite status:
- `pending`: single-click revoke, no dialog (candidate has not begun; minimal risk)
- `reserved`: `AlertDialog` required — "Revoke this invite? A candidate may be partway through entering the interview. Revoking will prevent them from starting if they haven't yet, but won't interrupt an active session."
- `used`: revoke button is hidden/disabled (invite is consumed; revoking is meaningless)
- `expired`: single-click revoke, no dialog (token is already dead; cleanup only)

**Rationale:** Graduated friction — only the ambiguous `reserved` state (where a human is mid-flow) warrants a confirmation dialog. The others are either safe or irreversible already.

---

### DD5 — Invites tab always allows invite creation regardless of `invite_only` (plan_design_review)

**Decision:** The Invites tab in `sharePopup.tsx` is NOT gated by `invite_only=true`. Invites are useful in both modes: when `invite_only=OFF`, they still provide duplicate-prevention via email binding. The tab always renders the send-invite form, the invite list, the empty state ("No invites sent yet. Send one above to track individual candidates."), and a small info note: "Invites work regardless of invite-only mode. Enable invite-only in the interview settings to require an invite."

**Rationale:** Gating invite creation on `invite_only` would prevent recruiters from using email-binding in open interviews, reducing the feature's utility. The info note ensures recruiters understand the relationship without being blocked.

---

### D10 — Invite TTL: fixed 24h hard cap (resolves OD3)

**Decision:** All invites expire exactly 24 hours after `created_at`. There is no per-invite or per-interview TTL override. The service sets `expires_at = created_at + INTERVAL '24 hours'` at insert time. The constant is defined in `src/lib/access-control-constants.ts`:

```ts
export const INVITE_TTL_HOURS = 24;
```

The invite creation form displays "Expires in 24 hours" as a static label — no TTL selector is shown.

**Rationale:** A fixed cap keeps the access-control model simple and auditable. Supporting configurable TTL was explicitly evaluated and rejected by the operator.

**Alternative removed:** Per-invite configurable TTL (default 24h, max 14 days) — removed from scope.

---

## Risks / Trade-offs

**[Risk] Optimistic reservation race:** Two tabs open the same invite link simultaneously and both hit `/api/register-call` within milliseconds. The UPDATE WHERE `reserved_at IS NULL` guard prevents double-reservation IF the Postgres write is serializable. A non-atomic read-then-write would fail. → **Mitigation:** Use a single `UPDATE interview_invites SET reserved_at = NOW() WHERE token = $1 AND reserved_at IS NULL RETURNING id` statement; rely on Postgres row-level locking.

**[Risk] Webhook `call_started` arrives before `reserved_at` is persisted:** Network jitter could cause the Retell webhook to fire before the Supabase write from `/api/register-call` commits. → **Mitigation:** `markInviteUsed` looks up the invite via `call_id → response → invite_id`; if `reserved_at` is null, skip (log warning). The invite is already guarded at register-call time.

**[Risk] Grandfather expiry window mismatch:** If the migration runs and 30 days later no one has rotated a link, those links expire silently. → **Mitigation:** Document in migration comment; consider adding an expiry-warning banner in the dashboard that fires 3 days before expiry (nice-to-have, out of scope for this change).

**[Risk] `validate-access` route must be public:** If `src/proxy.ts` does not include `/api/validate-access` in the public-routes list, the candidate will hit an auth redirect before seeing the error surface. → **Mitigation:** Explicit task to update `src/proxy.ts:19` allowlist.

**[Risk] Anonymous + invite-only combination (OD1 resolved — DISALLOWED):** `invite_only=true` on an `is_anonymous=true` interview is rejected at both the server layer (422) and disabled in the client edit form. No email-bypass path is needed. → **Mitigation:** Guard is encoded in `updateInviteOnlyFlag` service method and `editInterview.tsx` UI; see D6 decision and task group 16.

**[Trade-off] Client-side response creation:** `ResponseService.createResponse` is called CLIENT-SIDE in `src/components/call/index.tsx:1214`. The invite token is passed through startConversation to the `/api/register-call` request body; the actual Supabase response row is written after the gate. This means the invite is reserved before the response row exists — the `invite_id` FK on `response` must be nullable to allow the row to be created after reservation. → **Mitigation:** `response.invite_id` is nullable; `markInviteUsed` joins via `call_id` (which IS available on the response row after `webClient.startCall()`).

## RLS Posture

RLS (Row Level Security) is **not enabled** on any table in this project. This has been confirmed across multiple prior changes (e.g., `openspec/changes/archive/2026-05-19-fix-context-fetch-failures/proposal.md:50` — "The app does not use RLS today; the anon key is appropriate").

The new `interview_invites` table follows the same posture:
- No `ENABLE ROW LEVEL SECURITY` directive in the migration.
- No policies are defined on `interview_invites`.
- The `/api/validate-access` route reads the `interview_invites` table using the anon key; this works because RLS is off and the route is server-side (not exposed to the browser Supabase client directly).

**If a future change adds RLS to the project**, this design must be revisited:
- A restricted SELECT policy on `interview_invites` (e.g., limiting reads to `interview_id` + `token` equality lookups) would be needed for `/api/validate-access` to continue working with the anon key.
- Alternatively, `/api/validate-access` would need to be refactored to use the service-role client.

No action is required for this change — the posture is consistent with the rest of the codebase.

## Migration Plan

1. **Schema migration** (migration.sql in this change directory):
   - Add `invite_only BOOLEAN DEFAULT false NOT NULL` to `interview` table.
   - Add `public_token UUID` and `public_token_expires_at TIMESTAMPTZ` to `interview` table.
   - Backfill: `UPDATE interview SET public_token = uuid_generate_v4(), public_token_expires_at = NOW() + INTERVAL '30 days' WHERE public_token IS NULL;` — grandfather expiry for all existing rows.
   - Add NOT NULL constraint on `public_token` after backfill.
   - Create `interview_invites` table (see tasks.md for full DDL).
2. **Deploy** application code (no feature flag needed; `invite_only` defaults to false, so all existing interviews behave identically post-deploy).
3. **Rollback:** Column additions are backward-compatible. If rollback is needed, deploy previous app code (new columns are ignored by old code). Table drop and column removal can follow in a subsequent migration.

## Resolved Operator Decisions

All operator decisions have been resolved and encoded as DECISIONS above (D6, D7, D10):

- **OD1 — DISALLOW anonymous + invite-only:** `invite_only=true` is incompatible with `is_anonymous=true`. Enforced server-side (422) and client-side (disabled switch + confirmation dialog). See D6.
- **OD2 — OWNER BYPASS:** The authenticated interview owner bypasses the token gate. `/api/validate-access` and `/api/register-call` return `access_mode=owner_bypass` for the owner's session. Candidate page shows an "Viewing as owner" banner. Bypass is session-bound — not a shareable URL. See D7.
- **OD3 — HARD 24H CAP:** All invite TTLs are fixed at 24 hours. No configurable TTL. Constant defined in `src/lib/access-control-constants.ts` as `INVITE_TTL_HOURS = 24`. Creation form shows "Expires in 24 hours" as a static label. See D10.
