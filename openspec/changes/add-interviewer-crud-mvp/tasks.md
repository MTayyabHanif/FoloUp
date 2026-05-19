## 1. Schema Migration

- [x] 1.1 Write the Supabase migration SQL file (or apply directly): `ALTER TABLE interviewer ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT ''` (use `IF NOT EXISTS` — migration must be safe to re-run)
- [x] 1.2 Backfill `prompt` for Explorer Lisa and Empathetic Bob rows with the verbatim `RETELL_AGENT_GENERAL_PROMPT` text from `src/lib/constants.ts` — SQL-escape any single quotes (`'` → `''`) in the prompt text before running *(Note: shipped using Postgres dollar-quoting `$PROMPT$ ... $PROMPT$` instead of `''` escaping — verbatim, no per-quote escaping needed)*
- [x] 1.3 Backfill `prompt` for Robust Bot row with the verbatim `RETELL_AGENT_ROBUST_BOT_PROMPT` text from `src/lib/constants.ts` — SQL-escape any single quotes (`'` → `''`) in the prompt text before running *(Note: dollar-quoted, see 1.2)*
- [x] 1.4 Drop the temporary default using a conditional `DO` block (see design.md migration SQL) so the step is idempotent
- [x] 1.5 `ALTER TABLE interviewer ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL`
- [x] 1.6 `ALTER TABLE interviewer ADD COLUMN IF NOT EXISTS voice_id TEXT NULL`
- [x] 1.7 Backfill `voice_id = '11labs-Chloe'` for Explorer Lisa and `voice_id = '11labs-Brian'` for Empathetic Bob and Robust Bot
- [x] 1.8 Update `supabase_schema.sql` to include all three new columns in the schema definition
- [ ] **1.9 OPERATOR ACTION REQUIRED:** Run `openspec/changes/add-interviewer-crud-mvp/migration.sql` against the Supabase project (SQL editor). Without this, `interviewer.prompt`, `interviewer.voice_id`, and `interviewer.deleted_at` columns will not exist and the new code will fail at runtime. *(2026-05-19 Codex probe: remote Supabase still returns `column interviewer.voice_id does not exist`; this workspace has no Supabase access token, service-role key, or postgres URL, so DDL cannot be applied from here.)*

## 2. Type Updates

- [x] 2.1 In `src/types/interviewer.ts`: remove `user_id: string`; add `prompt: string`, `voice_id: string | null`, `deleted_at: string | null`
- [x] 2.2 In `src/types/database.types.ts`: add `prompt: string`, `voice_id: string | null`, `deleted_at: string | null` to `interviewer.Row`; add as optional to `interviewer.Insert` and `interviewer.Update`
- [x] 2.3 Run `tsc --noEmit` and fix any type errors introduced by the type changes

## 3. Constants Additions

- [x] 3.1 Add `VOICE_OPTIONS` constant to `src/lib/constants.ts`: two entries `{ id: "11labs-Chloe", label: "Chloe (warm, articulate female)" }` and `{ id: "11labs-Brian", label: "Brian (clear, neutral male)" }` typed `as const`
- [x] 3.2 Add `PROMPT_FOOTER_TEMPLATE` constant to `src/lib/constants.ts` with the exact footer text containing `{{name}}`, `{{mins}}`, `{{objective}}`, and `{{questions}}` placeholders
- [x] 3.3 Add deprecation comments on `RETELL_AGENT_GENERAL_PROMPT` and `RETELL_AGENT_ROBUST_BOT_PROMPT` constants (e.g., `/** @deprecated Seed source only — do not use in new code. Prompt text is now stored in DB. */`)

## 4. Service Layer

- [x] 4.1 In `src/services/interviewers.service.ts`: modify `getAllInterviewers` to add `.is('deleted_at', null)` filter to the Supabase query
- [x] 4.2 In `src/services/interviewers.service.ts`: modify `createInterviewer` method signature and payload to accept and pass `prompt: string` and `voice_id: string`; chain `.select().single()` on the insert call so the created row (including `id` and `agent_id`) is returned and can be passed back in the 201 response body
- [x] 4.3 In `src/services/interviewers.service.ts`: add `deleteInterviewer(id: number)` method using Supabase client syntax: `supabase.from('interviewer').update({ deleted_at: new Date().toISOString() }).eq('id', id).select()` — no `deleted_at IS NULL` filter (idempotent re-delete returns 200)
- [x] 4.4 Verify `getInterviewer(id)` still has NO `deleted_at` filter (intentional — in-flight call safety)
- [x] 4.5 **BLOCKER** Modify the existing `getInterviewer(id)` method in `src/services/interviewers.service.ts` to return `null` on Supabase error code `PGRST116` (zero rows returned by `.single()`) instead of throwing. Only PGRST116 is swallowed — all other errors are re-thrown. See design.md §Service Layer Contract for pseudocode.

## 5. POST /api/interviewers Route

- [x] 5.1 Create `src/app/api/interviewers/route.ts` with a `POST` handler
- [x] 5.2 Parse and validate request body: `name` (required string), `description` (required string), `image` (required string), `voice_id` (required string, must be one of `VOICE_OPTIONS` ids), `prompt` (required string), `empathy`, `rapport`, `exploration`, `speed` (all required numbers 1–10)
- [x] 5.3 Add server-side footer validation with whitespace normalization: implement a `normalizeWhitespace(s: string): string` helper that trims leading/trailing whitespace and collapses `\r\n` → `\n`; then check `normalizeWhitespace(prompt).includes(normalizeWhitespace(PROMPT_FOOTER_TEMPLATE))`. If the footer is absent, return 422 with a clear error message.
- [x] 5.4 Add server-side empty-body validation: extract the prompt body (user-authored portion before the footer) by stripping the footer suffix from the submitted prompt string; trim the result; if it is empty (the user submitted only the footer with no authored body), return 422 with a clear error message ("Prompt body must not be empty"). This prevents a prompt that consists solely of `PROMPT_FOOTER_TEMPLATE` from being accepted.
- [x] 5.5 Call `retellClient.llm.create({ general_prompt: prompt })` and extract `llm_id`
- [x] 5.6 Call `retellClient.agent.create({ llm_id, voice_id, agent_name: name })` and extract `agent_id`
- [x] 5.7 Call `InterviewerService.createInterviewer({ name, description, image, voice_id, prompt, agent_id, empathy, rapport, exploration, speed })` and chain `.select().single()` to get the created row back
- [x] 5.8 Return 201 with the created interviewer object (including `id` and `agent_id`) on success
- [x] 5.9 On any step failure: return 500 with a clear error message; do NOT attempt cleanup of any already-created Retell resources (document in code comment that orphaned resources are an accepted v1 cost)

## 6. DELETE /api/interviewers/[id] Route

- [x] 6.1 Create `src/app/api/interviewers/[id]/route.ts` with a `DELETE` handler
- [x] 6.2 Parse `id` from route params and validate it is a positive integer; return 400 if invalid
- [x] 6.3 Call `InterviewerService.deleteInterviewer(id)` using Supabase client syntax with no `deleted_at IS NULL` filter (idempotent — re-deleting an already-deleted row overwrites the timestamp and returns 200). Return 404 only if `data` is an empty array (no row with that `id` exists at all).
- [x] 6.4 Return 200 on successful soft-delete
- [x] 6.5 Do NOT call any Retell deletion API (add a code comment documenting the accepted Retell resource leak)

## 7. register-call Null-Guard

**Depends on task 4.5** (getInterviewer must return null on PGRST116 before this guard is meaningful).

- [x] 7.1 In `src/app/api/register-call/route.ts`: after `InterviewerService.getInterviewer(interviewer_id)`, add a null-guard that returns 404 with a JSON error body if the result is `null` (the service no longer throws on missing rows — it returns `null`)
- [x] 7.2 Confirm the null-guard is placed BEFORE the `retellClient.call.createWebCall()` call so no Retell API is called with an undefined `agent_id`

## 8. Deprecate create-interviewer Route

- [x] 8.1 In `src/app/api/create-interviewer/route.ts`: add a top-of-file comment: `/** @deprecated This seed-only route is replaced by POST /api/interviewers. Do not use in new code. */`
- [x] 8.2 In the route handler body: add `console.warn('[DEPRECATED] GET /api/create-interviewer — use POST /api/interviewers instead')` as the first line of execution

## 9. Context Cleanup

- [x] 9.1 In `src/contexts/interviewers.context.tsx`: remove the `createInterviewer` function definition and remove it from the context value object and any context type
- [x] 9.2 In `src/contexts/interviewers.context.tsx`: add a `deleteInterviewer(id: number): Promise<void>` function that calls `DELETE /api/interviewers/[id]` then calls `fetchInterviewers()` on success
- [x] 9.3 Expose `deleteInterviewer` in the context value object and update the context type to include it
- [x] 9.4 Confirm no component imports or calls `createInterviewer` from the context (should be zero references after step 9.1)

## 10. Dead Code Removal

- [x] 10.1 Run `grep -r "useInterviewersQuery" src/` to confirm zero usages before deleting
- [x] 10.2 Delete `src/hooks/useInterviewersQuery.ts` entirely (only after 10.1 confirms zero usages)
- [x] 10.3 Run `grep -r "createInterviewer" src/contexts/interviewers.context.tsx` (or `grep -r "createInterviewer" src/`) to confirm the context is the only remaining reference before removing it from `interviewers.context.tsx`

## 11. UI — New Interviewer Card in Roster Grid

- [x] 11.1 Create `src/components/dashboard/interviewer/NewInterviewerCard.tsx` — a card styled consistently with `InterviewerCard` that shows a "+" icon and "New Interviewer" label
- [x] 11.2 In `src/app/(client)/dashboard/interviewers/page.tsx`: remove any `interviewers.length === 0` EmptyState branch (or conditional block that hides the grid when empty). Always render `<DataGrid>` with `<NewInterviewerCard>` as the **last** card (position locked to last — existing roster stays visually stable as more interviewers are added). When the list is empty the grid shows just the one card — no separate empty-state helper text is needed.
- [x] 11.3 Remove or replace the existing `CreateInterviewerButton` usage from the page (the "Create two Default Interviewers" button is superseded by the new card for runtime use; the deprecated route still exists for dev seeding). `<NewInterviewerCard>` is part of the grid at all times — there is no EmptyState fallback that hides it. *(Note: orphaned `createInterviewerButton.tsx` was deleted entirely since it had no remaining importers; the deprecated GET /api/create-interviewer route remains for dev seeding via curl/URL.)*
- [x] 11.4 `NewInterviewerCard` should accept an `onClick` prop that the parent page wires to open the create modal

## 12. UI — Create Interviewer Modal

- [x] 12.1 Create `src/components/dashboard/interviewer/CreateInterviewerModal.tsx` as a modal dialog component
- [x] 12.2 Add controlled form state for: `name` (text), `description` (textarea), `image` (avatar path — defaults to empty, required), `voice_id` (select from `VOICE_OPTIONS`), `promptBody` (textarea — user-editable portion only), `empathy`, `rapport`, `exploration`, `speed` (sliders, 1–10). Immediately below the sliders section header add `<p className="text-xs text-muted-foreground">Display only — does not affect interview behavior.</p>` before the first slider renders.
- [x] 12.3 Render the `PROMPT_FOOTER_TEMPLATE` text below the prompt textarea as a visually distinct, read-only block (e.g., lighter background, monospace font, `readOnly` attribute or non-input element)
- [x] 12.4 On submit: construct the full prompt as `promptBody + "\n\n" + PROMPT_FOOTER_TEMPLATE`, then POST to `/api/interviewers` with all form fields
- [x] 12.5 On success: close the modal and call `fetchInterviewers()` from context to refresh the roster
- [x] 12.6 On error: display an error banner pinned between the form body and the footer button row — classes `bg-destructive/10 border border-destructive text-destructive text-sm rounded-md p-3`. Surface the server's exact `error.message` for 422 responses; for 500 use `"Failed to create interviewer — please try again."` (append `" (Detail: <details>)"` in non-production). Hidden entirely when no error is present (no dead space reserved). Do not close the modal on error.
- [x] 12.7 Wire `CreateInterviewerModal` into the interviewers page, opened by `NewInterviewerCard`'s `onClick`
- [x] 12.8 **Avatar picker (4×2 grid):** Render the 8 avatars from `src/components/dashboard/interviewer/avatars.ts` as a CSS `grid grid-cols-4 gap-2` (4 columns × 2 rows, no horizontal scroll). Each avatar is a `<button type="button" aria-label={\`Avatar option ${avatar.id}\`}>` wrapping an `<img>`. Selected state: `ring-4 ring-brand-bold`. Unselected: `ring-1 ring-border`. Clicking sets `image` form field to the avatar's `img` path.
- [x] 12.9 **Submit button loading state:** During the API call set `isSubmitting = true`. The submit button renders `<Loader2 className="animate-spin mr-2 h-4 w-4" />` with label `"Creating..."` and is `disabled`. The Cancel button is also `disabled` while submitting. No full-modal overlay needed — the spinner in the button is sufficient. Reset `isSubmitting = false` on both success and error.

## 13. UI — Delete Confirmation Dialog on InterviewerCard

- [x] 13.1 Create `src/components/dashboard/interviewer/DeleteInterviewerDialog.tsx` — a confirmation dialog that accepts `interviewerName` (for display) and `onConfirm` / `onCancel` callbacks
- [x] 13.2 In `src/components/dashboard/interviewer/InterviewerCard.tsx`: add the outermost card element `group relative` CSS classes. Add an absolute-positioned trash icon button at `top-2 right-2`: `<button type="button" aria-label="Delete interviewer" onClick={(e) => { e.stopPropagation(); openDeleteDialog(); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 28, height: 28 }}>`. Use `<Trash2 size={16} />` from `lucide-react`. `e.stopPropagation()` is required so the details modal does not open simultaneously. Icon is 28×28px button (shipped as 28×28 button: `h-7 w-7`).
- [x] 13.3 Clicking the trash icon opens `DeleteInterviewerDialog` (render it as a sibling modal, not nested inside the details modal)
- [x] 13.4 On confirm: call `deleteInterviewer(id)` from context; on success the card disappears from the grid (context refetch removes it)
- [x] 13.5 On cancel: close the dialog with no side effects
- [x] 13.6 While the delete is in flight: show a loading state on the confirm button and disable it to prevent double-submit
- [x] 13.7 **(Optional enhancement — applied)** `[@media(hover:none)]:opacity-100` Tailwind class added so touch devices always see the trash icon.

## 14. UI — Prompt Display in InterviewerDetailsModal

- [x] 14.1 In `src/components/dashboard/interviewer/interviewerDetailsModal.tsx`: add a "Prompt" section after the existing trait sliders (or at a natural breakpoint in the layout)
- [x] 14.2 Render a `<h3>` or equivalent "Prompt" header
- [x] 14.3 Render the prompt as: `<Textarea readOnly value={interviewer.prompt} rows={Math.min(24, Math.max(6, interviewer.prompt.split('\n').length + 2))} className="font-mono text-xs resize-none" />`. Dynamic rows: at least 6, at most 24, adapting to actual line count. The textarea itself does NOT scroll internally (`resize-none`). The modal container's `overflow-y-auto` is the single scroll context. Do NOT use `overflow-hidden` if the textarea content can exceed `rows` — rely on the parent's scroll.
- [x] 14.4 Confirm the textarea does not accept input (`readOnly` attribute confirmed in code)
- [x] 14.5 In the trait sliders section of `interviewerDetailsModal.tsx`: add `<p className="text-xs text-muted-foreground">Display only — does not affect interview behavior.</p>` immediately after the sliders section header, before the first slider.
- [x] 14.6 **(Optional enhancement — applied)** Copy button next to the "Prompt" header. Uses the app's existing icon-button + tooltip pattern, copies `interviewer.prompt` to the clipboard, and swaps to a copied-state icon after success.

## 15. Verification

- [x] 15.1 Run `tsc --noEmit` — zero type errors
- [x] 15.2 Confirm `src/hooks/useInterviewersQuery.ts` does not exist (`ls src/hooks/`)
- [x] 15.3 Confirm no file has an import from `useInterviewersQuery` (`grep -r "useInterviewersQuery" src/`)
- [x] 15.4 Confirm no file calls `context.createInterviewer` or imports it (`grep -r "createInterviewer" src/` — only the service and the deprecated seed route should appear)
- [x] 15.5 Confirm `PROMPT_FOOTER_TEMPLATE` is exported from constants and contains all four `{{...}}` placeholders
- [x] 15.6 Confirm `VOICE_OPTIONS` is exported from constants with exactly two entries
- [x] 15.7 Confirm `src/app/api/create-interviewer/route.ts` has both the deprecation comment and `console.warn`
- [ ] 15.8 **OPERATOR ACTION REQUIRED** — Manual smoke test checklist: (a) open dashboard → New Interviewer card visible as last grid item; (b) fill and submit create form → new card appears in roster; (c) click new card → details modal shows prompt + slider helper text + Prompt copy button; (d) hover card → trash icon appears; click → confirmation dialog; (e) confirm delete → card disappears; (f) attempt `POST /api/register-call` with deleted interviewer's id → call succeeds (in-flight safety); (g) attempt `POST /api/register-call` with unknown id → 404 returned. **Prerequisite:** `migration.sql` has been applied to Supabase (task 1.9).
