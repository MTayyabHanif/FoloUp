## 1. Database Migration

- [x] 1.1 Add `invite_only BOOLEAN DEFAULT false NOT NULL` column to `interview` table in `supabase_schema.sql`
- [x] 1.2 Add `public_token UUID` and `public_token_expires_at TIMESTAMPTZ` columns to `interview` table in `supabase_schema.sql`
- [x] 1.3 Write backfill statement: `UPDATE interview SET public_token = uuid_generate_v4(), public_token_expires_at = NOW() + INTERVAL '30 days' WHERE public_token IS NULL` (grandfather expiry for existing rows)
- [x] 1.4 Create `interview_invites` table in `supabase_schema.sql`: `id UUID PK DEFAULT uuid_generate_v4(), interview_id TEXT NOT NULL REFERENCES interview(id) ON DELETE CASCADE, token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(), email TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL, reserved_at TIMESTAMPTZ, used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ`
- [x] 1.5 Add index on `interview_invites(interview_id)` and unique index on `interview_invites(token)`
- [x] 1.6 Add nullable `invite_id UUID REFERENCES interview_invites(id)` column to `response` table in `supabase_schema.sql`
- [x] 1.7 Write complete `migration.sql` in `openspec/changes/tokenized-invites-and-rotating-public-links/migration.sql` with all DDL, backfill, and index statements, including migration comment documenting grandfather expiry policy. **No RLS directives** — matches project-wide posture (RLS is not enabled on any table in this project; `interview_invites` follows the same convention).

> Slice 1 note: schema-reference reordering — `interview_invites` is declared BEFORE `response` in `supabase_schema.sql` because `response.invite_id` forward-references it. The schema replays clean from a fresh DB.

## 2. Types

- [x] 2.1 Add `invite_only: boolean` to `InterviewBase` in `src/types/interview.ts`; `public_token` + `public_token_expires_at` placed on `InterviewDetails` (they're system-managed, not user-config — placement matches the existing pattern where `url` and `readable_slug` live on InterviewDetails).
- [x] 2.2 Create `src/types/invite.ts` with `InterviewInvite` type (all columns) and `InviteStatus` union: `'pending' | 'reserved' | 'used' | 'revoked' | 'expired'`
- [x] 2.3 Add `AccessState` union type to `src/types/invite.ts`: `'valid' | 'expired-public' | 'invite-required' | 'invite-invalid' | 'invite-expired' | 'invite-already-used'`. **Note (ENG1):** `'invite-email-mismatch'` is NOT part of this union — it is surfaced as a `403` HTTP response from `/api/register-call`, not as an `AccessState` from `/api/validate-access`. Also exported: `AccessMode` (`'public' | 'invite' | 'owner_bypass'`) and `ValidateAccessResponse` (the response shape from validate-access).
- [x] 2.4 Update `src/types/database.types.ts` with new `interview_invites` table shape and new interview columns. Also added `invite_id?: string | null` to the `response` row shape — **this type change is part of the INVITE_ID_THREADING_ATOMIC chain (see task group 6A); do not mark the chain done in isolation. The type change alone has been landed because it has no runtime effect.**

## 3. InviteService

- [x] 3.1 Create `src/services/invites.service.ts` with Supabase client (same pattern as other services)
- [x] 3.2 Implement `createInvite(interviewId, email): Promise<InterviewInvite>` — inserts row with `expires_at = created_at + INTERVAL '24 hours'` (computed service-side using `INVITE_TTL_HOURS` constant from `src/lib/access-control-constants.ts`); throws on error. Email is normalized to lowercase + trimmed at insert time.
- [x] 3.3 Implement `getInviteByToken(interviewId, token): Promise<InterviewInvite | null>` — returns null if not found (no throw)
- [x] 3.4 Implement `markInviteReserved(inviteId): Promise<{ ok: true } | { ok: false; reason: 'already-reserved' }>` — atomic UPDATE WHERE `reserved_at IS NULL`; returns discriminated union
- [x] 3.5 Implement `markInviteUsed(callId): Promise<void>` — joins via `response.call_id → response.invite_id → interview_invites`; sets `used_at = NOW()`; skips silently (with warn log) if no invite_id or if response row is missing
- [x] 3.6 Implement `listInvitesForInterview(interviewId): Promise<InterviewInvite[]>` — returns all rows ordered by `created_at DESC`; throws on error
- [x] 3.7 Implement `revokeInvite(inviteId): Promise<void>` — sets `revoked_at = NOW()`; throws on error
- [x] 3.8 Add `deriveInviteStatus(invite: InterviewInvite): InviteStatus` helper that computes status from column values

## 4. InterviewService Extensions

- [x] 4.1 Add `rotatePublicToken(interviewId): Promise<{ public_token: string; public_token_expires_at: string }>` to `src/services/interviews.service.ts` — atomic UPDATE setting both columns; throws on error
- [x] 4.2 Add `updateInviteOnlyFlag(interviewId, inviteOnly: boolean): Promise<void>` to `src/services/interviews.service.ts` — fetches current `is_anonymous` and throws a typed `InviteOnlyAnonymousConflictError` (status=422, code=`invite_only_anonymous_conflict`) if `inviteOnly=true` and `is_anonymous=true` (OD1 server guard). Exported `isInviteOnlyAnonymousConflict` type guard for callers.
- [x] 4.3 Updated `create-interview` route (`src/app/api/create-interview/route.ts`) to mint `public_token = crypto.randomUUID()` and `public_token_expires_at = NOW() + PUBLIC_TOKEN_TTL_HOURS` (24h) on new interview creation.

## 5. Validate-Access API Route

- [x] 5.1 Create `src/app/api/validate-access/route.ts` as a public (unauthenticated) POST route
- [x] 5.2 Parse `{ interviewId, token? }` from request body (no `email` field — email is NOT accepted or checked here); return 400 on missing interviewId
- [x] 5.3 Fetch interview row; return `{ state: 'invite-required' }` if `invite_only=true` and no token
- [x] 5.4 If token present: look up `interview_invites` by `(interview_id, token)` first; if found, run invite validity checks (revoked → `invite-invalid`; used → `invite-already-used`; expired → `invite-expired`; reserved → `invite-already-used`; else → `valid` with `access_mode: 'invite'` and `invite_id`). **Email is NOT checked here** — email mismatch is enforced exclusively by `/api/register-call` (ENG1).
- [x] 5.5 If token not matched in invites: compare against `interview.public_token`; if matches and `invite_only=false`, check `public_token_expires_at` — expired → `expired-public`; else → `valid` with `access_mode: 'public'`
- [x] 5.6 If token matches neither: return `{ state: 'invite-invalid' }`
- [x] 5.7 Add `/api/validate-access` to the public-routes allowlist in `src/proxy.ts`

> Slice 2 note: validate-access also implements **owner bypass** (OD2). If a Clerk session is present and `userId === interview.user_id`, every gate is short-circuited to `{ state: 'valid', access_mode: 'owner_bypass' }` so recruiters can preview their own interviews regardless of invite_only or expiry.

## 6. Register-Call Token Gate

- [x] 6.1 Modify `src/app/api/register-call/route.ts` to accept optional `invite_token`, `interview_id`, and `candidate_email` in request body
- [x] 6.2 If `invite_only=true` and no `invite_token`: return 403 `{ error: 'invite-required' }`
- [x] 6.3 If `invite_token` present: call `InviteService.getInviteByToken`; if not found/revoked/used/expired → 403 with the corresponding code
- [x] 6.4 If invite found: call `InviteService.markInviteReserved`; if returns `already-reserved` → 409 `{ error: 'invite-already-used' }`
- [x] 6.5 Validate invite email against the candidate's submitted email (case-insensitive + trimmed); mismatch → 403 `{ error: 'invite-email-mismatch' }`. **This is the ONLY place email-mismatch is enforced** (ENG1).
- [x] ~~6.6~~ → **Implemented as part of INVITE_ID_THREADING_ATOMIC. The register-call response now includes `invite_id: string | null`.**

> Slice 2 note: register-call also implements **owner bypass** (OD2) — Clerk-authenticated owner skips all token gates, mirroring validate-access.

## 6A. INVITE_ID_THREADING_ATOMIC (ENG2 — ship as one PR)

> **WARNING: Do NOT mark any sub-step done in isolation — the entire chain ships in one PR. Partial completion silently breaks invite tracking because `markInviteUsed` no-ops when `response.invite_id` is null.**

This group consolidates the end-to-end chain that threads `invite_id` from `/api/register-call` through to the `call_started` webhook. All six touchpoints must be edited together. **Slice 2 lands 4 of 6 touchpoints; the remaining 2 (client-side payload + manual verification) land in slice 3. The chain is still atomic across the same feature branch before merge.**

- [x] `src/app/api/register-call/route.ts` — response shape from this route includes `invite_id: string | null` (the invite row's id after reservation, or null for non-invite flows)
- [x] `src/types/response.ts` — added `invite_id: string | null` to the Response type. The corresponding DB column is added by migration task 1.6.
- [ ] `src/components/call/index.tsx` line 1214 — the `createResponse` payload includes `invite_id` sourced from the `/api/register-call` response body **(slice 3)**
- [x] `src/services/responses.service.ts` (`createResponse`) — accepts and persists `invite_id` automatically via existing `Partial<Response>` signature (no code change needed — type-driven).
- [x] `src/app/api/response-webhook/route.ts` — on `call_started`, call `InviteService.markInviteUsed(call_id)` which looks up `response.invite_id` via `call_id` and marks the invite used.
- [ ] **Manual verification step:** After completing a real end-to-end flow with a token, confirm (a) `response.invite_id` is populated in the DB, and (b) the matching `interview_invites.used_at` is set after the `call_started` webhook fires. **(slice 3 / post-deploy)**

> Original tasks 6.6, 11.1, and the `invite_id`-related part of 2.4 are subsumed here. See the redirects on those tasks.

## 7. Webhook: Mark Invite Used

- [x] 7.1 In `src/app/api/response-webhook/route.ts`, extended the `call_started` handler to call `InviteService.markInviteUsed(call_id)` (the service does the response.call_id → response.invite_id → interview_invites join internally).
- [x] 7.2 `markInviteUsed` is non-fatal — internally catches Supabase errors with `console.warn` and returns void; the webhook awaits without try/catch and continues to return 200 to Retell.

## 8. Rotate Public Token API Route

- [x] 8.1 Create `src/app/api/interviews/[id]/rotate-public-token/route.ts` as a Clerk-authenticated POST route
- [x] 8.2 Verify the authenticated user owns the interview (`interview.user_id === userId`); 401 if no session, 403 if not owner, 404 if interview not found
- [x] 8.3 Call `InterviewService.rotatePublicToken(id)`; return `{ public_token, public_token_expires_at }`

## 9. Invite Management API Routes

- [x] 9.1 Create `src/app/api/interviews/[id]/invites/route.ts` with GET (list) and POST (create) handlers; both require Clerk auth + interview ownership.
- [x] 9.2 POST: parse `{ email }` from body; validate format (non-empty, contains `@`); call `InviteService.createInvite`; return the invite row + derived status. (Shareable URL construction deferred to the dashboard UI in slice 3 — it has the base URL via `getServerBaseUrl` / request context.)
- [x] 9.3 GET: call `InviteService.listInvitesForInterview`; enrich each row with `deriveInviteStatus`; return `{ invites: [...] }`.
- [x] 9.4 Create `src/app/api/interviews/[id]/invites/[token]/route.ts` with DELETE handler (revoke); requires Clerk auth + interview ownership. The dynamic segment is named `[token]` for URL aesthetic but the caller passes the invite's row id (returned by the list endpoint).
- [x] 9.5 DELETE: call `InviteService.revokeInvite(inviteId)`; return `{ ok: true }`.

## 10. Candidate Page: Token-Aware Preflight

- [ ] 10.1 In `src/app/(user)/call/[interviewId]/page.tsx`, read `?token=` from `searchParams` and pass to client component
- [ ] 10.2 On mount in the client component (or in a useEffect before rendering PreflightView), call `/api/validate-access` with `{ interviewId, token }` (no email — email is not yet known at this point and is NOT sent to validate-access per ENG1)
- [ ] 10.2a Between page mount and the `/api/validate-access` response, render the existing `LoadingSurface` component (reuse the component already used during the interview fetch in `src/app/(user)/call/[interviewId]/page.tsx` — no new copy, no new component). The loading state is replaced by the appropriate surface once the validate-access response arrives.
- [ ] 10.3 Create `ExpiredLinkSurface` component (calm exceptional-state shell, consistent with existing StatusSurface variants at lines 206-213)
- [ ] 10.4 Create `InviteRequiredSurface` component
- [ ] 10.5 Create `InviteInvalidSurface` component (covers `invite-invalid`, `invite-expired`, `invite-already-used` states)
- [ ] 10.6 Create `InviteEmailMismatchSurface` component with the following fixed content: headline "This invite is for a different email"; body "The email you entered doesn't match the invite. Double-check the email you received the invite at, or contact the recruiter."; primary button "Try a different email"; no secondary CTA. (Note: this surface is triggered by a `register-call` 403 with `error: "invite_email_mismatch"`, NOT by a validate-access response — per ENG1.)
- [ ] 10.7 Wire access-state to surface rendering: non-`valid` validate-access state → render appropriate surface; `valid` → proceed to existing PreflightView. Additionally, in the `<Call>` component (or its caller in the candidate page), handle the `register-call` POST 403 with `error: "invite_email_mismatch"` by switching the rendered view to `<InviteEmailMismatchSurface>`. This is the only path that surfaces email mismatch (ENG1).
- [ ] 10.7a Wire the "Try a different email" button in `InviteEmailMismatchSurface`: clicking the button SHALL re-mount `PreflightView` with the `email` field cleared to `""` and the `name` field preserved from the prior submission. Implement by lifting the preflight form state (`name`, `email`) into the parent `<Call>` component or candidate page, exposing a reset callback that `InviteEmailMismatchSurface` calls via prop.
- [ ] 10.8 In `src/components/call/index.tsx`, thread `inviteToken` prop through `startConversation` and include in the `/api/register-call` request body

## 11. Response Row: Store invite_id

- [ ] ~~11.1~~ → **Merged into INVITE_ID_THREADING_ATOMIC (task group 6A). Do NOT implement this in isolation.**

## 12. Dashboard: Edit Form Toggle

- [ ] 12.1 Add `invite_only` Switch to `src/components/dashboard/interview/editInterview.tsx` using same pattern as `is_anonymous` switch
- [ ] 12.2 Disable the `invite_only` switch (with tooltip "Disable Anonymous to use invite-only mode") when `is_anonymous=true` — OD1 resolved: combination is disallowed
- [ ] 12.3 Wire toggle to `InterviewService.updateInviteOnlyFlag` on change
- [ ] 12.4 When `is_anonymous` is toggled ON while `invite_only` is already ON, show a confirmation dialog: "Enabling anonymous mode will turn off invite-only. Continue?" — on confirm, set `invite_only=false` server-side before setting `is_anonymous=true`

## 13. Dashboard: Share Popup Enhancements

- [ ] 13.1 In `src/components/dashboard/interview/sharePopup.tsx`, extend the "Share link" tab to display `public_token_expires_at` as a human-readable time-remaining label
- [ ] 13.2 Add "Rotate link" button that, when clicked, shows an `AlertDialog` (shadcn/ui, matching the delete-interview pattern in the codebase) with: title "Rotate public link?"; description "This invalidates the current link for any new candidate. Anyone who already started an interview will continue uninterrupted, but new visitors with the old link will see an expired state. You'll need to share the new link manually."; Cancel button (default styling); Confirm button (destructive variant, label "Rotate link"). On confirm, call `POST /api/interviews/[id]/rotate-public-token` and refresh the displayed link + expiry.
- [ ] 13.3 Show expired state for the share link section when `public_token_expires_at < NOW()`
- [ ] 13.4 Add "Invites" tab to the share popup. The tab is NOT gated by `invite_only` — it is always visible and always shows the send-invite form. Include a small info note below the tab label or at the top of its content: "Invites work regardless of invite-only mode. Enable invite-only in the interview settings to require an invite."
- [ ] 13.5 Render invite list in the Invites tab: email, status badge (Pending / Reserved / Used / Expired / Revoked), expiry, copy-link button, and conditional revoke button. Revoke button behavior by status:
  - `pending`: single-click revoke, no dialog
  - `reserved`: show `AlertDialog` before revoking — "Revoke this invite? A candidate may be partway through entering the interview. Revoking will prevent them from starting if they haven't yet, but won't interrupt an active session." with Cancel and a Confirm button
  - `used`: revoke button is hidden or disabled
  - `expired`: single-click revoke, no dialog (cleanup only)
  - Empty state (zero invites): render inline message "No invites sent yet. Send one above to track individual candidates."
- [ ] 13.6 Wire create/revoke to the invite management API routes (9.1–9.5)
- [ ] 13.7 Fetch invite list on tab open; refresh after create/revoke actions

## 14. Interview Creation: Public Token Initialization

- [ ] 14.1 Verify `src/app/api/create-interview/route.ts` sets `public_token` and `public_token_expires_at` on new interview creation (task 4.3 implementation verification and any missing wiring)

## 15. Validation and Edge Cases

- [ ] 15.1 Verify atomic reserve query in `markInviteReserved` (single UPDATE WHERE `reserved_at IS NULL`) cannot result in double-reservation under concurrent requests
- [ ] 15.2 Verify `validate-access` handles missing/null `public_token` gracefully (e.g., interview created before migration without a token)
- [ ] 15.3 Test rotation end-to-end: rotate token → old URL rejected → new URL accepted → ongoing response row unaffected
- [ ] 15.4 Test invite lifecycle: create → copy link → candidate uses → reserved → call_started → used
- [ ] 15.5 Test 409 on double-registration attempt with the same invite token

## 16. OD1 — Anonymous + Invite-Only Incompatibility Validation (server + client)

- [ ] 16.1 In `src/services/interviews.service.ts`, add a guard in `updateInviteOnlyFlag`: if `inviteOnly=true`, fetch the interview and return a 422 error response if `is_anonymous=true` (error: `'invite-only-incompatible-with-anonymous'`)
- [ ] 16.2 Add the same guard at interview-creation time in `src/app/api/create-interview/route.ts`: if both `invite_only=true` and `is_anonymous=true` are submitted, return 422
- [ ] 16.3 In `editInterview.tsx`, disable the `invite_only` switch when `is_anonymous` is `true`; attach tooltip: "Disable Anonymous to use invite-only mode"
- [ ] 16.4 In `editInterview.tsx`, when `is_anonymous` is toggled ON while `invite_only` is already ON, show a confirmation dialog: "Enabling anonymous mode will turn off invite-only. Continue?" — on confirm, call `updateInviteOnlyFlag(false)` before `updateIsAnonymous(true)`; on cancel, leave both flags unchanged
- [ ] 16.5 Add test cases: (a) server rejects `updateInviteOnlyFlag(true)` on anonymous interview with 422; (b) client disables switch when `is_anonymous=true`; (c) confirmation dialog flow

## 17. OD2 — Owner Bypass in validate-access and register-call

- [ ] 17.1 In `src/app/api/validate-access/route.ts`, before any token-gate logic, check for an authenticated Clerk session; if the session user matches `interview.user_id`, return `{ state: 'valid', access_mode: 'owner_bypass' }` immediately — no token required
- [ ] 17.2 In `src/app/api/register-call/route.ts`, apply the same owner-bypass check: if the authenticated Clerk user is the interview owner, skip the invite-only gate and proceed directly to Retell registration
- [ ] 17.3 Update `AccessState` union in `src/types/invite.ts` to include `access_mode?: 'owner_bypass'` on the valid response shape
- [ ] 17.4 In the candidate page client component, detect `access_mode=owner_bypass` from the `validate-access` response and render a non-blocking banner: "Viewing as owner — gate bypassed"
- [ ] 17.5 Add test scenarios: (a) owner authenticated → bypass granted; (b) different authenticated user → treated as candidate, no bypass; (c) unauthenticated + invite_only → blocked normally

## 18. OD3 — Access Control Constants File and 24h TTL Enforcement

- [ ] 18.1 Create `src/lib/access-control-constants.ts` with `export const INVITE_TTL_HOURS = 24;` and any related constants (e.g., `PUBLIC_TOKEN_TTL_HOURS = 24`)
- [ ] 18.2 Update `src/services/invites.service.ts` to import `INVITE_TTL_HOURS` from the constants file and use it in `createInvite` when computing `expires_at` (no magic number inline)
- [ ] 18.3 Verify no configurable-TTL UI exists in the invite creation form — the form SHALL show "Expires in 24 hours" as a static label only; remove any TTL input if present
- [ ] 18.4 Verify `interview_invites.expires_at` is always set by the service (not by DB default) so the constant is the single source of truth; update schema if needed to remove any conflicting DB-level default for `expires_at`
