## ADDED Requirements

### Requirement: Robust Bot interviewer constant
The system SHALL export a `ROBUST_BOT` entry from the `INTERVIEWERS` constant in `src/lib/constants.ts` with the following exact values:
- `name`: `"Robust Bot"`
- `description`: `"Hi! I'm Robust Bot, your first-round screening interviewer. I'll walk through the role's screening questions and probe your answers to understand your experience. Let's get started."`
- `image`: `"/interviewers/Bob.png"`
- `audio`: `"Bob.wav"`
- `empathy`: `3`
- `rapport`: `4`
- `exploration`: `10`
- `speed`: `7`

#### Scenario: Constants file exports ROBUST_BOT
- **WHEN** `src/lib/constants.ts` is imported
- **THEN** `INTERVIEWERS.ROBUST_BOT` SHALL be defined with the exact name, description, image, audio, and slider values listed above

### Requirement: Robust Bot system prompt constant
The system SHALL export a `RETELL_AGENT_ROBUST_BOT_PROMPT` string constant from `src/lib/constants.ts` containing the authoritative probing system prompt verbatim, including all dynamic-variable placeholders (`{{name}}`, `{{mins}}`, `{{objective}}`, `{{questions}}`).

#### Scenario: Prompt constant is exported
- **WHEN** `src/lib/constants.ts` is imported
- **THEN** `RETELL_AGENT_ROBUST_BOT_PROMPT` SHALL be a non-empty string

#### Scenario: Prompt contains required dynamic variable placeholders
- **WHEN** `RETELL_AGENT_ROBUST_BOT_PROMPT` is inspected
- **THEN** it SHALL contain `{{name}}`, `{{mins}}`, `{{objective}}`, and `{{questions}}` as substrings

#### Scenario: Prompt does not contain praise language
- **WHEN** `RETELL_AGENT_ROBUST_BOT_PROMPT` is inspected
- **THEN** it SHALL NOT contain phrases like "great answer", "excellent", "I love that", "perfect" as prompt instructions to praise candidates

### Requirement: Create-interviewer route provisions Robust Bot
The `GET /api/create-interviewer` route SHALL provision a Robust Bot interviewer in addition to Lisa and Bob by:
1. Creating a dedicated Retell LLM with `general_prompt: RETELL_AGENT_ROBUST_BOT_PROMPT` and the same `end_call` tool used by the shared Lisa/Bob LLM.
2. Creating a Retell agent with `voice_id: "11labs-Brian"` and `agent_name: "Robust Bot"` referencing that LLM.
3. Inserting a row into the `interviewer` table via `InterviewerService.createInterviewer` with `agent_id` from the new agent and the `INTERVIEWERS.ROBUST_BOT` metadata.

#### Scenario: Route creates all three interviewers
- **WHEN** `GET /api/create-interviewer` is called
- **THEN** the response SHALL include `newThirdInterviewer` (or equivalent key) in the JSON body alongside `newInterviewer` and `newSecondInterviewer`
- **THEN** the HTTP status SHALL be 200

#### Scenario: Robust Bot uses a separate Retell LLM
- **WHEN** `GET /api/create-interviewer` is called
- **THEN** the Retell LLM created for Robust Bot SHALL have a different `llm_id` from the LLM shared by Lisa and Bob
- **THEN** the Robust Bot LLM's `general_prompt` SHALL equal `RETELL_AGENT_ROBUST_BOT_PROMPT`

#### Scenario: Robust Bot agent uses correct voice
- **WHEN** the Retell agent for Robust Bot is created
- **THEN** it SHALL use `voice_id: "11labs-Brian"`

#### Scenario: Route fails gracefully if any provisioning step fails
- **WHEN** any Retell API call or DB insert throws an error
- **THEN** the route SHALL return HTTP 500 with `{ error: "Failed to create interviewers" }` (and `details` in non-production environments)
