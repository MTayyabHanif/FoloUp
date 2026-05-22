## 1. Schema Migration

- [ ] 1.1 Run `ALTER TABLE interviewer ADD COLUMN retell_llm_id TEXT NULL;` via Supabase migration or direct SQL (see `openspec/changes/edit-personas-retell-sync/migration.sql`) — SQL is ready; operator must apply to the live DB before deploy
- [x] 1.2 Hand-update `src/types/database.types.ts` to add `retell_llm_id: string | null` to the interviewer Row, Insert, and Update shapes (lines 142–192)
- [x] 1.3 Add `retell_llm_id?: string | null` to the `Interviewer` interface in `src/types/interviewer.ts` (lines 1–16)
- [x] 1.4 Run `tsc --noEmit` to confirm no type errors from the schema additions

## 2. Prompt Footer Utility

- [x] 2.1 Create `src/lib/promptFooter.ts` exporting `appendFooter(body: string): string` (trims body, appends `\n\n` + `PROMPT_FOOTER_TEMPLATE`)
- [x] 2.2 Create `stripFooter(prompt: string): string` in the same file (removes `PROMPT_FOOTER_TEMPLATE` suffix using whitespace-normalized comparison; returns full string unchanged if footer not found)
- [x] 2.3 Replace the inline footer-append block at `src/app/api/interviewers/route.ts:109-115` with a call to `appendFooter` from the new util
- [x] 2.4 Verify the POST create flow still works end-to-end after the util refactor
- [x] 2.5 Write unit tests for `promptFooter.ts` covering: (a) `appendFooter("My body")` → ends with `PROMPT_FOOTER_TEMPLATE`, separated by `\n\n`; (b) `stripFooter(appendFooter("My body")) === "My body"`; (c) `stripFooter("No footer here") === "No footer here"`. The project has no test runner configured — install `vitest` as a dev dependency (`npm install -D vitest`) and add a `"test": "vitest run"` script to `package.json`, or use Node `assert` in a one-off script. Confirm all three pass before marking done.

## 3. Shared Sub-component Extraction

- [x] 3.1 Create directory `src/components/dashboard/interviewer/shared/`
- [x] 3.2 Extract `TraitSlider` component from `CreateInterviewerModal.tsx` (currently defined at lines 117–152) into `src/components/dashboard/interviewer/shared/TraitSlider.tsx`
- [x] 3.3 Extract `Fieldset` wrapper component from `CreateInterviewerModal.tsx` (currently defined at lines 95–115) into `src/components/dashboard/interviewer/shared/Fieldset.tsx`
- [x] 3.4 Extract `AvatarGrid` component (the 4×2 avatar picker grid, currently inlined inside the modal JSX at approximately lines 322–350) into `src/components/dashboard/interviewer/shared/AvatarGrid.tsx`; it accepts `avatars`, `selectedImage`, `onChange`, and `disabled` props
- [x] 3.5 Update `CreateInterviewerModal.tsx` to import `TraitSlider`, `Fieldset`, and `AvatarGrid` from `shared/` (no behavior change)
- [x] 3.6 Smoke-test the New Interviewer modal to confirm all fields render and submit correctly after the extraction

## 4. Service Layer

- [x] 4.1 Add `updateInterviewer(id: number, patch: Partial<InterviewerPatch>): Promise<Interviewer>` to `src/services/interviewers.service.ts` alongside `deleteInterviewer` (uses `.update().eq("id", id).select().single()`)
- [x] 4.2 Ensure `updateInterviewer` returns the full updated row (chain `.select().single()` — same pattern as `createInterviewer`)

## 5. PATCH API Route

- [x] 5.1 Add `export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> })` to `src/app/api/interviewers/[id]/route.ts` — use the async params pattern matching the existing DELETE handler (i.e., `const { id: rawId } = await params;`)
- [x] 5.2 Implement auth check (same pattern as DELETE handler — return 401 if no session)
- [x] 5.3 Parse and validate the PATCH body: reject empty body with 400; for each present field apply `isNonEmptyString` guards (name, description, image, voice_id) and range guards for trait sliders (1–10); return 422 on validation failure. `retell_llm_id` is NOT an accepted client field — silently ignore it if present (do not validate, do not write).
- [x] 5.4 Fetch the current interviewer row from DB to get `agent_id` and `retell_llm_id`; return 404 if row not found
- [x] 5.5 Implement lazy backfill: if `retell_llm_id IS NULL` and the PATCH requires a Retell LLM update, call `retellClient.agent.retrieve(agent_id)`, assert `response_engine.type === 'retell-llm'` (return 500 if not), read `response_engine.llm_id`
- [x] 5.6 Implement Retell LLM PATCH branch: if `prompt` or any trait slider is in the body, call `retellClient.llm.update(llm_id, { general_prompt: appendFooter(body.prompt) })`; return 500 on failure (abort, no DB write)
- [x] 5.7 Implement Retell agent PATCH branch: if `voice_id` or `name` is in the body, call `retellClient.agent.update(agent_id, { voice_id?, agent_name? })`; return 500 on failure (abort, no DB write)
- [x] 5.8 Implement DB UPDATE: call `updateInterviewer(id, { ...patchFields, retell_llm_id })` (include `retell_llm_id` if it was just resolved via lazy backfill); return 500 on DB failure
- [x] 5.9 Return `200` with the updated interviewer row on success
- [x] 5.10 Add a code comment near the Retell LLM update noting the Lisa/Bob shared-LLM legacy quirk (editing Lisa's prompt also affects Bob's Retell LLM)

## 6. Context Update

- [x] 6.1 Add `updateInterviewer(id: number, patch: InterviewerPatch): Promise<void>` to `src/contexts/interviewers.context.tsx` — calls `PATCH /api/interviewers/${id}` then `await fetchInterviewers()` (mirror the `deleteInterviewer` pattern at line 52)
- [x] 6.2 Expose `updateInterviewer` on the context value type and the context provider

## 7. Edit Modal UI

- [x] 7.1 Create `src/components/dashboard/interviewer/EditInterviewerModal.tsx` with the same field layout as `CreateInterviewerModal` (name, description, avatar, voice, prompt body textarea + read-only footer, trait sliders) importing shared sub-components from `shared/`
- [x] 7.2 Wire prop-based prefill: on open, initialize form state from the `interviewer` prop; use `stripFooter(interviewer.prompt)` for the prompt body field; pre-select `interviewer.image` in `AvatarGrid`; set prompt textarea rows dynamically: `Math.min(18, Math.max(10, strippedBody.split("\n").length + 2))` with `min-h-[240px]` (not the fixed `rows={10}` used in the create modal)
- [x] 7.3 Implement submit handler: call `updateInterviewer(interviewer.id, formValues)` from context; close modal on success; modal title is "Edit interviewer persona"; submit button label is "Save changes" (not "Create persona")
- [x] 7.4 Add loading state: disable submit + cancel buttons during the in-flight PATCH; show spinner with label "Saving..." in the submit button; set `closeOnOutsideClick={!isSubmitting}` on the Modal component; guard `handleClose` with an `if (isSubmitting) return` early-exit (same pattern as `CreateInterviewerModal`)
- [x] 7.5 Add error banner: display between form body and footer buttons on 4xx/5xx; keep modal open on error; use message differentiation based on `body.type`:
  - `body.type === "retell_failure"` → "This change was rejected — your interviewer is unchanged. Check your input and try again."
  - `body.type === "db_failure"` → "Your changes were applied to the AI model but could not be saved to the record. Saving again should fix it."
  - `res.status === 422` → use `body.error` directly (server validation message)
  - all other errors → generic "Failed to save changes — please try again."
- [x] 7.6 Add `type: "retell_failure" | "db_failure"` field to the 500 error response bodies in the PATCH handler (`src/app/api/interviewers/[id]/route.ts`): return `{ error: "...", type: "retell_failure" }` when any Retell call fails; return `{ error: "...", type: "db_failure" }` when the DB UPDATE fails after Retell succeeds

## 8. Edit Trigger on InterviewerCard

- [x] 8.1 Add a pencil (`Pencil` from `lucide-react`) edit icon button to `InterviewerCard.tsx` immediately before the existing delete trigger button (currently at lines 214–224) — use the same `opacity-0 group-hover:opacity-100 absolute` pattern; position it to the left of the trash icon at `right-14 top-4`; apply `e.stopPropagation()` on click; match the same `h-9 w-9 rounded-full border bg-[#fbfdf6]/95 backdrop-blur-sm` styling as the delete button, but use a neutral (non-red) hover color — e.g., `hover:border-[#203b14] hover:bg-[#203b14] hover:text-[#fbfdf6]`
- [x] 8.2 Add `editOpen` state and `EditInterviewerModal` to `InterviewerCard` alongside the existing `detailsOpen` / `deleteOpen` state — wire the pencil button to set `editOpen(true)` and render `<EditInterviewerModal open={editOpen} interviewer={interviewer} onClose={() => setEditOpen(false)} />`
- [x] 8.3 Verify that clicking the edit icon does NOT open the details modal (stopPropagation confirmed)
- [x] 8.4 Verify that clicking the delete icon is unaffected by the edit trigger addition
- [x] 8.5 Add an "Edit persona" button to the `InterviewerDetailsModal` — the modal is rendered inside `InterviewerCard` via `<Modal ... title={interviewer.name}><InterviewerDetailsModal ... /></Modal>`; the `InterviewerDetailsModal` component itself does not manage modal state, so the edit affordance is wired at the `InterviewerCard` level: add a footer `div` below `<InterviewerDetailsModal />` (inside the details `<Modal>`) with a `Button` labeled "Edit persona" that calls `setDetailsOpen(false); setEditOpen(true);`; style the footer with `flex justify-end border-t border-[#e0e5d5] pt-4 mt-2`

## 9. End-to-End Verification

- [ ] 9.1 Edit an interviewer's name → confirm Retell agent name updates and DB row reflects new name
- [ ] 9.2 Edit an interviewer's prompt body → confirm Retell LLM `general_prompt` updates (with footer appended) and `retell_llm_id` is now populated in the DB row (lazy backfill path)
- [ ] 9.3 Edit only the avatar → confirm no Retell API calls are made and DB updates successfully
- [ ] 9.4 Edit both prompt and voice_id in one PATCH → confirm both Retell LLM and agent are updated sequentially
- [ ] 9.5 Attempt to PATCH a non-existent interviewer ID → confirm 404
- [ ] 9.6 Attempt to PATCH with an empty body (`{}`) → confirm 400
- [x] 9.7 Confirm `tsc --noEmit` passes with no errors after all changes are applied
- [ ] 9.8 Simulate Retell LLM PATCH failure (e.g., invalid llm_id or network mock): confirm DB row is unchanged and the handler returns 500
- [ ] 9.9 Edit an interviewer whose `retell_llm_id` is already populated → confirm no `agent.retrieve` call is made (check server logs)
- [ ] 9.10 Edit an interviewer's prompt, then edit again (second edit) → confirm `retell_llm_id` is read from DB on second edit and no extra `agent.retrieve` call is made
