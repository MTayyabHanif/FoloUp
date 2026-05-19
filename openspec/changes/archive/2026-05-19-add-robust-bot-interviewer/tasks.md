## 1. Constants — Add Robust Bot prompt and metadata

- [x] 1.1 In `src/lib/constants.ts`, add the exported constant `RETELL_AGENT_ROBUST_BOT_PROMPT` with the full verbatim system prompt text (including all sections: Role, How you behave, Tone, Fairness, Pacing, Opening, Closing, and the "Context for this interview" block with `{{name}}`, `{{mins}}`, `{{objective}}`, `{{questions}}` placeholders).
- [x] 1.2 Verify prompt text is committed verbatim: diff `RETELL_AGENT_ROBUST_BOT_PROMPT` in `src/lib/constants.ts` against the authoritative text in this change's `tasks.md` context (the prompt specified in the /flow prompt) — character-for-character match required, including all `{{` and `}}` placeholder tokens.
- [x] 1.3 In `src/lib/constants.ts`, add `ROBUST_BOT` to the `INTERVIEWERS` object with: `name: "Robust Bot"`, `description: "Hi! I'm Robust Bot, your first-round screening interviewer. I'll walk through the role's screening questions and probe your answers to understand your experience. Let's get started."`, `image: "/interviewers/Bob.png"`, `audio: "Bob.wav"`, `empathy: 3`, `rapport: 4`, `exploration: 10`, `speed: 7`.

## 2. Create-Interviewer Route — Provision Robust Bot

- [x] 2.1 In `src/app/api/create-interviewer/route.ts`, add `RETELL_AGENT_ROBUST_BOT_PROMPT` to the import from `@/lib/constants`.
- [x] 2.2 After the Bob agent is created (after line 62), create a new Retell LLM for Robust Bot: call `retellClient.llm.create` with `model: "gpt-4o"`, `general_prompt: RETELL_AGENT_ROBUST_BOT_PROMPT`, and the same `end_call` tool (name `"end_call_1"`, same description) used by the shared LLM.
- [x] 2.3 Create a Retell agent for Robust Bot: call `retellClient.agent.create` with `response_engine: { llm_id: robustBotModel.llm_id, type: "retell-llm" }`, `voice_id: "11labs-Brian"`, `agent_name: "Robust Bot"`.
- [x] 2.4 Insert the Robust Bot interviewer row: call `InterviewerService.createInterviewer` with `{ agent_id: robustBotAgent.agent_id, ...INTERVIEWERS.ROBUST_BOT }` and the `supabase` client.
- [x] 2.5 Include `newThirdInterviewer` (the result from 2.4) in the `NextResponse.json` return value alongside `newInterviewer` and `newSecondInterviewer`.

## 3. Verification

- [x] 3.1 TypeScript: run `npx tsc --noEmit` and confirm zero new type errors introduced.
- [ ] 3.2 Manual smoke-test: call `GET /api/create-interviewer` in a dev environment and confirm the JSON response contains all three interviewers, and that "Robust Bot" appears in the dashboard interviewer list. *(Operator-deferred — requires live `RETELL_API_KEY` and creates billable Retell resources.)*
- [ ] 3.3 Confirm in Retell dashboard that a new LLM with the probing prompt and a new "Robust Bot" agent were created. *(Operator-deferred — requires Retell dashboard access.)*
- [ ] 3.4 Confirm in Supabase that a new row exists in the `interviewer` table for Robust Bot with the correct `agent_id`, name, description, image, audio, and trait slider values. *(Operator-deferred — verifiable after 3.2.)*
- [ ] 3.5 Verify dynamic variables work: start a test call with Robust Bot and confirm `{{name}}`, `{{mins}}`, `{{objective}}`, `{{questions}}` are replaced at call time by the register-call route. *(Operator-deferred — requires a live test call.)*

## 4. Housekeeping

- [x] 4.1 Note in a code comment near the `GET` handler that the route lacks idempotency (pre-existing issue, tracked for a future `fix-create-interviewer-idempotency` change).
