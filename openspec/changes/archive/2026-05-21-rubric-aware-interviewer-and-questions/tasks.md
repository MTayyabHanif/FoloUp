## Implementation Order

Recommended landing order with hard dependencies noted:

1. §4 — Type + schema additions (smallest, unblocks everything else). **Hard dependency for §2 and §7.**
2. §1 + §2 — Constants matrix + generator I/O.
3. §3 — `numQuestions ≥ 4` enforcement in the stepper.
4. M.1 (migration) — **Hard dependency for §6.10** (writing `coverage_warnings` to the row).
5. §5 — `PROMPT_FOOTER_TEMPLATE` checklist wired as Retell dynamic variable in `register-call/route.ts`.
6. §6 — Preflight validator (API + modal).
7. §7 — `not_assessed` scoring state (scorer + service + renormalization).

§1–3 can land independently of each other.

---

## 1. Rubric first-class in interviewer plan

- [x] 1.1 In `src/lib/constants.ts`, add `ACTIVE_DIMENSIONS = ["role_fit", "depth_of_knowledge", "problem_solving", "examples_evidence"] as const` and `OBSERVATIONAL_DIMENSIONS = ["communication", "professionalism"] as const`. Export `ActiveDimension` and `ObservationalDimension` union types.
- [x] 1.2 In `src/lib/constants.ts`, add `DIMENSION_RUBRIC_HINT: Record<ActiveDimension, string>` — a one-line evidence-coaching string per active dimension, used inside the generator prompt template (see design §2.4).

## 2. Generator overhaul

- [x] 2.1 In `src/lib/constants.ts`, add the full `ACTIVE_DIM_ALLOCATION: Record<Seniority, Record<4|5|6|7|8, Record<ActiveDimension, number>>>` matrix verbatim per design §2.3.
- [x] 2.2 Add a unit test file `src/lib/constants.test.mjs` (`node --experimental-strip-types`) asserting (a) every cell sums to its `numQuestions` key and (b) every cell has every active dim ≥ 1.
- [x] 2.3 In `src/app/api/generate-interview-questions/route.ts`, expand the POST body type to include `jobDescription: string`, `mustHaves: string[]`, `seniority: Seniority`, and `rubric: { active, observational, weights }` (per design §2.1).
- [x] 2.4 In the same route, reject `numQuestions < 4` or `numQuestions > 8` with a 400 response and a clear error message.
- [x] 2.5 Update the generator's system prompt template to include the allocation block, the four active dimensions, and the `DIMENSION_RUBRIC_HINT` lines per design §2.4. Substitute `seniority`, `numQuestions`, the allocation cell, `jobDescription`, `mustHaves`, `context`, `name`, `objective`.
- [x] 2.6 Update the JSON response contract: each question is `{ question, targetDimension, rubricNote }` (per design §2.2). Wire `response_format: { type: "json_schema", strict: true, schema: <verbatim schema from design §2.2a> }` into the OpenAI call. `targetDimension` enum is `["role_fit", "depth_of_knowledge", "problem_solving", "examples_evidence"]`. Both `targetDimension` and `rubricNote` are `required` on every item. Reject any response that fails schema validation; do not silently coerce.
- [x] 2.7 Add support for "fill gaps only" mode: the request body MAY include `existingQuestions: Question[]` and `missingDimensions: ActiveDimension[]`. When both are present and non-empty, the generator produces exactly `missingDimensions.length` questions tagged to those dimensions, ignoring the allocation matrix for this call (per design §6.6).
- [x] 2.8 Update all callers in `details.tsx` (and any other call sites) that hit this route to pass the new inputs (`jobDescription`, `mustHaves`, `seniority`, `rubric`).

## 3. `numQuestions ≥ 4` enforcement

- [x] 3.1 In `src/components/dashboard/interview/create-popup/details.tsx`, find the `numQuestions` input and change `min` from `1` (or whatever the current value is) to `4`, and `max` from `5` to `8`.
- [x] 3.2 In the same file, update the `onChange` handler for `numQuestions` to clamp to `[4, 8]` before setting state. Snap on blur for direct typed input.
- [x] 3.3 Update the stepper validators `step0Valid` and `step2Valid` to require `Number(numQuestions) >= 4 && Number(numQuestions) <= 8`. The "Next" / "Create" button should be disabled when invalid.
- [x] 3.4 Update the helper text below the field from "Max 5" → "Min 4 (one per active scoring dimension), max 8".
- [x] 3.5 Bump the default `numQuestions` in the modal's initial state from its current value to `4`. Find any place that resets the form to ensure the reset value is also `4`.

## 4. Question schema additions

- [x] 4.1 In `src/types/interview.ts`, add `import type { ActiveDimension } from "@/lib/constants";` and re-export it. Extend `Question` with optional `targetDimension?: ActiveDimension;` and `rubricNote?: string;` per design §4.
- [x] 4.2 Skim consuming files (search: `Question[`, `\.targetDimension`, `\.rubricNote`) and add optional-chaining where appropriate. No required-field assumptions anywhere on read paths.
- [x] 4.3 Run `npx tsc --noEmit` and fix any new errors introduced by the type extension (should be additive only; no breakage expected).

## 5. `PROMPT_FOOTER_TEMPLATE` updates

- [x] 5.1 In `src/lib/constants.ts` (or wherever `PROMPT_FOOTER_TEMPLATE` lives), append the verbatim coverage-requirements block from design §5, including the `{{coverage_checklist}}` placeholder as a literal string. The template is stored and persisted as-is; it is NOT substituted at interview-save time.
- [x] 5.2 Add a `buildCoverageChecklist(questions: Question[]): string` helper that builds the numbered list string: `N. {{dimension}} — {{rubricNote}}` per question. Untagged questions render as `N. (untagged)` and log a warning to stderr.
- [x] 5.3 In `src/app/api/register-call/route.ts`, extend the `dynamic_data` object (passed to `retellClient.call.createWebCall`) to include `coverage_checklist: buildCoverageChecklist(interview.questions)` alongside the existing `name`, `mins`, `objective`, `questions` variables. This is the substitution site — NOT `interviews.service.ts`.
- [x] 5.4 Update the `normalizeWhitespace` comparison in `/api/interviewers/route.ts` (lines ~95–110) to match the NEW `PROMPT_FOOTER_TEMPLATE` text (which now includes the `{{coverage_checklist}}` block + coverage requirements). Without this, existing operator-saved interviewer prompts will fail validation on save because the stored footer won't match the updated canonical text.
- [x] 5.5 Manual smoke: create an interview, fetch the row, and verify the persisted agent prompt contains the verbatim coverage block (with the literal `{{coverage_checklist}}` placeholder, not a substituted value).

## 6. Preflight validator at Save

- [x] 6.1 Create `src/app/api/validate-question-coverage/route.ts` with POST handler. Request body: `{ jobDescription, mustHaves, questions }`. Response: `{ uncovered_must_haves: string[], semantic_gaps: string[] }`.
- [x] 6.2 Inside that route, call `gpt-4o-mini-2024-07-18` with `temperature: 0`, `seed: 7`, and `response_format: { type: "json_schema", strict: true, schema: { type: "object", required: ["uncovered_must_haves", "semantic_gaps"], additionalProperties: false, properties: { uncovered_must_haves: { type: "array", items: { type: "string" } }, semantic_gaps: { type: "array", items: { type: "string" } } } } }`. No retries. On parse failure, return `{ uncovered_must_haves: [], semantic_gaps: ["validator unavailable — proceed at your own risk"] }`.
- [x] 6.3 In `details.tsx`, add `const [questionsDirty, setQuestionsDirty] = useState<boolean>(false);` and wire `setQuestionsDirty(true)` into every operator-driven question-list mutation (text edit, dimension change, rubricNote edit, reorder, add, remove).
- [x] 6.4 In `details.tsx`, add `coverage_warnings: string[]` to the form's state and to `interviewData`. Initial value `[]`.
- [x] 6.5 In `details.tsx`, refactor `onGenrateQuestions` and `onManual`: BEFORE the existing `setLoading(true)`, run the preflight check sequence per design §6.2 — rule check first, then LLM check (only when rule passes AND `questionsDirty === false`).
- [x] 6.6 Add a new modal component (or inline modal section in `details.tsx`) with three action buttons per design §6.4: `Regenerate all` (primary) | `Fill gaps only` (secondary, disabled when zero missing tagged dimensions) | `Save anyway` (tertiary, danger styling). Body lists missing dims, uncovered must-haves, semantic gaps as bullets.
- [x] 6.7 Implement the `Regenerate all` handler: call the generator with the full inputs from scratch, replace `interviewData.questions`, reset `questionsDirty = false`, reset `coverage_warnings = []`, close the modal, return to form (DO NOT auto-save).
- [x] 6.8 Implement the `Fill gaps only` handler: call the generator in "fill gaps" mode (§2.7) with `existingQuestions` + `missingDimensions`, APPEND the returned questions, reset `questionsDirty = false`, reset `coverage_warnings = []`, close the modal, return to form.
- [x] 6.9 Implement the `Save anyway` handler: render an acknowledgement checkbox _"I understand this interview may under-score uncovered dimensions"_ above the "Save anyway" button. The button is disabled until the checkbox is checked. On button click: build `coverage_warnings: string[]` (one string per bullet shown in the modal), update `interviewData` to include `coverage_warnings`, close the modal, proceed to the original `setLoading(true)` + persistence path.
- [x] 6.5b When the preflight rule check passes AND the LLM check passes (or is skipped), reset `coverage_warnings = []` on the saved interview row before proceeding with `setInterviewData`. This ensures a previously-warned interview that is subsequently fixed does not retain stale warnings.
- [x] 6.10 Ensure persistence: confirm the `createInterview` service writes `coverage_warnings` to the row, and the `database.types.ts` typing accepts the field on Insert.

## 7. `not_assessed` scoring state

- [x] 7.1 In the v2 `AnalyticsV2` / dimension type definition (likely `src/types/response.ts` or `src/services/analytics-v2.service.ts`), add optional `assessed?: boolean` to each dimension object.
- [x] 7.2 In the scorer system prompt (search: `evidenceQuotes`, scoring instruction block), append the `assessed` instruction verbatim per design §7.2.
- [x] 7.3 In `applyHardCaps` (in `analytics-v2-caps.ts` or the service), implement the override per design §7.3: for each ACTIVE dim, force `assessed = false` when no `questions[].targetDimension === dim.name`. For OBSERVATIONAL dims, default `assessed ?? true` but do not override.
- [x] 7.4 In the same function, when `no_answers` OR `agent_only_speech` is among `hardRulesTriggered`, force `assessed = false` on ALL six dimensions (active AND observational).
- [x] 7.5 **[BLOCKER — timing fix]** Move the `dimensionOverall` computation in `applyHardCaps` to AFTER the rule-evaluation block. Verify line-by-line that the patched dimensions array (with `assessed: false` overrides applied) is the input to `computeOverallScoreFromDimensions`. Computing overall score before the override loop produces stale values.
- [x] 7.5b In `computeOverallScoreFromDimensions`, filter out `assessed === false` dimensions, renormalize against the sum of remaining weights. Return 0 when zero dimensions are assessed (preserves existing edge-case behavior).
- [x] 7.6 Update `applyHardCaps` to receive the `questions` list (current signature already does — verify and pass through). If it does not, thread it from the caller (`runAnalyticsV2`).
- [x] 7.7 Add four new test cases to `src/lib/analytics-v2-caps.test.mjs`: (a) active dim with zero tagged questions → forced `assessed: false`; (b) active dim with ≥1 tagged question → respects scorer's `assessed`; (c) observational dim → never overridden by absence of tagged question; (d) `no_answers` fires → all 6 dims `assessed: false`.
- [x] 7.8 Add one test case for `computeOverallScoreFromDimensions`: legacy input (no `assessed` anywhere) returns exactly the same integer as before; subset-assessed input renormalizes correctly; all-unassessed returns 0.
- [x] 7.9 In the dimension display component (wherever score badges are rendered per dimension), add a conditional: when `dim.assessed === false`, render the "Not assessed" pill (`inline-flex items-center rounded-full bg-stone-100 border border-stone-300 text-stone-600 text-xs px-2 py-0.5`) with `title="Not assessed — no question targeted ${DIMENSION_LABEL[d.name]}"`. When the `<details>` is expanded, render the dimension's `feedback`/`rationale` but skip the evidence-quotes list.
- [x] 7.10 In `callInfo.tsx`, render the `coverage_warnings` amber pill near `SessionCoverageRow` when `interview.coverage_warnings?.length > 0`. Pill style: `inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 text-amber-800 text-xs px-2 py-0.5` with an `AlertTriangle` icon. On pill click, expand an inline list showing each warning string (no modal).

## Migration

- [x] M.1 Apply `migration.sql` against the dev database (`psql ... -f migration.sql`) or via the Supabase migration tooling per project convention.
- [x] M.2 Run the verify `SELECT` block at the bottom of `migration.sql` and confirm the column exists with default `[]::jsonb`.
- [x] M.3 Regenerate / hand-update `src/types/database.types.ts` so `interview.Row` includes `coverage_warnings: Json` and Insert/Update include `coverage_warnings?: Json | undefined`.
- [x] M.4 Update `supabase_schema.sql` checked-in copy to match the new column (idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

## Verify

- [x] V.1 Run `npx tsc --noEmit` — must pass.
- [x] V.2 Run `node --experimental-strip-types src/lib/constants.test.mjs` — invariants pass.
- [x] V.3 Run `node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs` — all original cases + the four new `assessed` cases + the `computeOverallScoreFromDimensions` case pass.
- [x] V.4 Run `npm run lint` (or project equivalent) — must pass.
- [x] V.5 Manual smoke: create a new interview with `seniority='senior'`, `numQuestions=6`. Inspect the persisted `interview.questions` JSON — assert 1 × role_fit, 2 × depth_of_knowledge, 2 × problem_solving, 1 × examples_evidence, all with non-empty `rubricNote`.
- [x] V.6 Manual smoke: fetch the agent prompt for that interview and assert it contains the verbatim coverage block plus 6 numbered checklist lines.
- [x] V.7 Manual smoke: in the create modal, set `numQuestions=3` → "Next" button disabled and helper text reflects new bounds. Set `numQuestions=4` → enabled.
- [x] V.8 Manual smoke: in the create modal, generate questions then manually delete the only `examples_evidence` question. Click Save → modal opens with `examples_evidence` listed as missing. Test all three buttons (Regenerate all / Fill gaps only / Save anyway) and confirm each behaves per design §6.5.
- [x] V.9 Manual smoke (OD-A behavioral change): re-analyze a response whose interview was created BEFORE this change (untagged questions). Confirm all four active dims show `assessed: false` and the overall score is computed from observational dims only (or 0). This verifies the legacy override is universal and the score renormalizes against the 0.15 weight sum.
- [x] V.10 Manual smoke: re-analyze a response whose interview was created AFTER this change. Confirm every dimension has `assessed: true` (or `false` only when the hard-cap fires) and the overall score matches manual calculation.
