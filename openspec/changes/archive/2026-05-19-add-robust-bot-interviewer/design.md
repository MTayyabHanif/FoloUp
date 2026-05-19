## Context

The app provisions default interviewers via `GET /api/create-interviewer`. Currently it creates one shared Retell LLM (with `RETELL_AGENT_GENERAL_PROMPT`) and two agents (Lisa using `11labs-Chloe`, Bob using `11labs-Brian`) that both reference that same LLM. The `INTERVIEWERS` constant in `src/lib/constants.ts` holds metadata (name, description, image, audio, trait sliders) for each interviewer. The `InterviewerService.createInterviewer` call inserts a row into Supabase's `interviewer` table. The dashboard auto-renders any row in that table — no UI change is needed.

Retell's architecture: each `LLM` object has a `general_prompt` set at creation time. A `general_prompt` is per-LLM and cannot be overridden per-agent. Therefore, giving Robust Bot a different system prompt requires its own Retell LLM object.

Dynamic variables (`{{name}}`, `{{mins}}`, `{{objective}}`, `{{questions}}`) are injected by `src/app/api/register-call/route.ts` at call time via Retell's dynamic variable mechanism — no change needed there; the new prompt's placeholders use the same variable names and will slot in automatically.

## Goals / Non-Goals

**Goals:**
- Add a `RETELL_AGENT_ROBUST_BOT_PROMPT` constant with the authoritative probing prompt text (verbatim, including the dynamic-variable placeholders).
- Add an `INTERVIEWERS.ROBUST_BOT` entry with all required metadata.
- Extend the create-interviewer route to provision a dedicated Retell LLM for Robust Bot, create a Retell agent using `11labs-Brian`, and insert the interviewer row.
- Return all three created interviewers in the route's JSON response.

**Non-Goals:**
- No schema changes to the `interviewer` table.
- No new UI components — the dashboard auto-renders new rows.
- No idempotency guard on the route (deferred; matches existing behavior for Lisa and Bob).
- No changes to the register-call route or dynamic variable injection logic.
- No new voice assets — reuse `Bob.png` and `Bob.wav`.

## Decisions

### 1. Separate Retell LLM for Robust Bot (not shared with Lisa/Bob)

**Decision:** Create a new Retell LLM object specifically for Robust Bot with `general_prompt: RETELL_AGENT_ROBUST_BOT_PROMPT`.

**Rationale:** Retell's `general_prompt` is set once per LLM at creation time and applies to all agents using that LLM. Lisa and Bob share a single LLM because they use the same bland prompt. Robust Bot needs a fundamentally different prompt — separate LLM is the only correct approach.

**Alternative considered:** Modify the shared LLM's prompt. Rejected — would change Lisa and Bob's behavior.

### 2. Prompt stored as a constant in `src/lib/constants.ts`

**Decision:** Export `RETELL_AGENT_ROBUST_BOT_PROMPT` from `src/lib/constants.ts`, analogous to `RETELL_AGENT_GENERAL_PROMPT`.

**Rationale:** Consistent with existing pattern. Keeps all Retell prompt strings co-located and importable. Makes the prompt easy to diff and version-control.

**Alternative considered:** Inline the string in the route. Rejected — harder to review and diff the prompt text.

### 3. Reuse `11labs-Brian` voice, `Bob.png` image, `Bob.wav` audio

**Decision:** Robust Bot uses the same voice, image, and audio sample as Bob.

**Rationale:** Operator explicitly confirmed this. No new asset work required.

### 4. Trait sliders: empathy 3, rapport 4, exploration 10, speed 7

**Decision:** Store these values in the `INTERVIEWERS.ROBUST_BOT` entry as specified by the operator.

**Rationale:** Trait sliders are currently decorative (stored in DB, not injected into prompt). Values chosen to reflect Robust Bot's character — low empathy/rapport, maximum exploration, high speed.

### 5. No idempotency guard (deferred)

**Decision:** Do not add an idempotency check to the create-interviewer route in this change.

**Rationale:** The existing route has no guard for Lisa and Bob; Robust Bot should match existing behavior. Adding a guard would be a separate cross-cutting concern and is out of scope.

**Risk:** Calling the route twice creates duplicate Retell LLMs, agents, and DB rows for all three interviewers. This pre-existed; this change does not worsen it proportionally (it goes from 2 duplicates to 3 per extra call). Flagged as a known issue for a future change.

## Risks / Trade-offs

- **Retell API cost**: Each call to the route now makes 5 Retell API calls (1 shared LLM + 2 agents for Lisa/Bob + 1 new LLM + 1 new agent for Robust Bot) instead of 3. Acceptable since this is an admin-only one-shot route.
- **Prompt verbatim fidelity**: The operator's prompt text must be committed character-for-character. The tasks.md includes a verification step.
- **Branch mismatch**: The change is proposed on `feat/atlassian-design-system-redesign`. The apply step should target the correct branch before merging to main.
- **Idempotency gap** (pre-existing): Duplicate rows/agents if route is called more than once. Mitigation: defer to a future `fix-create-interviewer-idempotency` change.
