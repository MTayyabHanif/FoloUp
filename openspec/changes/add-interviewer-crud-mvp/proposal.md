## Why

The Robust Bot interviewer (landed on `feat/atlassian-design-system-redesign`) exposed a structural gap: operators can only provision interviewers through a one-shot seed route (`GET /api/create-interviewer`). There is no way to create a new custom interviewer, give it a distinct prompt and voice, or retire one without touching the database directly. Every net-new interviewer requires a code deploy. This MVP closes that gap with a minimal create + soft-delete flow — no edit, no multi-tenancy — leaving the product in a state where the roster can grow at runtime without engineering involvement.

## What Changes

- **New REST endpoints**: `POST /api/interviewers` (create) and `DELETE /api/interviewers/[id]` (soft-delete). Both are authenticated; new routes added to middleware auth-bypass list is explicitly NOT done (they require auth).
- **Schema migration**: Three `ALTER TABLE` statements on the `interviewer` table adding `prompt TEXT NOT NULL`, `voice_id TEXT NULL`, and `deleted_at TIMESTAMPTZ NULL`. Existing rows are backfilled with their authoritative prompt text and voice IDs.
- **Type cleanup**: Remove phantom `user_id: string` from the `Interviewer` TypeScript interface (the column has never existed in the DB schema). Add `prompt`, `voice_id`, and `deleted_at`.
- **Constants additions**: `VOICE_OPTIONS` array (Chloe + Brian for v1) and `PROMPT_FOOTER_TEMPLATE` string added to `src/lib/constants.ts`. Existing `RETELL_AGENT_GENERAL_PROMPT` and `RETELL_AGENT_ROBUST_BOT_PROMPT` marked deprecated (seed source only; no other code references them after the create-interviewer route is deprecated).
- **Service layer**: `getAllInterviewers` gains `WHERE deleted_at IS NULL` filter. New `deleteInterviewer(id)` method sets `deleted_at = NOW()`. `createInterviewer` accepts `prompt` and `voice_id` in its payload.
- **Context cleanup**: Remove dead `createInterviewer` from `interviewers.context.tsx`; expose new `deleteInterviewer` callback; retain `fetchInterviewers()` full-refetch pattern (no react-query wiring in this MVP). Delete `src/hooks/useInterviewersQuery.ts` (unused dead code).
- **`register-call` null-guard**: Add a 404 early-return if `getInterviewer` returns null, preventing a silent 500 when an unknown `interviewer_id` is submitted.
- **`create-interviewer` route**: Marked deprecated with a comment and `console.warn` log. NOT removed in v1 (seed scenario still valid for fresh environments).
- **UI — New Interviewer card**: Replace or supplement the "Create two Default Interviewers" button with a "New Interviewer" card in the roster grid that opens a create modal.
- **UI — Create modal**: Full create form (name, description, avatar picker, voice picker, prompt textarea with locked footer, trait sliders) inside a modal dialog.
- **UI — Delete confirmation**: Trash icon on each `InterviewerCard` opens a confirmation dialog before soft-deleting.
- **UI — Details modal prompt display**: `InterviewerDetailsModal` gains a read-only prompt textarea section with monospace font and a "Prompt" header (approximately 40-line addition).

## Capabilities

### New Capabilities

- `interviewer-crud`: Full create and soft-delete lifecycle for interviewers at runtime, including Retell LLM + agent provisioning on create and soft-delete persistence (no Retell deletion in v1).

### Modified Capabilities

<!-- No existing spec-level capability requirements are changing in observable behavior for end users. The register-call route gains a null-guard but its contract (start a call for a valid interviewer) is unchanged. The interviewer list display gains a prompt read-only section — this is additive, not a behavior change to an existing spec. -->

## Impact

- **`supabase_schema.sql`**: Three `ALTER TABLE` blocks + backfill UPDATEs + voice backfill.
- **`src/types/database.types.ts`**: Regenerate (or hand-update) to add `prompt`, `voice_id`, `deleted_at` to interviewer row/insert/update types.
- **`src/types/interviewer.ts`**: Add `prompt`, `voice_id`, `deleted_at`; remove `user_id`.
- **`src/lib/constants.ts`**: Add `VOICE_OPTIONS`, `PROMPT_FOOTER_TEMPLATE`; add deprecation comments on existing prompt constants.
- **`src/services/interviewers.service.ts`**: Modify `getAllInterviewers`, `createInterviewer`; add `deleteInterviewer`.
- **`src/contexts/interviewers.context.tsx`**: Remove dead `createInterviewer`, add `deleteInterviewer`.
- **`src/hooks/useInterviewersQuery.ts`**: Delete entirely (dead code).
- **`src/app/api/interviewers/route.ts`** (new): `POST` handler.
- **`src/app/api/interviewers/[id]/route.ts`** (new): `DELETE` handler.
- **`src/app/api/register-call/route.ts`**: Add null-guard.
- **`src/app/api/create-interviewer/route.ts`**: Add deprecation comment + `console.warn`.
- **`src/components/dashboard/interviewer/InterviewerCard.tsx`**: Add delete affordance.
- **`src/components/dashboard/interviewer/interviewerDetailsModal.tsx`**: Add prompt display section.
- **`src/components/dashboard/interviewer/createInterviewerButton.tsx`**: Replaced by "New Interviewer" card in roster grid.
- **New components**: `NewInterviewerCard.tsx`, `CreateInterviewerModal.tsx`, `DeleteInterviewerDialog.tsx`.
- **Retell account**: Each new interviewer creates one Retell LLM object + one Retell agent object. Soft-deleted interviewers leave their Retell resources alive (accepted v1 leak).
- **Branch**: This change is proposed and will be applied on `feat/atlassian-design-system-redesign`, where the Robust Bot commits already live.
