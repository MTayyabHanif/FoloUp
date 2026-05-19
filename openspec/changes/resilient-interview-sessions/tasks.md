## 1. Schema Migration

- [ ] 1.1 Edit `supabase_schema.sql`: add `ALTER TABLE response ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ongoing'`
- [ ] 1.2 Edit `supabase_schema.sql`: add `ADD COLUMN IF NOT EXISTS disconnection_reason text`
- [ ] 1.3 Edit `supabase_schema.sql`: add `ADD COLUMN IF NOT EXISTS questions_covered integer`
- [ ] 1.4 Edit `supabase_schema.sql`: add `ADD COLUMN IF NOT EXISTS last_active_at timestamptz`
- [ ] 1.5 Edit `supabase_schema.sql`: add `ADD COLUMN IF NOT EXISTS session_token uuid`
- [ ] 1.6 Add backfill SQL comment block in `supabase_schema.sql` explaining the two-step UPDATE for `is_ended = true → completed` and old orphaned rows → `interrupted`
- [ ] 1.7 Document in `supabase_schema.sql` that the operator must apply this migration manually via the Supabase SQL editor (no migrations folder exists)
- [ ] 1.8 Add `CREATE UNIQUE INDEX IF NOT EXISTS response_session_token_idx ON response(session_token) WHERE session_token IS NOT NULL` (enforces token uniqueness + speeds up `getResponseBySessionToken` lookups on the critical reconnect path)

## 2. Type Updates

- [ ] 2.1 Add `export type ResponseStatus = 'ongoing' | 'completed' | 'interrupted' | 'abandoned'` to `src/types/response.ts`
- [ ] 2.2 Add `status: ResponseStatus`, `disconnection_reason: string | null`, `questions_covered: number | null`, `last_active_at: string | null`, `session_token: string | null` to the `Response` interface in `src/types/response.ts`
- [ ] 2.3 Add the 5 new fields to the `response` table's `Row` type in `src/types/database.types.ts`
- [ ] 2.4 Add the 5 new fields (all optional / nullable) to the `Insert` type in `src/types/database.types.ts`
- [ ] 2.5 Add the 5 new fields (all optional / nullable) to the `Update` type in `src/types/database.types.ts`

## 3. API: register-call

- [ ] 3.1 Import `randomUUID` from `"crypto"` in `src/app/api/register-call/route.ts`
- [ ] 3.2 Generate `const sessionToken = randomUUID()` after successful Retell call creation
- [ ] 3.3 Include `session_token: sessionToken` in the JSON response payload alongside `registerCallResponse`
- [ ] 3.4 Extend the `createResponse` payload at `call/index.tsx:293` to include `session_token: sessionToken`, `status: 'ongoing'`, and `last_active_at: new Date().toISOString()` — without `last_active_at` on insert, `check-session.withinWindow` is always false (eng-review C2)

## 4. API: check-session

- [ ] 4.1 Create `src/app/api/check-session/route.ts` as a GET handler
- [ ] 4.2 Accept `token` from URL `searchParams`; return 400 if missing
- [ ] 4.3 Query `response` table by `session_token = token`; return `{ exists: false, withinWindow: false, status: null, callId: null, responseId: null }` if not found
- [ ] 4.4 Return `{ exists: true, withinWindow: bool, status: row.status, callId: row.call_id, responseId: row.id }` where `withinWindow` is `row.last_active_at > now() - interval '60 seconds'` AND `row.status = 'ongoing'`. Anchor decision: the 60s window is measured from `last_active_at` (NOT `created_at`) so heartbeats during an active call keep the window fresh; once `call_ended` writes `last_active_at = now()` it caps the window from that moment forward (eng-review R3 + drift item 7)

## 5. API: response-heartbeat

- [ ] 5.1 Create `src/app/api/response-heartbeat/route.ts` as a PATCH handler
- [ ] 5.2 Accept `{ call_id, tab_switch_count }` in request body
- [ ] 5.3 Run `UPDATE response SET last_active_at = now(), tab_switch_count = $1 WHERE call_id = $2 AND status = 'ongoing'` (no-op if row is no longer ongoing)
- [ ] 5.4 Return 200 OK (even if the UPDATE was a no-op — client doesn't need to distinguish)
- [ ] 5.5 On the client side, use `navigator.sendBeacon('/api/response-heartbeat', JSON.stringify(payload))` (or `fetch(..., { keepalive: true })` fallback) when firing the heartbeat from a `visibilitychange → hidden` or `pagehide` handler; a regular `fetch` is killed when the browser tears the page down, losing the final tab_switch_count write (eng-review R5)

## 6. API: response-webhook

- [ ] 6.1 Add `case "call_ended":` block in `src/app/api/response-webhook/route.ts`
- [ ] 6.2 Inside `call_ended`: call `retell.call.retrieve(call.call_id)` to get `disconnection_reason` and `duration`
- [ ] 6.3 Implement status mapping function: `agent_hangup`/`max_duration_reached`/`inactivity` → `'completed'`; `user_hangup` with duration ≥ 30s → `'completed'`; `user_hangup` with duration < 30s → `'interrupted'`; `registered_call_timeout` → `'abandoned'`; `error_*`/`concurrency_limit_reached` → `'interrupted'`; all others → `'interrupted'`
- [ ] 6.4 Issue an ATOMIC conditional UPDATE for `call_ended`: `supabase.from('response').update({ status, disconnection_reason, is_ended: status === 'completed', last_active_at: new Date().toISOString() }).eq('call_id', call.call_id).eq('status', 'ongoing')` — must be a single Supabase call with both `.eq()` conditions, NOT a read-then-write (eng-review C1: TOCTOU race on webhook retries). Inspect `data.length` / `rowCount` after; log `info` on rowCount=1 (closed), `debug` on rowCount=0 (already closed, no-op)
- [ ] 6.5 Use the new `saveResponseConditional` helper (task 9.5) from `call_ended` rather than inlining the Supabase chain — keeps the data-access surface in one place
- [ ] 6.6 In `call_analyzed` handler: after existing analytics logic, fetch `interview.question_count` (use `InterviewService.getInterviewById(stored.interview_id)`) and compute `questions_covered` = count of `transcript_object` entries where `role === 'user'` and `content.trim().length > 20`, capped at `interview.question_count`
- [ ] 6.7 Write `questions_covered` to the response row inside the `call_analyzed` `saveResponse` call

## 7. Client Call Component

- [ ] 7.1 Widen `InterviewProps` in `src/components/call/index.tsx` to accept `sessionToken?: string`
- [ ] 7.2 On mount, if `sessionToken` prop is present, call GET `/api/check-session?token=<sessionToken>`
- [ ] 7.3 If `withinWindow = true` AND `status = 'ongoing'`: set reconnect UI state, skip email/name entry form, skip `createResponse`, call `registerCall`. Use the `callId` and `responseId` returned from `check-session` (eng-review R3) to update the existing row: `updateResponse({ call_id: newCallId, last_active_at: new Date().toISOString() }, oldCallId)` where `oldCallId = response.callId from check-session`
- [ ] 7.4 If session is expired or status is not ongoing: display "Your session has ended" UI and clear the `?session=` param from the URL
- [ ] 7.5 After `webClient.startCall()` succeeds on a normal (non-reconnect) flow: call `router.replace` to append `?session=<sessionToken>` to the URL without a page reload
- [ ] 7.5b On `isEnded` becoming true (normal completion), call `router.replace` to strip `?session=` from the URL so the completion / feedback screen doesn't expose a stale token in the address bar (drift item 2)
- [ ] 7.6 Remove `saveResponse({ is_ended: true, tab_switch_count })` from the `isEnded` useEffect — webhook now owns end-state
- [ ] 7.7 Replace tab-switch `saveResponse` call with a PATCH to `/api/response-heartbeat` carrying `{ call_id, tab_switch_count }` — and use `navigator.sendBeacon` on `visibilitychange → hidden` / `pagehide` (see 5.5)
- [ ] 7.8 Skip the `getAllEmails` / `oldUserEmails` check entirely when `sessionToken` is present and `check-session` returns `withinWindow = true`

## 8. Public Call Route

- [ ] 8.1 Add `session?: string` to the `searchParams` type in `src/app/(user)/call/[interviewId]/page.tsx`
- [ ] 8.2 Unwrap `searchParams` via `use()` (or await) and pass `session` down to `<InterviewInterface>`
- [ ] 8.3 Pass `session` as `sessionToken` prop into `<Call interview={interview} sessionToken={session} />`

## 9. Responses Service

- [ ] 9.1 Replace the `getAllResponses` filter in `src/services/responses.service.ts`: drop both `.eq('is_ended', true)` AND the legacy `.or('details.is.null, details->call_analysis.not.is.null')` clause (the OR-clause was a workaround for `is_ended`-only rows missing analysis; status now expresses lifecycle directly). New filter: `.in('status', ['completed', 'interrupted', 'ongoing'])`. The client-side "Include in-progress" toggle (task 10.5) decides whether `ongoing` is rendered (eng-review R2)
- [ ] 9.2 Add `updateResponseStatus(callId: string, payload: { status: ResponseStatus; disconnection_reason?: string; is_ended?: boolean; last_active_at?: string })` helper to `responses.service.ts`
- [ ] 9.3 Add `getResponseBySessionToken(token: string)` helper to `responses.service.ts` (SELECT from `response WHERE session_token = token`)
- [ ] 9.4 Update `generate-insights/route.ts` to additionally filter by `is_analysed = true` when fetching responses (do not let `ongoing` rows reach the LLM)
- [ ] 9.5 Add `saveResponseConditional(payload: Partial<Response>, callId: string, guard: { column: keyof Response; value: unknown })` helper to `responses.service.ts` — issues `.update(payload).eq('call_id', callId).eq(guard.column, guard.value)` and returns `{ updated: rowCount > 0 }`. Used by the `call_ended` webhook (task 6.5) to write end-state atomically only when `status = 'ongoing'` (eng-review R1)

## 10. Dashboard Sidebar UI

- [ ] 10.1 In `src/app/(client)/interviews/[interviewId]/page.tsx` response list (lines ~454-520): import a badge/dot component (or inline Tailwind) for status indicators
- [ ] 10.2 Render a pulsing amber dot badge next to candidate name for `response.status === 'ongoing'`
- [ ] 10.3 Render a red "Interrupted" badge next to candidate name for `response.status === 'interrupted'`
- [ ] 10.4 Add an "Include in-progress" toggle (boolean local state) above the response list
- [ ] 10.5 When toggle is OFF (default): filter the displayed list to `status IN ('completed', 'interrupted')`; when toggle is ON: also include `'ongoing'` rows

## 11. CallInfo Detail Panel

- [ ] 11.1 In `src/components/call/callInfo.tsx`: after loading the response via `getResponseByCallId`, also fetch `interview.question_count` via `InterviewService.getInterviewById(response.interview_id)`
- [ ] 11.2 Display "X of Y questions covered" when `response.questions_covered !== null`; display "–" when null
- [ ] 11.3 Display humanized `disconnection_reason` label (build a small mapping: `user_hangup` → "User Hangup", `agent_hangup` → "Agent Hangup", `error_*` → "Network Error", `max_duration_reached` → "Time Limit Reached", `inactivity` → "Inactivity", `registered_call_timeout` → "Timed Out", others → the raw value)
- [ ] 11.4 Only show the disconnection reason section if `response.disconnection_reason` is not null

## 12. Race and Idempotency Guards

- [ ] 12.1 The `call_ended` idempotency guard is the atomic `.eq('status', 'ongoing')` filter on the UPDATE itself (see task 6.4 / 6.5 / 9.5) — NOT a separate pre-read; the single Supabase call is the entire guard
- [ ] 12.2 Keep the existing `if (stored?.is_analysed) break;` guard in `call_analyzed` as-is (do NOT add a separate `questions_covered` guard) — `is_analysed` flips to `true` atomically with the analytics write, so guarding on it correctly covers `questions_covered` re-computation on webhook retries. Guarding on `questions_covered` itself would re-compute for calls with 0 substantive turns (falsy value) (eng-review R4)
- [ ] 12.3 In `/api/response-heartbeat`: confirm the conditional UPDATE targets `status = 'ongoing'` so it is a no-op after the call ends
- [ ] 12.4 In `createResponse` call site in `call/index.tsx`: check that the return value is non-null before attempting reconnect path mutations (fail-safe if DB insert fails)

## 13. Manual QA Scenarios

- [ ] 13.1 **Clean end**: Candidate completes interview → `status = 'completed'`, `disconnection_reason = 'agent_hangup'`, dashboard shows no badge, `questions_covered` populated after analysis
- [ ] 13.2 **Tab close + reconnect within 60s**: Candidate closes tab → reopens URL with `?session=<token>` within 60s → reconnect succeeds, new Retell call started, same response row updated with new `call_id`, interview resumes
- [ ] 13.3 **Tab close + reconnect after 60s**: Same as above but reload happens after 60s → "Your session has ended" UI shown, row shows `status = 'interrupted'` after webhook fires
- [ ] 13.4 **Network drop**: Retell fires `call_ended` with `error_*` reason → row gets `status = 'interrupted'`, dashboard sidebar shows red "Interrupted" badge
- [ ] 13.5 **user_hangup**: Candidate presses hang up button mid-interview → `status = 'interrupted'` if < 30s, `status = 'completed'` if ≥ 30s; `disconnection_reason = 'user_hangup'` shown in callInfo
- [ ] 13.6 **agent_hangup**: Retell agent ends the call normally → `status = 'completed'`, `is_ended = true`, no badge in dashboard, full analytics populated after `call_analyzed`

## 14. Design: Reconnect UI States (from design review)

- [ ] 14.1 **Welcome-back banner**: When `check-session` returns `withinWindow = true`, render a banner above the call UI: headline "Welcome back, [name]" + body "Reconnecting to your interview..." with a spinner. Do NOT auto-skip to the active call immediately — show this for ~1 second minimum so the candidate knows they're in the right place.
- [ ] 14.2 **"Resume Interview" confirmation button**: After the banner appears and the Retell call is registered, show a primary button "Resume Interview" (same theme_color as the original flow) before calling `webClient.startCall()`. This gives the candidate one beat to compose themselves rather than being dropped straight into audio.
- [ ] 14.3 **Session-expired screen**: When `withinWindow = false` (expired token), render: headline "Session window closed", body "Your interview session timed out. Your progress up to that point has been saved. Please contact the recruiter to continue.", and a subtle "Close tab" secondary button. Do NOT use "Your session has ended" (too harsh / sounds permanent). Clear the `?session=` param from URL via `router.replace`.
- [ ] 14.4 **Session-not-found screen**: When `exists = false` (garbage token or never-valid URL), render: headline "Interview link not recognized", body "This link doesn't match an active interview session. Please use the original link from your invitation email.", and a link to the original interview URL if recoverable. This must look visually distinct from the expired screen — different icon (question mark vs clock).
- [ ] 14.5 **Pre-start reload (no token)**: If the page loads with no `?session=` param and `isStarted = false`, show the normal welcome screen — no special UI needed. The plan already handles this correctly.
- [ ] 14.6 **Name pre-fill on reconnect**: When rendering the welcome-back banner, pull `name` from the `check-session` response (via the response row) and render it in the banner. The candidate should see their own name ("Welcome back, Jane") for trust — not a generic "Welcome back".
- [ ] 14.7 **Strip `?session=` on normal completion**: On `isEnded = true` via normal flow, call `router.replace` to remove the `?session=` param from the URL so the completion screen doesn't expose a stale token. (Already in task 7.5b — ensure design state covers this too.)

## 15. Design: Dashboard Status Badges (from design review)

- [ ] 15.1 **Live badge**: Replace pulsing amber dot with a solid green dot (8×8px, `bg-green-500`) + "Live" text label in 11px semibold. Place it in the `shrink-0 items-center gap-1` span at the end of the response row (same slot as the unviewed dot and score circle). Use `aria-label="Live interview in progress"` on the span. Do NOT use pulsing animation for live state — pulsing reads as "error" to most users.
- [ ] 15.2 **Interrupted badge**: Render as a small pill `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">Interrupted</span>` in the same trailing slot. Keep it compact — this row already has name, timestamp, unviewed dot, and score circle.
- [ ] 15.3 **Abandoned badge**: Render `<span class="...bg-gray-100 text-gray-500">Never started</span>` — visually distinct from Interrupted (gray vs red). "Abandoned" is internal terminology; show "Never started" to recruiters.
- [ ] 15.4 **Completed**: No badge. The existing unviewed dot + score circle is sufficient signal. Adding a green "Completed" badge is visual noise.
- [ ] 15.5 **"Include in-progress" toggle default**: Default to ON (true), not OFF. Recruiters actively want to see live sessions happening. Defaulting OFF hides the most time-sensitive information. Place the toggle as a small labeled switch above the response list, right-aligned: `[toggle] Show live sessions`.
- [ ] 15.6 **Abandoned distinction from Interrupted**: `status = 'abandoned'` (registered_call_timeout — candidate opened link but never pressed Start) must render differently from `status = 'interrupted'` (call started then died). Use gray pill "Never started" vs red pill "Interrupted" respectively.

## 16. Design: Coverage Display in CallInfo (from design review)

- [ ] 16.1 **Placement**: Add "X of Y questions covered" as a new metadata row in the info header panel (`bg-slate-200 rounded-2xl` block in `callInfo.tsx`), directly below the candidate name/email block. Use the same font sizing as the "Tab Switching Detected" label: `text-sm font-semibold`.
- [ ] 16.2 **Null state**: When `questions_covered` is null (analysis not yet complete), show `<span class="text-sm text-muted-foreground">Coverage: analyzing...</span>` — not "–" (too terse) and not "0 of N" (misleading).
- [ ] 16.3 **Zero state**: When `questions_covered = 0`, show "0 of N questions covered" with amber color `text-amber-600` to signal low coverage, not a neutral dash. This is meaningful signal — the candidate said nothing substantive.
- [ ] 16.4 **Full coverage**: When `questions_covered >= question_count`, show in green `text-green-600`. For partial, use default text color.
- [ ] 16.5 **Interrupted/abandoned rows**: For `status = 'interrupted'` or `'abandoned'`, pair the coverage display with the disconnection reason on the same line: "2 of 5 questions · Candidate ended the call". Use `·` separator for density.

## 17. Design: Disconnection Reason Humanization (from design review)

- [ ] 17.1 Add a `DISCONNECTION_REASON_LABELS` map in a shared utility file (e.g., `src/lib/disconnectionReasons.ts`) with all 26 Retell values mapped to recruiter-readable labels (see copy library in design review). Import this in `callInfo.tsx` task 11.3 instead of an inline switch.
- [ ] 17.2 For `error_*` values, do NOT collapse them all to "Network Error" — surface the specific type to recruiters who may be diagnosing patterns. Use the full labels from the copy library. Only show the friendlier label in candidate-facing screens (which currently have none — this is recruiter-only).

## 18. Design: Loading States on Reconnect (from design review)

- [ ] 18.1 The reconnect flow has three sequential async operations: (1) `check-session` API call, (2) `register-call` API call, (3) `webClient.startCall()`. Show three distinct micro-states rather than a single spinner: "Checking session..." → "Reconnecting..." → "Starting interview..." with a progress indicator. Use the existing `MiniLoader` component with a text label beneath it.
- [ ] 18.2 Estimated latency display: `check-session` is ~50ms (DB lookup), `register-call` is ~200-500ms (Retell API), `startCall` is ~500-1500ms (WebRTC negotiation). The combined worst case is ~2 seconds on a slow connection. The three-state display prevents the candidate from thinking the page is frozen.

## 19. Design: Accessibility (from design review)

- [ ] 19.1 **Live badge aria-live**: Wrap the live badge span in `<span role="status" aria-live="polite" aria-label="Live interview in progress">` so screen readers announce when a session goes live (on dashboard refresh).
- [ ] 19.2 **Session-expired announcement**: When the session-expired screen renders (task 14.3), wrap the headline in `<h1>` and add `role="alert"` to the container so screen readers announce it immediately without requiring focus.
- [ ] 19.3 **Reconnect button focus**: The "Resume Interview" button (task 14.2) must receive auto-focus on render (`autoFocus` or `ref.current.focus()`) so keyboard-only users don't have to tab to it.
- [ ] 19.4 **Touch targets**: All new badge pills and toggle controls must meet the 44×44px minimum touch target. The pill badges are display-only (non-interactive) so this applies only to the toggle (task 15.5).

## 20. Design: Error States for API Failures (from design review)

- [ ] 20.1 **`check-session` returns 500**: Show "We couldn't verify your session. Please try refreshing, or use your original interview link." with a "Try again" button that retries the `check-session` call once. After a second failure, show the error message with no retry. Do NOT silently fall back to the normal welcome screen (which would re-prompt for name/email on a reconnect path).
- [ ] 20.2 **`register-call` fails on reconnect**: Show "Reconnection failed. Your progress is saved — please try again or contact the recruiter." with a "Try again" button. This is distinct from a fresh-start failure because the candidate has an active session token and should not be re-prompted for identity.
- [ ] 20.3 **`check-session` network offline**: If `fetch` throws (offline), show "You appear to be offline. Please check your connection and reload." Do not show the session-expired screen for what is actually a connectivity failure.

## 21. Manual QA Scenarios — Additional (from design review)

- [ ] 21.1 **Reconnect within window — name pre-fill**: Candidate reloads with `?session=` token within 60s → welcome-back banner shows "Welcome back, [candidate name]" pulled from response row.
- [ ] 21.2 **Garbage token in URL**: Candidate manually edits `?session=abc123garbage` → session-not-found screen shows (task 14.4), distinct from expired screen.
- [ ] 21.3 **`check-session` 500 during reconnect**: Server error on check-session → retry UI shown (task 20.1), not silent fallback to welcome screen.
- [ ] 21.4 **`abandoned` badge vs `interrupted` badge**: Status = 'abandoned' row in dashboard shows gray "Never started" pill; status = 'interrupted' shows red "Interrupted" pill — visually distinguishable.
- [ ] 21.5 **Mobile reconnect**: Candidate on mobile (375px viewport) reloads with session token → welcome-back screen, resume button, and expired screen all render correctly without horizontal overflow.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | See eng-review decisions C1, C2, R1-R5 |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 4/10 → 8/10, 35 decisions added |

**UNRESOLVED:** 0 — all design decisions resolved with chosen defaults and rationale inline.
**VERDICT:** DESIGN REVIEW CLEARED — eng review required before shipping.
