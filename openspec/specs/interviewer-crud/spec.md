# interviewer-crud Specification

## Purpose
TBD - created by archiving change edit-personas-retell-sync. Update Purpose after archive.
## Requirements
### Requirement: retell_llm_id column exists on the interviewer table
The `interviewer` table SHALL have a `retell_llm_id TEXT NULL` column after the migration runs.

#### Scenario: Column exists with NULL default for existing rows
- **WHEN** the migration SQL is applied
- **THEN** `SELECT retell_llm_id FROM interviewer` returns NULL for all existing rows (no backfill)

#### Scenario: TypeScript types include retell_llm_id
- **WHEN** a developer inspects `src/types/interviewer.ts` and `src/types/database.types.ts`
- **THEN** both include `retell_llm_id?: string | null` in the interviewer Row/Insert/Update shapes

---

### Requirement: promptFooter utility exports stripFooter and appendFooter
`src/lib/promptFooter.ts` SHALL export `stripFooter(prompt: string): string` and `appendFooter(body: string): string`.

#### Scenario: appendFooter appends PROMPT_FOOTER_TEMPLATE to the body
- **WHEN** `appendFooter("My custom body")` is called
- **THEN** the returned string ends with the full `PROMPT_FOOTER_TEMPLATE` text, separated from the body by two newlines

#### Scenario: stripFooter returns only the user-authored body
- **WHEN** `stripFooter(appendFooter("My custom body"))` is called
- **THEN** the returned string equals `"My custom body"` (footer is removed, body is preserved)

#### Scenario: stripFooter returns full string when footer is not found
- **WHEN** `stripFooter("A prompt with no footer")` is called
- **THEN** the returned string equals `"A prompt with no footer"` (no truncation when footer is absent)

---

### Requirement: PATCH /api/interviewers/[id] updates an interviewer in-place
Submitting a valid PATCH request to `/api/interviewers/[id]` SHALL update the specified fields in the DB and sync changed fields to Retell without re-provisioning.

#### Scenario: Successful patch returns 200 with the updated interviewer
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with `{ name: "Updated Name" }`
- **THEN** the response status is `200` and the body contains the updated interviewer with `name === "Updated Name"`

#### Scenario: Unauthenticated patch is rejected
- **WHEN** a PATCH to `/api/interviewers/42` is sent without a valid session
- **THEN** the response status is `401`

#### Scenario: Empty body returns 400
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with an empty JSON object `{}`
- **THEN** the response status is `400`

#### Scenario: PATCH to non-existent interviewer returns 404
- **WHEN** an authenticated user PATCHes `/api/interviewers/99999` and no row with that id exists
- **THEN** the response status is `404`

#### Scenario: Prompt field without footer is rejected with 422
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with a `prompt` body that does NOT produce a valid footer when `appendFooter` is applied
- **THEN** the response status is `422` with a message indicating the footer is missing

#### Scenario: Invalid field type returns 422
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with `{ empathy: 15 }` (out of 1-10 range)
- **THEN** the response status is `422`

---

### Requirement: Retell LLM is PATCHed when prompt or trait sliders change
If the PATCH body includes `prompt` or any trait slider field (`empathy`, `rapport`, `exploration`, `speed`), the handler SHALL call `retellClient.llm.update(llm_id, { general_prompt })`. The DB is only updated after Retell succeeds.

#### Scenario: Prompt edit triggers a Retell LLM update
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with a new `prompt` body
- **THEN** the Retell LLM whose `llm_id` matches the interviewer's `retell_llm_id` receives a `general_prompt` update containing the new prompt with footer appended

#### Scenario: Retell LLM PATCH failure aborts the edit with 500
- **WHEN** the Retell LLM update call fails (e.g., network error or Retell API error)
- **THEN** the response status is `500`, the DB is NOT updated, and the interviewer row is unchanged

#### Scenario: Only avatar change does NOT trigger a Retell LLM update
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with only `{ image: "/avatars/new.png" }`
- **THEN** no Retell API call is made and the DB update succeeds with status `200`

---

### Requirement: Retell agent is PATCHed when voice_id or name changes
If the PATCH body includes `voice_id` or `name`, the handler SHALL call `retellClient.agent.update(agent_id, { voice_id?, agent_name? })`. The DB is only updated after all Retell calls succeed.

#### Scenario: Voice change triggers a Retell agent update
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with `{ voice_id: "11labs-Brian" }`
- **THEN** the Retell agent matching the interviewer's `agent_id` receives a `voice_id` update

#### Scenario: Name change triggers a Retell agent name update
- **WHEN** an authenticated user PATCHes `/api/interviewers/42` with `{ name: "New Name" }`
- **THEN** the Retell agent matching the interviewer's `agent_id` receives an `agent_name` update

#### Scenario: Retell agent PATCH failure aborts the edit with 500
- **WHEN** the Retell agent update call fails after a successful LLM update
- **THEN** the response status is `500` and the DB is NOT updated (transient Retell drift is accepted)

---

### Requirement: retell_llm_id is lazily backfilled on first edit
If the interviewer row has `retell_llm_id IS NULL` and the PATCH requires a Retell LLM update, the handler SHALL call `retellClient.agent.retrieve(agent_id)` to resolve the LLM ID, then persist it in the same DB UPDATE.

#### Scenario: First edit resolves and persists retell_llm_id
- **WHEN** an authenticated user PATCHes an interviewer whose `retell_llm_id` is `NULL` with a `prompt` change
- **THEN** after the edit, `SELECT retell_llm_id FROM interviewer WHERE id = 42` returns a non-null string

#### Scenario: Non-retell-llm engine type returns 500
- **WHEN** the lazy backfill finds `response_engine.type !== 'retell-llm'` on the agent
- **THEN** the response status is `500` with a descriptive error message and the DB is NOT updated

#### Scenario: Second edit does not re-fetch retell_llm_id
- **WHEN** an authenticated user PATCHes an interviewer whose `retell_llm_id` is already populated
- **THEN** no `retellClient.agent.retrieve` call is made (llm_id is read from DB directly)

---

### Requirement: updateInterviewer is exposed on the interviewers context
`interviewers.context.tsx` SHALL expose `updateInterviewer(id: number, patch: InterviewerPatch): Promise<void>` that calls `PATCH /api/interviewers/[id]` and then calls `fetchInterviewers()`.

#### Scenario: Successful context update refetches the interviewer list
- **WHEN** `updateInterviewer(42, { name: "New Name" })` is called from a component
- **THEN** `PATCH /api/interviewers/42` is called, and on success `fetchInterviewers()` is called to refresh the roster

---

### Requirement: EditInterviewerModal renders with prefilled fields
`EditInterviewerModal.tsx` SHALL render the same field layout as `CreateInterviewerModal` with all fields pre-filled from the existing interviewer row. The prompt body textarea SHALL show only the user-authored body (footer stripped via `stripFooter`).

#### Scenario: Edit modal opens with prefilled name
- **WHEN** a user clicks the edit trigger on an interviewer card
- **THEN** the edit modal opens with the `name` field already populated with the interviewer's current name

#### Scenario: Edit modal prompt textarea shows body without footer
- **WHEN** a user opens the edit modal for an interviewer
- **THEN** the prompt textarea displays the body portion only (footer is shown read-only below the textarea, as in the create modal)

#### Scenario: Submitting the edit modal with no changes still sends a PATCH
- **WHEN** a user opens the edit modal and clicks Submit without changing any field
- **THEN** a PATCH request is sent with the current field values (re-sends same data; Retell PATCH is idempotent)

#### Scenario: Edit modal shows error banner on PATCH failure
- **WHEN** the PATCH API call returns a 4xx or 5xx response
- **THEN** an error banner is displayed between the form body and the footer buttons, and the modal stays open

#### Scenario: Edit modal shows loading state during PATCH call
- **WHEN** the PATCH API call is in flight
- **THEN** the submit button is `disabled` and shows a spinner with the label "Saving..." and the Cancel button is also `disabled`

---

### Requirement: Edit trigger appears on InterviewerCard adjacent to delete trigger
`InterviewerCard.tsx` SHALL render an edit (pencil) icon button using the same hover-reveal pattern as the delete trigger. Clicking it SHALL open `EditInterviewerModal` pre-filled with the card's interviewer. It SHALL NOT open the details modal.

#### Scenario: Edit icon is visible on card hover and hidden otherwise
- **WHEN** a user views the interviewers dashboard and does NOT hover over a card
- **THEN** the edit icon is not visible (opacity-0)
- **WHEN** the user hovers over a card
- **THEN** the edit icon becomes visible (opacity-100 with transition)

#### Scenario: Clicking edit icon opens EditInterviewerModal, not details modal
- **WHEN** a user clicks the edit icon on an interviewer card
- **THEN** the `EditInterviewerModal` opens pre-filled with that interviewer's data and the details modal does NOT open (stopPropagation applied)

#### Scenario: Edit icon is positioned to the left of the delete icon
- **WHEN** a user hovers over an interviewer card
- **THEN** the edit icon appears to the left of the delete (trash) icon

---

### Requirement: Shared sub-components are extracted into shared/ directory
`TraitSlider.tsx`, `Fieldset.tsx`, and `AvatarGrid.tsx` SHALL exist in `src/components/dashboard/interviewer/shared/`. Both `CreateInterviewerModal` and `EditInterviewerModal` SHALL import from there.

#### Scenario: CreateInterviewerModal continues to render correctly after extraction
- **WHEN** a user opens the New Interviewer modal after the refactor
- **THEN** all fields (name, description, avatar, voice, prompt, sliders) render and function identically to before the extraction

#### Scenario: EditInterviewerModal uses the same AvatarGrid as CreateInterviewerModal
- **WHEN** a user opens the edit modal
- **THEN** the avatar picker renders the same 4×2 grid of 8 avatars with the current avatar pre-selected

