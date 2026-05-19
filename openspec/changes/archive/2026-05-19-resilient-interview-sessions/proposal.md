## Why

When a candidate loses their connection or accidentally closes the tab during an interview, the `response` row is silently orphaned — no end-reason is captured, the row never surfaces in the dashboard, and the candidate is permanently locked out if they try to reconnect. This is causing data loss and a broken candidate experience that needs to be fixed before scaling interview volume.

## What Changes

- **Partial-response status + end-reason tracking**: Add a `status` field (`ongoing | completed | interrupted | abandoned`) and `disconnection_reason` to every `response` row, written by the `call_ended` webhook via `retell.call.retrieve()`.
- **Question coverage metric**: Add `questions_covered` integer, computed during `call_analyzed` by counting substantive user transcript turns (content > 20 chars), surfaced in the dashboard as "X of Y questions".
- **60-second reconnect window**: Mint a per-attempt `session_token` UUID server-side in `/api/register-call`; append it to the URL as `?session=<token>` after Start. On page reload with the token, a new `/api/check-session` endpoint validates the token and 60-second window, allowing the candidate to re-start a fresh Retell call against the same response row (bypassing the `oldUserEmails` lockout).
- **Dashboard live state**: Update `getAllResponses` to include `ongoing` and `interrupted` rows; show a pulsing amber badge for live sessions and status-colored badges for ended sessions. Add an "Include in-progress" toggle to filter views.
- **Race fix**: Client stops writing `is_ended` on tab-close; the webhook becomes the sole owner of end-state, eliminating the write-write race between the client `isEnded` effect and the `call_ended` webhook.

Out of scope for this change:
- Real-time WebSocket push to dashboard (manual refresh is acceptable for v1).
- Pausing/resuming the same Retell call on reconnect (a fresh call is started instead).

## Capabilities

### New Capabilities

- `response-session-resilience`: Per-attempt session token minting, reconnect-window validation, and `check-session` API endpoint that gates reconnect access within 60 seconds of call creation.
- `response-status-tracking`: `status` enum column + `disconnection_reason` + `questions_covered` + `last_active_at` on the `response` table; webhook handlers that write these fields; dashboard UI badges displaying live/interrupted/completed state.

### Modified Capabilities

<!-- No existing spec-level capabilities are changing — this is net-new functionality layered on the existing response recording flow. -->

## Impact

**Schema:** `response` table gets 5 new additive columns (`status`, `disconnection_reason`, `questions_covered`, `last_active_at`, `session_token`). No renames or removals. Manual backfill SQL required (no migrations folder exists).

**APIs:**
- `/api/register-call` — now mints and returns `session_token`.
- `/api/response-webhook` — new `call_ended` case; extended `call_analyzed` case.
- `/api/check-session` — new GET endpoint for reconnect validation.

**Client:**
- `src/components/call/index.tsx` — reconnect path, URL token append, heartbeat for `tab_switch_count`.
- `src/app/(user)/call/[interviewId]/page.tsx` — pass `searchParams.session` down.

**Dashboard:**
- `src/app/(client)/interviews/[interviewId]/page.tsx` — status badges, filter toggle.
- `src/components/call/callInfo.tsx` — show coverage ratio and disconnection reason.

**Types:** `src/types/response.ts` and `src/types/database.types.ts` — add `ResponseStatus` enum and 5 new fields.

**Dependencies:** No new npm packages required. Uses existing `retell-sdk`, `crypto` (Node built-in), and Supabase client.
