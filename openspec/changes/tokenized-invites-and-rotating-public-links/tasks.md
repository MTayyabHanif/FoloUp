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

- [x] 10.1 Read `?token=` from `searchParams` in `src/app/(user)/call/[interviewId]/page.tsx` and pass through to the new validate-access flow.
- [x] 10.2 Call `/api/validate-access` with `{ interviewId, token }` in a useEffect once interview is fetched and active. No email is sent (ENG1).
- [x] 10.2a Reuse existing `LoadingSurface` while `accessChecking` is true (or `accessError`).
- [x] 10.3 `ExpiredLinkSurface` created in `src/components/call/accessSurfaces.tsx` (matches the visual language of `StatusSurface`).
- [x] 10.4 `InviteRequiredSurface` created in the same file.
- [x] 10.5 `InviteInvalidSurface` created — covers `invite-invalid`, `invite-expired`, `invite-already-used` states (single component, generic copy).
- [x] 10.6 `InviteEmailMismatchSurface` created with required copy + "Try a different email" button.
- [x] 10.7 Access-state routing wired in the candidate page: non-valid states → corresponding surface; valid → render `<Call>` with `inviteToken` prop. The `<Call>` component handles register-call 403 (`invite-email-mismatch`) by setting `inviteEmailMismatch=true` and rendering `<InviteEmailMismatchSurface>` in place of `<PreflightView>`.
- [x] 10.7a "Try a different email" button calls `onTryDifferentEmail` which resets `email` + `isValidEmail` but preserves `name`. Re-renders `PreflightView` via the existing condition.
- [x] 10.8 `inviteToken` threaded through `<Call>` → `startConversation` → request body `{ invite_token, interview_id, candidate_email }`.

> Slice 3 note: Owner bypass also surfaces an `OwnerPreviewBanner` above the Call view when `access_mode === "owner_bypass"` (OD2).

## 11. Response Row: Store invite_id

- [x] ~~11.1~~ → Implemented as part of INVITE_ID_THREADING_ATOMIC. `createResponse` now receives `invite_id` from the register-call response.

## 12. Dashboard: Edit Form Toggle

- [x] 12.1 Added `invite_only` Switch to `editInterview.tsx` using the same `Switch` pattern as `is_anonymous`.
- [x] 12.2 Disabled the `invite_only` switch when `is_anonymous=true` with helper copy "Disable Anonymous to use invite-only mode" (OD1).
- [x] 12.3 Toggle state is persisted via the existing `onSave` payload (`invite_only` field appended). Server-side guard is `InterviewService.updateInviteOnlyFlag` which throws `InviteOnlyAnonymousConflictError` on attempted invalid combination.
- [x] 12.4 When `is_anonymous` is toggled ON while `invite_only` is ON, show an `AlertDialog` ("Turn off invite-only mode?") — Confirm flips both flags client-side; Cancel leaves both flags as-is. The actual server write happens on Save.

## 13. Dashboard: Share Popup Enhancements

- [x] 13.1 "Share link" tab displays a human-readable time-remaining label derived from `public_token_expires_at` (e.g. "Expires in 23h 14m" or "Expires in 30 days" for grandfathered rows).
- [x] 13.2 "Rotate link" button with destructive `AlertDialog` (matches the operator-locked copy from DD2). On confirm, POSTs to `/api/interviews/[id]/rotate-public-token` and updates the displayed URL + expiry in-place.
- [x] 13.3 Expired state is surfaced via the expiry label text + `text-[#6b3f31]` warning color.
- [x] 13.4 **Refactored (slice 4a):** The Invites tab in `sharePopup.tsx` was too cramped for what will become a long list (plus future CSV upload). Invite management was moved to a dedicated page at `src/app/(client)/interviews/[interviewId]/invites/page.tsx`. `sharePopup.tsx` now contains only "Share link" and "Embed" tabs and a "Manage invites →" link that routes to the new page. A "Manage invites" entry was added to the HeaderActions dropdown.
- [x] 13.5 Invite list renders on the dedicated page with email, status badge (Pending / Reserved / Used / Expired / Revoked), created-at timestamp, expiry countdown, copy-link button (for pending), and conditional revoke. Revoke behavior unchanged:
  - `pending`: single-click trash icon, no dialog
  - `reserved`: opens an `AlertDialog` before revoking
  - `used`: revoke button hidden
  - `expired`: single-click trash icon, no dialog
  - Empty state: "No invites sent yet" + helper copy pointing to the right-rail create form.
- [x] 13.6 Create/revoke wired to `POST /api/interviews/[id]/invites` and `DELETE /api/interviews/[id]/invites/[id]` respectively.
- [x] 13.7 Invite list is fetched on page mount and refreshes optimistically after create/revoke actions.

> Slice 3 callers note: `SharePopup` now requires `interviewId`, `publicToken`, and `publicTokenExpiresAt` props. The only caller (`src/app/(client)/interviews/[interviewId]/page.tsx`) updated to pass them.

> Slice 4a additions:
> - **Filter chips** at the top of the dedicated page (All / Pending / Reserved / Used / Expired / Revoked) with live counts.
> - **Search by email** input alongside the filter chips.
> - **Tabular layout** with column headers (Candidate email / Status / Created / Expires / Actions) and zebra-striped rows — scales to long lists.
> - **Bulk import stub** (right rail, dashed border, "coming soon" copy) reserving design space for the future CSV upload feature mentioned by the operator. No code in the stub — purely visual placeholder.
> - **Inline empty/loading/filtered-empty states** rather than separate components.

## 14. Interview Creation: Public Token Initialization

- [x] 14.1 Confirmed — `src/app/api/create-interview/route.ts` mints `public_token = crypto.randomUUID()` and `public_token_expires_at = NOW() + 24h` on every new interview (slice 2 task 4.3).

## 15. Validation and Edge Cases (deferred to QA phase)

These are end-to-end verification steps the QA pass executes against the running app after the migration is applied. Not implementation tasks.

- [ ] 15.1 Verify atomic reserve query in `markInviteReserved` cannot double-reserve under concurrent requests — exercised by QA via two parallel register-call requests with the same token.
- [ ] 15.2 Verify `validate-access` handles missing/null `public_token` gracefully — covered by code path (`interview.public_token && token === ...`) but QA verifies live.
- [ ] 15.3 End-to-end rotation: rotate token → old URL → expired/invalid; new URL → valid; ongoing response unaffected.
- [ ] 15.4 End-to-end invite lifecycle: create → copy link → candidate consumes → reserved → call_started webhook → used.
- [ ] 15.5 409 on double-registration with the same invite token.

## 16. OD1 — Anonymous + Invite-Only Incompatibility Validation

- [x] 16.1 `InterviewService.updateInviteOnlyFlag` throws `InviteOnlyAnonymousConflictError` (HTTP-mappable: status=422, code=`invite_only_anonymous_conflict`) if `inviteOnly=true` and `is_anonymous=true`. Slice 2.
- [x] 16.2 `/api/create-interview` rejects payload where both `invite_only=true` and `is_anonymous=true` with 422 (`invite-only-incompatible-with-anonymous`). Slice 4a follow-up.
- [x] 16.3 `editInterview.tsx` disables the `invite_only` Switch when `is_anonymous=true` with helper copy. Slice 3.
- [x] 16.4 `editInterview.tsx` confirmation dialog ("Turn off invite-only mode?") wired when toggling `is_anonymous` ON while `invite_only=true`. Slice 3.
- [ ] 16.5 QA verifies the three scenarios live (server 422; disabled switch; dialog flow) — deferred to QA phase.

## 17. OD2 — Owner Bypass

- [x] 17.1 `/api/validate-access` short-circuits to `{ state: 'valid', access_mode: 'owner_bypass' }` when authenticated user is the interview owner. Slice 2.
- [x] 17.2 `/api/register-call` mirrors the owner-bypass behavior (skips all gates). Slice 2.
- [x] 17.3 `AccessMode` (`'public' | 'invite' | 'owner_bypass'`) added to `src/types/invite.ts`. Slice 1.
- [x] 17.4 `OwnerPreviewBanner` rendered above `<Call>` in the candidate page when `access_mode='owner_bypass'`. Slice 3.
- [ ] 17.5 QA verifies the three scenarios live (owner→bypass; different user→treated as candidate; unauth + invite_only → blocked).

## 18. OD3 — 24h Hard Cap TTL Enforcement

- [x] 18.1 `src/lib/access-control-constants.ts` exports `INVITE_TTL_HOURS = 24` and `PUBLIC_TOKEN_TTL_HOURS = 24` (and `PUBLIC_TOKEN_GRANDFATHER_DAYS = 30` for the migration backfill). Slice 1.
- [x] 18.2 `InviteService.createInvite` uses `INVITE_TTL_HOURS` constant; `InterviewService.rotatePublicToken` uses `PUBLIC_TOKEN_TTL_HOURS`. Slice 1/2.
- [x] 18.3 No configurable-TTL UI exists. The dedicated invites page only displays "Each invite expires in 24 hours" as static copy. Slice 4a.
- [x] 18.4 `interview_invites.expires_at` is NOT NULL with no DB default; service is the single source of truth. Confirmed in `supabase_schema.sql` and `migration.sql`. Slice 1.
