## Why

The prior `add-interviewer-crud-mvp` change established create and soft-delete, but locked edit out of scope ("delete + recreate is the v1 mutation pattern"). Operators now need to tune interviewer prompts, swap voices, and adjust display metadata without destroying session history tied to the existing `agent_id`. This change closes that gap by adding a PATCH route and a full edit modal, syncing mutations to Retell in-place so the agent's ID never changes.

## What Changes

- **New REST endpoint**: `PATCH /api/interviewers/[id]` added to `src/app/api/interviewers/[id]/route.ts` alongside the existing `DELETE` handler. Authenticated. All fields optional in the body; empty body returns 400. Validated with the same guards as `POST`.
- **Retell in-place sync**: If `prompt` or any trait slider changes → `retellClient.llm.update(llm_id, { general_prompt })`. If `voice_id` or `name` changes → `retellClient.agent.update(agent_id, { voice_id?, agent_name? })`. If only non-Retell fields (avatar, description) change → skip both Retell calls. Order: LLM PATCH first, agent PATCH second, DB UPDATE last. Retell failure aborts the edit; no DB write occurs.
- **Schema migration**: `ALTER TABLE interviewer ADD COLUMN retell_llm_id TEXT NULL;` — single new column.
- **Type extension**: `src/types/interviewer.ts` and `src/types/database.types.ts` gain `retell_llm_id?: string | null` on Row/Insert/Update.
- **Lazy backfill**: On first PATCH for a row where `retell_llm_id IS NULL`, call `retellClient.agent.retrieve(agent_id)`, read `response_engine.llm_id`, and persist it in the same DB UPDATE. If `response_engine.type !== 'retell-llm'`, return 500 (never silently skip).
- **Service layer**: `updateInterviewer(id, patch)` added to `src/services/interviewers.service.ts`. Uses `.update().eq("id", id)` Supabase pattern. Lives alongside `deleteInterviewer`.
- **Context cleanup**: `updateInterviewer(id, patch)` added to `interviewers.context.tsx`. Calls the PATCH route then `await fetchInterviewers()` (mirrors existing `deleteInterviewer` at `src/contexts/interviewers.context.tsx:52`).
- **Prompt footer utility**: New `src/lib/promptFooter.ts` with `stripFooter(prompt): string` and `appendFooter(body): string`. Replaces the inline footer-append logic in `src/app/api/interviewers/route.ts:109-115` and powers the edit modal's prefill stripping.
- **Shared sub-components extracted**: `TraitSlider.tsx`, `Fieldset.tsx`, and `AvatarGrid.tsx` extracted from `CreateInterviewerModal.tsx` (lines 53–152) into `src/components/dashboard/interviewer/shared/`. Both `CreateInterviewerModal` and the new `EditInterviewerModal` import from there.
- **New UI component**: `EditInterviewerModal.tsx` in `src/components/dashboard/interviewer/`. Mirrors `CreateInterviewerModal` field layout. Prefills all fields from the existing interviewer row (prompt prefill strips footer via `stripFooter`). On submit, calls `updateInterviewer`.
- **Edit trigger on InterviewerCard**: An edit icon button added adjacent to the existing delete trigger at `src/components/dashboard/interviewer/InterviewerCard.tsx:78`. Opens `EditInterviewerModal` pre-filled with the card's interviewer.

## Capabilities

### New Capabilities

_None. The update operation is an extension of the existing `interviewer-crud` capability._

### Modified Capabilities

- `interviewer-crud`: Adds the update operation (PATCH) to the existing create/delete/list surface. New requirements: the `PATCH /api/interviewers/[id]` endpoint, Retell in-place sync behavior, the `retell_llm_id` column, lazy backfill, and the edit modal and trigger.

## Impact

- **`src/app/api/interviewers/[id]/route.ts`**: Add `PATCH` handler (currently exports `DELETE` only).
- **`src/services/interviewers.service.ts`**: Add `updateInterviewer(id, patch)` alongside `deleteInterviewer`.
- **`src/contexts/interviewers.context.tsx`**: Add `updateInterviewer(id, patch)` to context surface.
- **`src/lib/promptFooter.ts`** (new): `stripFooter` and `appendFooter` utilities.
- **`src/app/api/interviewers/route.ts:109-115`**: Replace inline footer-append with `appendFooter` from the new util.
- **`src/components/dashboard/interviewer/shared/TraitSlider.tsx`** (new): Extracted from `CreateInterviewerModal.tsx`.
- **`src/components/dashboard/interviewer/shared/Fieldset.tsx`** (new): Extracted from `CreateInterviewerModal.tsx`.
- **`src/components/dashboard/interviewer/shared/AvatarGrid.tsx`** (new): Extracted from `CreateInterviewerModal.tsx`.
- **`src/components/dashboard/interviewer/CreateInterviewerModal.tsx`**: Updated to import shared sub-components.
- **`src/components/dashboard/interviewer/EditInterviewerModal.tsx`** (new): Full edit form.
- **`src/components/dashboard/interviewer/InterviewerCard.tsx`**: Add edit icon trigger adjacent to delete trigger.
- **`src/types/interviewer.ts`**: Add `retell_llm_id?: string | null`.
- **`src/types/database.types.ts`**: Add `retell_llm_id` to interviewer Row/Insert/Update shapes.
- **`supabase_schema.sql`**: Document the new column in the CREATE TABLE block.
- **`openspec/changes/edit-personas-retell-sync/migration.sql`**: Single `ALTER TABLE` statement (no backfill — lazy on first edit).
- **Retell account**: Each edit that touches `prompt`/traits calls one Retell LLM PATCH. Each edit that touches `voice_id`/`name` calls one Retell agent PATCH. No new resources provisioned; no resources deleted.
