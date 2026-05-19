## ADDED Requirements

### Requirement: Schema has prompt, voice_id, and deleted_at columns
The `interviewer` table SHALL have `prompt TEXT NOT NULL`, `voice_id TEXT NULL`, and `deleted_at TIMESTAMPTZ NULL` columns after the migration runs.

#### Scenario: All three existing rows have a non-empty prompt after migration
- **WHEN** the migration SQL is applied to a database with the three seed interviewers (Explorer Lisa, Empathetic Bob, Robust Bot)
- **THEN** `SELECT id, name, prompt FROM interviewer` returns three rows each with a non-empty `prompt` string

#### Scenario: Explorer Lisa has correct voice_id after migration
- **WHEN** the migration is applied
- **THEN** `SELECT voice_id FROM interviewer WHERE name = 'Explorer Lisa'` returns `11labs-Chloe`

#### Scenario: Empathetic Bob has correct voice_id after migration
- **WHEN** the migration is applied
- **THEN** `SELECT voice_id FROM interviewer WHERE name = 'Empathetic Bob'` returns `11labs-Brian`

#### Scenario: Robust Bot has correct voice_id after migration
- **WHEN** the migration is applied
- **THEN** `SELECT voice_id FROM interviewer WHERE name = 'Robust Bot'` returns `11labs-Brian`

#### Scenario: All existing rows have deleted_at NULL after migration
- **WHEN** the migration is applied
- **THEN** `SELECT COUNT(*) FROM interviewer WHERE deleted_at IS NOT NULL` returns `0`

---

### Requirement: TypeScript types are accurate and contain no phantom fields
The `Interviewer` TypeScript interface SHALL include `prompt: string`, `voice_id: string | null`, and `deleted_at: string | null`, and SHALL NOT include `user_id`.

#### Scenario: No user_id field in Interviewer type
- **WHEN** a developer inspects `src/types/interviewer.ts`
- **THEN** there is no `user_id` property on the `Interviewer` interface

#### Scenario: Prompt field present in Interviewer type
- **WHEN** `tsc --noEmit` is run
- **THEN** no type error is emitted referencing `interviewer.prompt` being unknown

---

### Requirement: VOICE_OPTIONS and PROMPT_FOOTER_TEMPLATE constants exist
`src/lib/constants.ts` SHALL export `VOICE_OPTIONS` (array with at least Chloe and Brian entries) and `PROMPT_FOOTER_TEMPLATE` (string containing all four dynamic variable placeholders).

#### Scenario: VOICE_OPTIONS has exactly two entries in v1
- **WHEN** a developer imports `VOICE_OPTIONS` from `src/lib/constants.ts`
- **THEN** the array contains exactly two objects: `{ id: "11labs-Chloe", label: "Chloe (warm, articulate female)" }` and `{ id: "11labs-Brian", label: "Brian (clear, neutral male)" }`

#### Scenario: PROMPT_FOOTER_TEMPLATE contains all four placeholders
- **WHEN** a developer inspects `PROMPT_FOOTER_TEMPLATE`
- **THEN** the string contains `{{name}}`, `{{mins}}`, `{{objective}}`, and `{{questions}}`

---

### Requirement: POST /api/interviewers creates an interviewer with Retell resources
Submitting a valid POST request to `/api/interviewers` SHALL create one Retell LLM, one Retell agent, and one DB row, then return the created interviewer.

#### Scenario: Successful create returns 201 with the new interviewer
- **WHEN** an authenticated user POSTs `{ name, description, image, voice_id, prompt, empathy, rapport, exploration, speed }` with a valid prompt that includes `PROMPT_FOOTER_TEMPLATE`
- **THEN** the response status is `201` and the body contains the created interviewer including its `id`, `agent_id`, `prompt`, and `voice_id`

#### Scenario: Unauthenticated create is rejected
- **WHEN** a request is sent to `POST /api/interviewers` without a valid session cookie
- **THEN** the response status is `401`

#### Scenario: Missing required field returns 422
- **WHEN** a POST to `/api/interviewers` omits `name`
- **THEN** the response status is `422`

#### Scenario: Prompt without footer is rejected
- **WHEN** a POST to `/api/interviewers` includes a `prompt` that does NOT contain the `PROMPT_FOOTER_TEMPLATE` text
- **THEN** the response status is `422` and the response body includes a message indicating the footer is missing

#### Scenario: Footer validation passes when whitespace differs but fails when any placeholder is missing
- **WHEN** a POST to `/api/interviewers` includes a `prompt` where the footer portion has extra newlines, trailing spaces, or CRLF line endings (instead of LF) but all four placeholders (`{{name}}`, `{{mins}}`, `{{objective}}`, `{{questions}}`) are present
- **THEN** the response status is `201` (whitespace normalization passes validation)
- **AND WHEN** a POST includes a prompt where one of the four placeholders is absent (e.g., `{{name}}` is missing from the footer)
- **THEN** the response status is `422`

#### Scenario: Submitting a prompt that consists only of PROMPT_FOOTER_TEMPLATE with no body returns 422
- **WHEN** a POST to `/api/interviewers` includes a `prompt` whose authored body (the portion before `PROMPT_FOOTER_TEMPLATE`) is empty or whitespace-only
- **THEN** the response status is `422` and the response body indicates that the prompt body must not be empty

#### Scenario: POST /api/interviewers returns 201 with the created interviewer's id and agent_id in the response body
- **WHEN** a valid POST to `/api/interviewers` succeeds
- **THEN** the response status is `201` and the response body contains the created interviewer object including a non-null `id` (integer) and a non-null `agent_id` (string from Retell)

#### Scenario: Partial create failure returns 500 (Retell agent creation fails)
- **WHEN** Retell LLM creation succeeds but agent creation fails (e.g., network error)
- **THEN** the response status is `500`, the created Retell LLM resource is left as an orphan (accepted v1 cost), and no DB row is inserted

---

### Requirement: DELETE /api/interviewers/[id] soft-deletes an interviewer
Submitting a valid DELETE request to `/api/interviewers/[id]` SHALL set `deleted_at = NOW()` on the matching row and NOT call any Retell deletion API.

#### Scenario: Successful soft-delete returns 200
- **WHEN** an authenticated user DELETEs `/api/interviewers/42` for an existing, non-deleted interviewer
- **THEN** the response status is `200` and `SELECT deleted_at FROM interviewer WHERE id = 42` returns a non-null timestamp

#### Scenario: Unauthenticated delete is rejected
- **WHEN** a DELETE to `/api/interviewers/42` is sent without a valid session
- **THEN** the response status is `401`

#### Scenario: Deleting a non-existent interviewer returns 404
- **WHEN** an authenticated user DELETEs `/api/interviewers/99999` and no row with that id exists
- **THEN** the response status is `404`

#### Scenario: DELETE called on an already-deleted interviewer returns 200 (idempotent)
- **WHEN** an authenticated user calls `DELETE /api/interviewers/[id]` on an interviewer that was already soft-deleted (i.e., `deleted_at IS NOT NULL`)
- **THEN** the response status is `200`, and the `deleted_at` timestamp is updated to the current time (re-delete is idempotent)

#### Scenario: Retell agent and LLM are NOT deleted on soft-delete
- **WHEN** an authenticated user soft-deletes an interviewer
- **THEN** the Retell agent and LLM objects with the interviewer's `agent_id` and `llm_id` remain in the Retell account (observable by calling Retell list APIs)

---

### Requirement: getAllInterviewers excludes soft-deleted rows
`InterviewerService.getAllInterviewers` SHALL only return rows where `deleted_at IS NULL`.

#### Scenario: Soft-deleted interviewer does not appear in the dashboard roster
- **WHEN** an interviewer is soft-deleted and the user refreshes the dashboard
- **THEN** the deleted interviewer no longer appears in the roster grid

#### Scenario: Non-deleted interviewers are still returned after another is deleted
- **WHEN** one interviewer is soft-deleted and others are not
- **THEN** `getAllInterviewers` returns all rows where `deleted_at IS NULL` only

---

### Requirement: getInterviewer bypasses deleted_at filter (in-flight call safety)
`InterviewerService.getInterviewer(id)` SHALL return any row matching the `id` regardless of `deleted_at` value. It SHALL return `null` when no row exists, and SHALL NOT throw a Supabase PGRST116 error.

#### Scenario: register-call accepts a soft-deleted interviewer's id
- **WHEN** `POST /api/register-call` is submitted with the `interviewer_id` of a soft-deleted interviewer
- **THEN** the call is registered normally (Retell `createWebCall` is called with the interviewer's `agent_id`)

#### Scenario: getInterviewer returns null when interviewer_id does not exist (does not throw)
- **WHEN** `InterviewerService.getInterviewer(id)` is called with an `id` that matches no row in the `interviewer` table
- **THEN** the method returns `null` and does NOT throw an exception (Supabase PGRST116 is caught internally)

---

### Requirement: register-call returns 404 for an unknown interviewer_id
`POST /api/register-call` SHALL return `404` if the `interviewer_id` does not match any row (deleted or not).

#### Scenario: Missing interviewer_id causes 404 not 500
- **WHEN** `POST /api/register-call` is submitted with an `interviewer_id` that does not exist in the `interviewer` table
- **THEN** the response status is `404` and the Retell `createWebCall` is NOT called

---

### Requirement: Voice picker renders exactly the VOICE_OPTIONS entries
The create modal voice picker (a `<Select>`) SHALL render one option per entry in `VOICE_OPTIONS` and no others.

#### Scenario: Voice picker shows Chloe and Brian options
- **WHEN** a user opens the New Interviewer modal
- **THEN** the voice picker dropdown contains exactly two options: "Chloe (warm, articulate female)" and "Brian (clear, neutral male)"

#### Scenario: Voice picker has no free-text entry
- **WHEN** a user opens the voice picker
- **THEN** there is no text input for entering a custom voice ID

---

### Requirement: Create modal renders a locked footer below the prompt textarea
The create modal SHALL display the `PROMPT_FOOTER_TEMPLATE` text below the prompt textarea as visually distinct, non-editable content.

#### Scenario: Footer is visible but not editable
- **WHEN** a user views the create modal's prompt section
- **THEN** the footer text (containing `{{name}}`, `{{mins}}`, etc.) is visible and cannot be edited by the user

#### Scenario: Submitted prompt includes the footer automatically
- **WHEN** a user types a custom prompt body and submits the create form
- **THEN** the value sent to `POST /api/interviewers` includes both the user-typed body and the `PROMPT_FOOTER_TEMPLATE` text appended

---

### Requirement: New Interviewer card opens the create modal
The dashboard roster grid SHALL include a "New Interviewer" card that, when clicked, opens the create modal. The card SHALL always render as the last item in the grid.

#### Scenario: New Interviewer card is always visible in the roster grid
- **WHEN** a user navigates to the interviewers dashboard
- **THEN** a "New Interviewer" card is visible in the grid regardless of how many interviewers exist

#### Scenario: NewInterviewerCard is rendered as the last item in the grid
- **WHEN** a user navigates to the interviewers dashboard with one or more existing interviewers
- **THEN** the "New Interviewer" card appears after all existing interviewer cards — never before them

#### Scenario: Clicking New Interviewer card opens the create modal
- **WHEN** a user clicks the New Interviewer card
- **THEN** a modal dialog opens containing the create form

---

### Requirement: Delete confirmation dialog is required before soft-delete
Each `InterviewerCard` SHALL provide a hover-revealed trash icon that opens a confirmation dialog. Soft-delete only proceeds after the user confirms.

#### Scenario: Trash icon is hidden by default and revealed on card hover
- **WHEN** a user views the interviewers dashboard with at least one interviewer and does NOT hover over a card
- **THEN** the trash icon is not visible (opacity-0)
- **WHEN** the user hovers over a card
- **THEN** the trash icon becomes visible (opacity-100 with a transition)

#### Scenario: Trash icon is optionally always-visible on touch devices
- **IF** the optional `@media (hover: none)` enhancement is implemented
- **WHEN** a user views the dashboard on a touch device (no hover support)
- **THEN** the trash icon is visible without requiring hover

#### Scenario: Clicking trash icon does not open the details modal
- **WHEN** a user clicks the trash icon on an interviewer card
- **THEN** the delete confirmation dialog opens and the interviewer details modal does NOT open (stopPropagation is applied)

#### Scenario: Clicking delete affordance opens confirmation dialog
- **WHEN** a user clicks the delete affordance (trash icon) on an interviewer card
- **THEN** a confirmation dialog appears asking the user to confirm deletion

#### Scenario: Canceling the dialog does not delete the interviewer
- **WHEN** a user opens the delete confirmation dialog and clicks Cancel
- **THEN** the interviewer remains in the roster grid and no DELETE request is sent

#### Scenario: Confirming the dialog triggers soft-delete and removes card
- **WHEN** a user opens the delete confirmation dialog and clicks Confirm
- **THEN** `DELETE /api/interviewers/[id]` is called, the card disappears from the grid, and the context refetches

---

### Requirement: InterviewerDetailsModal shows the prompt as read-only
`InterviewerDetailsModal` SHALL include a "Prompt" section with the interviewer's `prompt` value rendered in a monospace read-only textarea.

#### Scenario: Prompt section is visible in the details modal
- **WHEN** a user clicks on an interviewer card to open the details modal
- **THEN** a "Prompt" header and a read-only textarea containing the interviewer's prompt are visible

#### Scenario: Prompt textarea uses monospace font
- **WHEN** a user inspects the prompt textarea in the details modal
- **THEN** the textarea has a CSS `font-family` consistent with monospace rendering

#### Scenario: Prompt textarea is not editable
- **WHEN** a user attempts to type in the prompt textarea in the details modal
- **THEN** the textarea does not accept input (readonly attribute is set)

#### Scenario: Prompt can be copied from the details modal
- **WHEN** a user clicks the copy button next to the Prompt header
- **THEN** the interviewer's prompt is written to the clipboard
- **AND** the button reflects a copied state after success

---

### Requirement: Dead code is removed
`src/hooks/useInterviewersQuery.ts` SHALL be deleted. The `createInterviewer` method on `interviewers.context.tsx` SHALL be removed.

#### Scenario: useInterviewersQuery.ts does not exist after apply
- **WHEN** a developer lists files in `src/hooks/`
- **THEN** `useInterviewersQuery.ts` is not present

#### Scenario: interviewers context does not expose createInterviewer
- **WHEN** a developer inspects the `InterviewersContext` type
- **THEN** there is no `createInterviewer` property on the context value

---

### Requirement: create-interviewer route is marked deprecated but functional
`GET /api/create-interviewer` SHALL emit a `console.warn` deprecation message on every invocation and SHALL continue to provision the three seed interviewers.

#### Scenario: Deprecated route logs a warning
- **WHEN** `GET /api/create-interviewer` is called
- **THEN** the server logs a `console.warn` message indicating the route is deprecated

#### Scenario: Deprecated route still creates interviewers
- **WHEN** `GET /api/create-interviewer` is called on a fresh environment with no interviewers
- **THEN** the three seed interviewers (Lisa, Bob, Robust Bot) are created in the database

---

### Requirement: Avatar picker renders 8 thumbnails in a 4-column grid
The create modal avatar picker SHALL render all 8 avatars from `avatars.ts` in a 4-column × 2-row grid without horizontal scroll. Each avatar SHALL be focusable and labelled.

#### Scenario: Avatar grid renders 8 thumbnails in a 4-column layout
- **WHEN** a user opens the New Interviewer modal
- **THEN** the avatar section shows exactly 8 avatar thumbnails arranged in a 4-column × 2-row grid with no horizontal scrollbar

#### Scenario: Selecting an avatar updates the form's image field
- **WHEN** a user clicks on an avatar thumbnail
- **THEN** that avatar is visually highlighted (selected border style) and the form's `image` field is set to the avatar's `img` path

#### Scenario: Only one avatar can be selected at a time
- **WHEN** a user clicks a second avatar after selecting a first
- **THEN** the first avatar loses its selected highlight and the second avatar gains it

#### Scenario: Each avatar button has an accessible label
- **WHEN** an assistive technology inspects the avatar picker
- **THEN** each avatar button has an `aria-label` (e.g., "Avatar option 1") that identifies it

---

### Requirement: Create modal shows an error banner on API failure
The create modal SHALL display an error banner between the form body and the footer buttons when the API call returns a 422 or 500 response. The banner SHALL NOT be rendered when there is no error.

#### Scenario: Error banner displays server validation message on 422
- **WHEN** a user submits the create form and the API returns 422
- **THEN** an error banner appears (styled `bg-destructive/10 border border-destructive`) with the server's exact `error.message` text

#### Scenario: Error banner displays generic message on 500
- **WHEN** a user submits the create form and the API returns 500
- **THEN** an error banner appears with the text "Failed to create interviewer — please try again." (with optional detail in non-production)

#### Scenario: Error banner is absent when no error has occurred
- **WHEN** the create modal is opened and no submission has been attempted
- **THEN** no error banner element is rendered (no empty reserved space)

#### Scenario: Modal stays open after an error
- **WHEN** the API call fails with either 422 or 500
- **THEN** the create modal remains open and the user can correct the form and retry

---

### Requirement: Submit button is disabled and shows a loading spinner during the create API call
The create modal submit button SHALL enter a loading state while the create API call is in flight.

#### Scenario: Submit button is disabled and shows a loading spinner while the create API call is in flight
- **WHEN** a user submits the create form and the API call has not yet resolved
- **THEN** the submit button shows a spinning `Loader2` icon with the label "Creating..." and is `disabled`

#### Scenario: Cancel button is disabled during the in-flight create call
- **WHEN** the create API call is in flight
- **THEN** the Cancel button is also `disabled`

#### Scenario: Submit button returns to normal after error
- **WHEN** the API call completes with an error
- **THEN** the submit button is no longer disabled and shows "Create interviewer" again (allowing retry)

---

### Requirement: Trait sliders in create and details modals show a "Display only" helper text
Both `CreateInterviewerModal` and `InterviewerDetailsModal` SHALL display a `"Display only — does not affect interview behavior."` helper text next to the trait sliders section.

#### Scenario: Trait sliders in create modal show a "Display only" helper text
- **WHEN** a user opens the New Interviewer modal and views the trait sliders section
- **THEN** a helper text reading "Display only — does not affect interview behavior." is visible near the sliders (styled `text-xs text-muted-foreground`)

#### Scenario: Trait sliders in details modal show a "Display only" helper text
- **WHEN** a user opens the details modal for an interviewer and views the trait sliders section
- **THEN** the same "Display only — does not affect interview behavior." helper text is visible near the sliders
