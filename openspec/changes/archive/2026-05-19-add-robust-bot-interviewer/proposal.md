## Why

The app currently ships with two default interviewers ("Explorer Lisa" and "Empathetic Bob") that share a single bland Retell LLM prompt, causing both agents to praise answers, agree reflexively, and never push back — producing low-signal screening interviews. A third interviewer with a probing, no-praise system prompt is needed to support real first-round candidate screening at Robust Devs.

## What Changes

- Add a new constant `RETELL_AGENT_ROBUST_BOT_PROMPT` to `src/lib/constants.ts` with a direct, probing system prompt designed for first-round screening (no filler praise, probes every answer one level deeper, rejects vague responses).
- Add a new `INTERVIEWERS.ROBUST_BOT` entry to `src/lib/constants.ts` with name, description, image, audio, and trait slider values.
- Extend the "Create Default Interviewers" API route (`src/app/api/create-interviewer/route.ts`) to provision a third Retell LLM (with the new prompt), a third Retell agent, and insert a "Robust Bot" row into the `interviewer` table via `InterviewerService`.
- Return all three interviewers in the JSON response from the route.

## Capabilities

### New Capabilities

- `robust-bot-interviewer`: A third default interviewer ("Robust Bot") with a dedicated Retell LLM and a no-praise, probing system prompt for first-round candidate screening. Uses the existing dashboard auto-render path — no new UI required.

### Modified Capabilities

<!-- No existing spec-level capability requirements are changing. The create-default-interviewers route is extended, but its behavior contract (provision default interviewers on button click) is unchanged — it simply provisions one more. -->

## Impact

- **`src/lib/constants.ts`**: Two additions — new prompt constant and new INTERVIEWERS entry.
- **`src/app/api/create-interviewer/route.ts`**: Extended with three new API calls to Retell (LLM create, agent create) and one DB insert.
- **Retell account**: One additional LLM and one additional agent provisioned per call to the route.
- **Supabase `interviewer` table**: One additional row per call (no schema change).
- **Known issue (deferred)**: The route has no idempotency check — calling it twice creates duplicate rows and Retell agents for all three interviewers. This matches existing behavior for Lisa and Bob and is not introduced by this change; fix is deferred.
- **Branch note**: This change is being proposed on `feat/atlassian-design-system-redesign`, which is unrelated to this change. Operator has accepted this; the apply step should be applied or cherry-picked to the appropriate branch before merging.
