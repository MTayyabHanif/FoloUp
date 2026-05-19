## Context

Candidates occasionally lose connectivity or close their browser tab during an active interview. Currently the `response` table row is created client-side at `createResponse` time with `is_ended: false` and no end reason. When the call terminates unexpectedly, the row is never updated: the `call_ended` webhook case does not exist in `response-webhook/route.ts`, and `getAllResponses` filters `.eq('is_ended', true)` so orphaned rows are invisible in the dashboard. Additionally, the `oldUserEmails` dupe-check permanently blocks any reconnect attempt.

The codebase has no Supabase migrations folder — schema changes are applied manually via the Supabase SQL editor and recorded in `supabase_schema.sql`. The Retell SDK exposes `disconnection_reason` on `WebCallResponse` (returned by `retell.call.retrieve()`), which is not present in the raw webhook body but IS available immediately after `call_ended` fires.

## Goals / Non-Goals

**Goals:**
- Every `response` row transitions through a clear status lifecycle (`ongoing → completed | interrupted | abandoned`).
- Reconnect is possible within a 60-second window via a server-minted session token in the URL query string.
- The dashboard surfaces live and partial sessions with appropriate status indicators.
- The client-side / webhook write-write race on `is_ended` is eliminated.

**Non-Goals:**
- Real-time WebSocket push to the dashboard recruiter view (manual refresh is acceptable for v1).
- Re-attaching to the same Retell call on reconnect (a fresh call is created; same response row is reused).
- A dedicated Supabase migrations folder (not established in this project; manual SQL is the convention).

## Decisions

### D1: Status enum — 4 values, not 7

**Chose:** `ongoing | completed | interrupted | abandoned`

**Rationale:** Five-plus-value enums were considered (e.g., adding `reconnecting`, `paused`) but transient states don't need to be persisted. `reconnecting` is inferred from `ongoing + last_active_at within 60s`; `paused` is out of scope. Four values map cleanly to dashboard badge variants without over-specifying future behavior.

**Alternative rejected:** A binary `is_ended` extension (e.g., adding `is_interrupted`). Two boolean columns create a cross-product of invalid states; a single `status` enum is the correct data model.

### D2: Reconnect strategy — new Retell call, same response row

**Chose:** On reconnect, call `/api/register-call` to create a fresh Retell call, update the existing `response` row's `call_id` to the new value, and skip `createResponse` (so no duplicate row is created).

**Rationale:** Re-attaching to a dead Retell websocket is unreliable — Retell fires `registered_call_timeout` after ~60s, and the websocket is closed. Creating a fresh call is one extra API call and fully predictable. The response row is the unit of a candidate's attempt; reusing it preserves continuity for the recruiter.

**Alternative rejected:** Creating a second `response` row per reconnect attempt. This produces duplicate dashboard entries for a single candidate session and complicates analytics aggregation.

### D3: Session token location — URL query string

**Chose:** `?session=<uuid>` appended client-side via `router.replace()` after `webClient.startCall()` succeeds.

**Rationale:** Cookies add SSR complexity and cross-device confusion. A URL path segment requires Next.js `[interviewId]` route changes and breaks the clean share-able interview link. Query string is stateless, visible to the candidate, easily stripped on final completion, and requires no additional infrastructure.

**Alternative rejected:** `httpOnly` cookie. Secure but unnecessary for a time-limited reconnect token with no elevated privileges.

### D4: `disconnection_reason` write timing — `call_ended` webhook + `retell.call.retrieve()`

**Chose:** Handle the `call_ended` webhook case in `response-webhook/route.ts`. Inside that case, call `retell.call.retrieve(call.call_id)` to read `disconnection_reason`, then write `status`, `disconnection_reason`, and `last_active_at` to the row.

**Rationale:** The `call_analyzed` event fires 30-120 seconds after the call ends (Retell runs its LLM analysis first). For the dashboard to show "interrupted" immediately, the status must be written at `call_ended` time. `disconnection_reason` is available on the `WebCallResponse` object returned by `retrieve()` — confirmed in `retell-sdk` types at `node_modules/retell-sdk/src/resources/call.ts:856-882`. The extra `retrieve()` call costs one API call per session.

**Disconnection reason → status mapping:**
- `agent_hangup`, `max_duration_reached` → `completed`
- `user_hangup` with call duration < 30s → `interrupted`
- `user_hangup` with call duration ≥ 30s → `completed`
- `inactivity` → `completed`
- `registered_call_timeout` → `abandoned`
- `error_*`, `concurrency_limit_reached`, `dial_no_answer` → `interrupted`
- All others → `interrupted` (safe default)

### D5: `questions_covered` — user-turn count during `call_analyzed`

**Chose:** During `call_analyzed`, count `user` turns in `transcript_object` where `content.trim().length > 20`. Cap at `interview.question_count`.

**Rationale:** Transcript is only available after `call_analyzed`. A user-turn count is the cheapest proxy without requiring additional LLM inference. The 20-char threshold filters filler words ("yeah", "um"). Not perfect but sufficient for a "X of Y questions" UX indicator.

### D6: Client stops writing `is_ended`; webhook is sole end-state owner

**Chose:** Remove the `saveResponse({ is_ended: true, tab_switch_count })` call from the client `isEnded` useEffect in `call/index.tsx`. Route `tab_switch_count` updates through a lightweight `/api/response-heartbeat` PATCH endpoint. The webhook owns all end-state writes.

**Rationale:** The write-write race (client and webhook both updating the same row within milliseconds of each other) can produce `is_ended = true` on a row where the webhook would have written `status = 'interrupted'` and `is_ended = false`. Establishing a single writer eliminates the race entirely without needing distributed locks.

**`last_active_at` update cadence:** Written at `createResponse` time (call start), updated by `/api/response-heartbeat` on tab-switch events (carries `tab_switch_count` too), and final-written by the `call_ended` webhook. The reconnect window is anchored to `last_active_at`, not `created_at` — so heartbeats during an active call keep the window fresh, and once `call_ended` writes `last_active_at = now()` it caps the window from that moment forward (60s from disconnect, not 60s from start). Periodic time-based heartbeats are NOT used; the only writers are tab-visibility events (via `navigator.sendBeacon` on tab-hide to survive page teardown) and the webhook.

### D7: `getAllResponses` filter change

**Chose:** Replace `.eq('is_ended', true)` with `.in('status', ['completed', 'interrupted', 'ongoing'])`. The `generate-insights` route is adjusted separately to only include rows with `is_analysed = true`.

**Rationale:** The `is_ended` boolean excludes all non-completed rows. The `status` field gives precise control. The `generate-insights` route must not receive `ongoing` rows (no transcript yet), so it retains an additional `is_analysed = true` filter rather than relying on `status`.

## Risks / Trade-offs

**[Race: double-reconnect within 60s]** → Two browser tabs both see `status = 'ongoing'` and `last_active_at` within window. Both call `/api/register-call` and get different Retell call IDs. The second `updateResponse({ call_id: newCallId }, oldCallId)` wins; the first Retell call becomes an orphan. Mitigation: Accept — double-reload within 60s of the same session is astronomically rare in practice, and both calls reference the same response row.

**[Extra `retell.call.retrieve()` on `call_ended`]** → One additional Retell API call per session (~100ms latency). Mitigation: Acceptable cost; the alternative (delaying status write to `call_analyzed`) causes a 30-120s lag in dashboard status.

**[`call_ended` before `call_analyzed`: `questions_covered` not yet set]** → The dashboard row will show `status = completed` but `questions_covered = null` until `call_analyzed` fires. Mitigation: Display "–" or "loading" in the UI for null `questions_covered`.

**[Webhook idempotency]** → Retell can deliver duplicate webhook events. If `call_ended` fires twice, the second write must be a no-op. Mitigation: Single atomic conditional UPDATE — `update(payload).eq('call_id', x).eq('status', 'ongoing')`. The `.eq('status', 'ongoing')` clause IS the idempotency guard at the DB layer (not a pre-read + post-write, which has a TOCTOU race on rapid retries — eng-review C1). Inspect `rowCount` to log success vs no-op. `call_analyzed` keeps its existing `if (stored?.is_analysed) break;` pre-read guard, which is safe because `is_analysed` flips atomically with the analytics write.

**[Backfill data integrity]** → Existing rows with `is_ended = false` and no `call_id` (never-started rows) will receive `status = 'ongoing'` from the DEFAULT and won't be caught by the backfill. Mitigation: These rows are already invisible to the dashboard and are harmless as `ongoing` (old enough to be clearly stale). Acceptable.

## Migration Plan

**Schema migration (manual, no migrations folder):**
1. Apply to Supabase SQL editor:
   ```sql
   ALTER TABLE response
     ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ongoing',
     ADD COLUMN IF NOT EXISTS disconnection_reason text,
     ADD COLUMN IF NOT EXISTS questions_covered integer,
     ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
     ADD COLUMN IF NOT EXISTS session_token uuid;

   -- Backfill existing rows
   UPDATE response SET status = 'completed' WHERE is_ended = true;
   UPDATE response SET status = 'interrupted'
     WHERE is_ended = false AND call_id IS NOT NULL
       AND created_at < now() - interval '5 minutes';
   ```
2. Update `supabase_schema.sql` at repo root to reflect new columns (documentation only — no functional impact).

**Code deployment order:**
1. Deploy schema migration first (additive columns, no breakage to existing queries).
2. Deploy API changes (`register-call`, `response-webhook`, `check-session`).
3. Deploy client changes (`call/index.tsx`, public route).
4. Deploy dashboard changes.

**Rollback:** Remove the 5 columns (`ALTER TABLE response DROP COLUMN ...`) and revert code. The `is_ended` column is preserved throughout, so the old dashboard query (`is_ended = true`) can be restored in one file.

## Open Questions

- Should `user_hangup` with call duration ≥ 30s map to `completed` (candidate said what they needed) or `interrupted` (they ended it early)? Brainstorm decision: ≥ 30s → `completed`. Revisit if recruiters report confusion.
- Should the `/api/check-session` endpoint consume the token (invalidate it after first use) to prevent replay? Current decision: no — the 60s window provides sufficient protection and token consumption requires additional DB state management.
