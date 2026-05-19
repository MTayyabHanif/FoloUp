## ADDED Requirements

### Requirement: Response table has status, disconnection_reason, questions_covered, last_active_at, and session_token columns
The `response` table SHALL have five new additive columns: `status text NOT NULL DEFAULT 'ongoing'`, `disconnection_reason text`, `questions_covered integer`, `last_active_at timestamptz`, and `session_token uuid`. The `status` column SHALL accept only the values `ongoing`, `completed`, `interrupted`, `abandoned`. Existing rows SHALL be backfilled: rows with `is_ended = true` → `'completed'`; rows with `is_ended = false`, non-null `call_id`, and `created_at < now() - 5 minutes` → `'interrupted'`.

#### Scenario: New response row defaults to ongoing
- **WHEN** a new `response` row is inserted
- **THEN** the `status` column defaults to `'ongoing'`

#### Scenario: Backfill sets completed for old ended rows
- **WHEN** the backfill migration SQL is run against existing data
- **THEN** rows where `is_ended = true` have `status = 'completed'`

### Requirement: call_ended webhook writes status and disconnection_reason
The `/api/response-webhook` route SHALL handle the `call_ended` event by calling `retell.call.retrieve(call.call_id)` to obtain the `disconnection_reason`, then updating the `response` row with: `status` (mapped from `disconnection_reason` per the defined mapping), `disconnection_reason`, `is_ended` (for backward compat), and `last_active_at = now()`. The update SHALL be conditional on the current `status = 'ongoing'` to ensure idempotency.

**Status mapping:**
- `agent_hangup`, `max_duration_reached`, `inactivity` → `completed` (also `user_hangup` when call duration ≥ 30s)
- `user_hangup` with duration < 30s → `interrupted`
- `registered_call_timeout` → `abandoned`
- `error_*` variants, `concurrency_limit_reached` → `interrupted`
- All other / unknown values → `interrupted`

#### Scenario: Normal agent hangup produces completed status
- **WHEN** Retell fires `call_ended` with `disconnection_reason = 'agent_hangup'`
- **THEN** the response row is updated to `status = 'completed'`, `is_ended = true`

#### Scenario: User hangup produces interrupted status
- **WHEN** Retell fires `call_ended` with `disconnection_reason = 'user_hangup'` and call duration < 30s
- **THEN** the response row is updated to `status = 'interrupted'`, `is_ended = false`

#### Scenario: Network error produces interrupted status
- **WHEN** Retell fires `call_ended` with a `disconnection_reason` starting with `error_`
- **THEN** the response row is updated to `status = 'interrupted'`

#### Scenario: Webhook is idempotent — duplicate call_ended does not clobber
- **WHEN** the `call_ended` webhook fires a second time for the same `call_id`
- **THEN** the conditional UPDATE (WHERE `status = 'ongoing'`) is a no-op and the first write is preserved

### Requirement: call_analyzed webhook computes and writes questions_covered
The `/api/response-webhook` `call_analyzed` handler SHALL count the number of `user` turns in `transcript_object` where `content.trim().length > 20` and write this as `questions_covered`. The value SHALL be capped at `interview.question_count`.

#### Scenario: questions_covered is written after analysis
- **WHEN** Retell fires `call_analyzed` for a completed call with a full transcript
- **THEN** the response row's `questions_covered` equals the count of user turns with content > 20 chars, capped at `interview.question_count`

#### Scenario: Short calls write zero questions_covered
- **WHEN** `call_analyzed` fires for a call where all user turns are filler words (≤ 20 chars)
- **THEN** `questions_covered` is set to `0`

### Requirement: getAllResponses returns ongoing, completed, and interrupted rows
`ResponseService.getAllResponses` SHALL filter using `.in('status', ['completed', 'interrupted', 'ongoing'])` instead of `.eq('is_ended', true)`. The `generate-insights` API route SHALL additionally filter by `is_analysed = true` to exclude unanalyzed rows from LLM insight generation.

#### Scenario: Interrupted response is included in getAllResponses
- **WHEN** a response row has `status = 'interrupted'`
- **THEN** `getAllResponses(interviewId)` returns that row

#### Scenario: Ongoing response is included in getAllResponses
- **WHEN** a response row has `status = 'ongoing'`
- **THEN** `getAllResponses(interviewId)` returns that row

#### Scenario: generate-insights route excludes unanalyzed rows
- **WHEN** generate-insights is called for an interview with an `ongoing` response
- **THEN** the `ongoing` row is excluded from the insight generation payload

### Requirement: Dashboard sidebar shows status badges per response
The responses sidebar in `src/app/(client)/interviews/[interviewId]/page.tsx` SHALL render a badge next to each candidate name indicating session state: a pulsing amber dot for `ongoing`, a red badge for `interrupted`, and no badge (or a green check) for `completed`. An "Include in-progress" toggle SHALL filter rows to `['completed', 'interrupted']` by default and loosen to `['ongoing', 'completed', 'interrupted']` when enabled.

#### Scenario: Ongoing response shows pulsing badge
- **WHEN** the sidebar renders a response with `status = 'ongoing'`
- **THEN** a pulsing amber dot badge is visible next to the candidate name

#### Scenario: Interrupted response shows interrupted badge
- **WHEN** the sidebar renders a response with `status = 'interrupted'`
- **THEN** a red interrupted badge is visible next to the candidate name

#### Scenario: Toggle reveals in-progress rows
- **WHEN** the recruiter enables the "Include in-progress" toggle
- **THEN** ongoing rows appear in the sidebar list

### Requirement: callInfo shows questions_covered and disconnection_reason
The `src/components/call/callInfo.tsx` detail panel SHALL display "X of Y questions covered" (where Y is `interview.question_count`) when `questions_covered` is not null, and SHALL display a humanized `disconnection_reason` label (e.g., "User Hangup", "Network Error") when present.

#### Scenario: Questions covered ratio shown
- **WHEN** a response has `questions_covered = 3` and the interview has `question_count = 5`
- **THEN** the callInfo panel displays "3 of 5 questions covered"

#### Scenario: Disconnection reason shown in humanized form
- **WHEN** a response has `disconnection_reason = 'user_hangup'`
- **THEN** the callInfo panel displays "User Hangup"

#### Scenario: Null questions_covered shows dash
- **WHEN** a response has `questions_covered = null` (call ended but not yet analyzed)
- **THEN** the callInfo panel displays "–" or a loading indicator instead of a ratio

### Requirement: Client routes tab_switch_count through heartbeat endpoint
The client SHALL NOT call `saveResponse({ is_ended: true, tab_switch_count })` in the `isEnded` useEffect. Instead, tab-switch events SHALL be reported via a PATCH to a new `/api/response-heartbeat` endpoint that updates `last_active_at = now()` and `tab_switch_count` conditionally on `status = 'ongoing'`.

#### Scenario: Tab switch counter updated via heartbeat
- **WHEN** the candidate switches browser tabs during an active call
- **THEN** PATCH `/api/response-heartbeat` is called with the new `tab_switch_count`

#### Scenario: Heartbeat is no-op once call ends
- **WHEN** the `call_ended` webhook has already written `status = 'completed'`
- **THEN** a subsequent PATCH to `/api/response-heartbeat` does not update `tab_switch_count` (conditional on `status = 'ongoing'`)
