## Why

The v2 hiring-grade scoring rubric (six dimensions: `role_fit` 0.25, `depth_of_knowledge` 0.25, `problem_solving` 0.20, `examples_evidence` 0.15, `communication` 0.10, `professionalism` 0.05) is high-signal at the scoring end, but the interview that produces the transcript has no rubric awareness. Questions are generated from `objective` alone; the agent's runtime prompt has no coverage requirements. The result is structural unfairness: candidates routinely have no opportunity to demonstrate a dimension and are then scored low for it. That is both bad UX (operator can't trust the score) and bad signal (the model is asked to score thin air).

This change closes the loop by making the rubric a first-class citizen of the interview itself — at generation time (questions are tagged to active dimensions), at runtime (the agent has explicit coverage requirements and a probing checklist), at save time (preflight validator blocks or flags incomplete coverage), and at scoring time (the scorer can mark a dimension `not_assessed` rather than guess, and the service enforces that decision when the question set could not have provided evidence).

The four ACTIVE dimensions (`role_fit`, `depth_of_knowledge`, `problem_solving`, `examples_evidence`) are the only ones that require dedicated questions. `communication` and `professionalism` remain observational and are judged from the whole call.

## What Changes

- **`src/lib/constants.ts`** (modified): add `ACTIVE_DIMENSIONS` and `OBSERVATIONAL_DIMENSIONS` const arrays. Add the `ACTIVE_DIM_ALLOCATION` matrix (seniority × `numQuestions ∈ {4..8}` → per-active-dim integer counts that always sum to `numQuestions` and always have every active dim ≥ 1). Update `PROMPT_FOOTER_TEMPLATE` to include a new `{{coverage_checklist}}` placeholder plus the verbatim coverage-requirements block (see design §5).
- **`src/types/interview.ts`** (modified): add exported `ActiveDimension` union and extend `Question` with optional `targetDimension?: ActiveDimension` and `rubricNote?: string`. Both fields optional → backward-compatible with existing rows (questions are stored in the `interview.questions` JSONB column, no DDL needed).
- **Generator (`src/app/api/generate-interview-questions/route.ts` + its prompt template)** (modified): input expands from `{ name, objective, numQuestions, context }` to `{ name, objective, numQuestions, context, jobDescription, mustHaves, seniority, rubric }`. Output per question expands from `{ question }` to `{ question, targetDimension, rubricNote }`. The generator allocates `targetDimension` strictly according to `ACTIVE_DIM_ALLOCATION[seniority][numQuestions]`.
- **`src/components/dashboard/interview/create-popup/details.tsx`** (modified): enforce `numQuestions ≥ 4` via HTML `min=4`, JS clamp in onChange, and stepper validators (`step0Valid` / `step2Valid`). Bump HTML `max` from `5` to `8`. Update helper copy on Step 3 from "Max 5" → "Min 4 (one per active scoring dimension), max 8".
- **`src/services/interviews.service.ts::createInterview`** (modified): compute the `{{coverage_checklist}}` string from `interview.questions[].targetDimension` and substitute it into the agent's prompt (alongside the existing `{{questions}}`, `{{name}}`, `{{mins}}`, `{{objective}}` substitutions).
- **Preflight validator** (new `src/app/api/validate-question-coverage/route.ts` + new modal in `details.tsx`): runs at Save time, BEFORE `setLoading(true)` inside `onGenrateQuestions` and `onManual`. Rule-based check: every active dimension has ≥ 1 question tagged. If the rule passes AND the operator has not manually edited the question list since generation, a small GPT-4o LLM check runs against `{ jobDescription, mustHaves, questions }` and returns `{ uncovered_must_haves, semantic_gaps }`. Modal offers three actions: "Regenerate all", "Fill gaps only" (append-only), "Save anyway" (persists `coverage_warnings` to the row).
- **`src/services/analytics-v2.service.ts` (`applyHardCaps`)** (modified): add optional `assessed?: boolean` to each dimension on `AnalyticsV2`. After the scorer returns, force `assessed: false` on any ACTIVE dimension that had no question tagged with `targetDimension === dim.name`. Observational dimensions (`communication`, `professionalism`) are exempt from this override. When `no_answers` or `agent_only_speech` fires, force `assessed: false` on ALL six dimensions. Service is authority.
- **`computeOverallScoreFromDimensions`** (modified): filter out unassessed dimensions, renormalize against the actual sum of remaining weights. If all six are unassessed, return 0 (existing zero-case behavior preserved).
- **Scorer prompt** (modified): instruct the scorer to set `assessed: false` when the question set provided no opportunity to evaluate the dimension; otherwise `assessed: true`. Missing field on legacy rows defaults to `true`.
- **`supabase_schema.sql`** + **`src/types/database.types.ts`** (modified): add `coverage_warnings JSONB NOT NULL DEFAULT '[]'::jsonb` to the `interview` table.

## Capabilities

### New Capabilities

- `rubric-aware-question-generation`: Generator allocates questions to the four active rubric dimensions using a seniority-weighted matrix and attaches `targetDimension` + `rubricNote` to each question.
- `coverage-preflight-validator`: At Save time, blocks (or warns) when questions don't cover every active dimension; offers regenerate / fill-gaps / save-anyway actions.
- `not-assessed-scoring-state`: Per-dimension `assessed` flag that drives renormalization in `computeOverallScoreFromDimensions`, controlled by the service rather than the scorer.

### Modified Capabilities

- `interview-create-form`: `numQuestions` lower bound becomes 4 (was 1); upper bound becomes 8 (was 5); helper copy updated.
- `interview-runtime-prompt`: agent prompt now carries the per-call coverage checklist and probing instructions via `{{coverage_checklist}}`.
- `analytics-v2-hiring-grade`: dimension scoring is now gated on `assessed`; overall score is normalized against the assessed subset.

## Non-Goals

- No change to the six dimension weights themselves.
- No DDL on the `response` table — `assessed` lives inside the existing `analytics` JSONB blob.
- No edit-form changes — coverage tagging is applied at create time only. (An edit flow is a separate follow-up.)
- No retro-tagging of existing interview rows — they keep `targetDimension === undefined` and continue to render normally (untagged questions = untagged questions).
- No change to the `transcript_object` / Retell call path.
- No new analytics surface in the dashboard for `coverage_warnings` — operators see them only at Save time in the modal. (Read-back UI is a separate follow-up.)
- No change to the `must_haves` data shape (still `string[]` on the interview row).

## Success Criteria

1. Every interview created via the UI after this change ships has at least one question tagged with each of the four active dimensions, OR has a non-empty `coverage_warnings` array on the row (operator chose "Save anyway").
2. Every response scored with v2 after this change ships has an `assessed` boolean on each of the six dimensions in `response.analytics.dimensions[]`. Existing v2 rows without the field continue to render unchanged.
3. When a response's question set has zero questions tagged to dimension `X`, `applyHardCaps` returns that dimension with `assessed: false`. When `no_answers` or `agent_only_speech` fires, ALL six dimensions return `assessed: false`.
4. `computeOverallScoreFromDimensions` returns the same integer score as before for legacy rows (all `assessed` absent → treated as `true`).
5. `numQuestions` UI control rejects values below 4 and above 8. Step validators block "Next" / "Create" when out of range.
6. The agent's runtime prompt produced by `createInterview` contains the verbatim coverage-requirements block and a numbered list of `N. {{dimension}} — {{rubricNote}}` entries.

## Impact

- **`src/lib/constants.ts`**: add `ACTIVE_DIMENSIONS`, `OBSERVATIONAL_DIMENSIONS`, `ACTIVE_DIM_ALLOCATION`. Update `PROMPT_FOOTER_TEMPLATE`.
- **`src/types/interview.ts`**: add `ActiveDimension` union; extend `Question`.
- **`src/types/database.types.ts`**: add `coverage_warnings: Json | null` (or the project's typed equivalent) to `interview` Row/Insert/Update.
- **`src/app/api/generate-interview-questions/route.ts`** + its prompt template file: accept new inputs; produce tagged output.
- **`src/app/api/validate-question-coverage/route.ts`** (new): rule + LLM coverage check.
- **`src/components/dashboard/interview/create-popup/details.tsx`**: `numQuestions` bounds, validator updates, preflight modal flow, `questionsDirty` tracking, three modal action handlers.
- **`src/services/interviews.service.ts`**: compute and substitute `{{coverage_checklist}}` in `createInterview`.
- **`src/services/analytics-v2.service.ts`** (`applyHardCaps`, `computeOverallScoreFromDimensions`): `assessed` flag handling and renormalization.
- **Scorer prompt file**: instruct on `assessed`.
- **`supabase_schema.sql`** + **`openspec/changes/rubric-aware-interviewer-and-questions/migration.sql`**: add `coverage_warnings`.
- **No changes to**: Retell webhook handlers, dashboard read-path components (they tolerate the new field via optional chaining), edit-form, calibration harness (continues to work; `assessed` is additive).
