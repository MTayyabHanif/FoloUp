## 1. Schema Migration

- [x] 1.1 Write the migration SQL file at `openspec/changes/hiring-grade-analytics-scoring/migration.sql` with idempotent `ALTER TABLE` statements (already drafted in this change folder; verify it matches design.md §Migration Plan before applying).
- [x] 1.2 `ALTER TABLE interview ADD COLUMN IF NOT EXISTS job_description TEXT NOT NULL DEFAULT ''`.
- [x] 1.3 `ALTER TABLE interview ADD COLUMN IF NOT EXISTS seniority TEXT NOT NULL DEFAULT 'mid'`.
- [x] 1.4 `ALTER TABLE interview ADD COLUMN IF NOT EXISTS must_haves JSONB NOT NULL DEFAULT '[]'::jsonb`.
- [x] 1.5 Add the `interview_seniority_check` CHECK constraint via a `DO` block (idempotent — see design.md).
- [x] 1.6 `ALTER TABLE response ADD COLUMN IF NOT EXISTS analytics_v1 JSONB NULL`.
- [x] 1.7 Update `supabase_schema.sql` (the in-repo schema mirror) to include all four new columns + the CHECK constraint.
- [x] 1.8 **OPERATOR ACTION REQUIRED:** Run `openspec/changes/hiring-grade-analytics-scoring/migration.sql` against the Supabase project (SQL editor). Without this, `interview.job_description`, `interview.seniority`, `interview.must_haves`, and `response.analytics_v1` do not exist; v2 code paths will fail at runtime when flags are enabled.

## 2. Type Updates

- [x] 2.1 In `src/types/interview.ts`: add `job_description: string`, `seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'principal'`, `must_haves: string[]` to `InterviewBase` (all required; DDL defaults handle existing rows). Export a `Seniority` type alias for reuse.
- [x] 2.2 In `src/types/database.types.ts`: add the three new columns to `interview.Row` (non-optional), `interview.Insert` (optional with the DDL defaults), and `interview.Update` (optional). Add `analytics_v1: Json | null` to `response.Row/Insert/Update`.
- [x] 2.3 In `src/types/response.ts`: define `AnalyticsV2` interface verbatim per design.md Decision 2. Update existing `Analytics` type alias to `AnalyticsV1 | AnalyticsV2` (rename current `Analytics` interface to `AnalyticsV1` if it isn't already).
- [x] 2.4 Export a TypeScript helper `isAnalyticsV2(a: Analytics | null | undefined): a is AnalyticsV2` that narrows via `'schemaVersion' in a && a.schemaVersion === 2`.
- [x] 2.5 Run `tsc --noEmit` and fix any type errors introduced by the type changes.

## 3. Constants and Configuration

- [x] 3.1 In `src/lib/constants.ts` (or a new `src/lib/analytics-v2.constants.ts`): export `ANALYTICS_V2_DIMENSION_WEIGHTS` with the six dimensions and weights from design.md Decision 2 (sum = 1.0). Add a runtime assertion or unit test that the weights sum to 1.0.
- [x] 3.2 Export `ANALYTICS_V2_MODEL` constant pinned to a dated snapshot (e.g., `'gpt-4o-2024-08-06'`). Confirm against the project's current OpenAI client version that this snapshot is available before locking the value.
- [x] 3.3 Export `ANALYTICS_V2_SEED = 7` and `ANALYTICS_V2_TEMPERATURE = 0` constants.
- [x] 3.4 Add `ANALYTICS_V2_ENABLED` and `ANALYTICS_V2_AS_PRIMARY` to `.env.example` with both defaulting to `false` and a comment explaining the rollout sequence (see design.md Decision 15).
- [x] 3.5 Wire the two env flags into a single accessor in `src/lib/env.ts` (or wherever the project centralizes env config). Both must be parsed as booleans (`'true'` / `'1'` → true; anything else → false).

## 4. v2 Prompt Builder

- [x] 4.1 In `src/lib/prompts/analytics.ts`: add `getInterviewAnalyticsPromptV2(args)` per design.md Decision 10 (11 ordered sections). Each section is a labeled block; sections with no content for the given interview render the explicit "(none provided)" fallback or are omitted (MUST_HAVES omits when empty per Decision 5).
- [x] 4.2 The TRANSCRIPT section renders `args.transcriptObject` as labeled lines: `AGENT: <content>` / `CANDIDATE: <content>`. Skip turns with empty content. Roles `user` → `CANDIDATE`, `agent` → `AGENT`.
- [x] 4.3 The CALL_SIGNALS section renders the structured block from design.md Decision 6, substituting values from `args.callAnalysis`, `args.disconnectionReason`, `args.durationMs`, plus the computed `candidateSpeakingSeconds` and `questionsAnswered` if the caller passed them (the service computes these before assembling the prompt).
- [x] 4.4 The HARD_RULES, BIAS_GUARDRAILS, EVIDENCE_REQUIREMENT, and ANTI_FABRICATION sections render verbatim from design.md Decisions 3, 8, and 9.
- [x] 4.5 The OUTPUT_SCHEMA section is a single line pointing to the response_format schema (the actual JSON Schema is passed via the OpenAI API, not duplicated in the prompt body).
- [x] 4.6 Mark the existing `getInterviewAnalyticsPrompt` (v1) as `/** @deprecated — kept for v1 dual-write only. New code paths MUST use getInterviewAnalyticsPromptV2. */` but keep it functional.
- [x] 4.7 **Build `ANALYTICS_V2_JSON_SCHEMA` with proper nullable syntax.** Every nullable field in `AnalyticsV2` MUST use JSON Schema array-type syntax: `{ "type": ["number", "null"] }`, NOT `{ "type": "number" }`. The two nullable fields are:
  - `perQuestionScores[].score`: `{ "type": ["number", "null"] }`
  - `redFlags[].evidenceQuote`: `{ "type": ["string", "null"] }`

  Add an ajv verification test: hand-craft a fixture for each nullable field with `null`, run the schema through ajv, expect success. If ajv fails, the model will return `0` or `""` instead of `null` and silently corrupt the `answered: false` signal.

  Also pass `{ strict: true }` to the OpenAI `response_format` to force enforcement: `response_format: { type: 'json_schema', json_schema: { name: 'analytics_v2', strict: true, schema: ANALYTICS_V2_JSON_SCHEMA } }`.

  The schema constant lives in `src/lib/prompts/analytics.ts` (co-located with the prompt builder). Verify field-for-field against the TypeScript interface.

## 5. Hard-Cap Pure Function

- [x] 5.x **Pre-compute `promptTimeQuestionsAnswered`.** Implement helper `countSubstantiveUserTurns(transcript_object, questions)` (reuse logic from `retellReviewArtifacts.countQuestionsCovered` if the heuristic matches; otherwise mirror it: count user turns with >= 8 words or >= 40 chars). Pass the result into the prompt builder's CALL_SIGNALS block as the `questionsAnswered` value. This pre-computation happens BEFORE calling the model.
- [x] 5.1 Add `applyHardCaps(modelOutput: AnalyticsV2, retellSignals, questionsTotal): AnalyticsV2` in `src/services/analytics.service.ts` (or a sibling `src/services/analytics-v2-caps.ts` if it grows). Pure function, no I/O.
- [x] 5.2 Compute `candidateSpeakingSeconds` by walking `retellSignals.transcriptObject` for turns with `role === 'user'`. For each user turn, compute duration as `t.words[t.words.length - 1].end - t.words[0].start` (word timestamps are seconds since call start). If a user turn has no `words` array or `words` is empty, contribute 0 for that turn (do not throw). Return `0` if `transcriptObject` is missing, undefined, or empty. See design.md §3 field reference for the exact shape (turn-level `start_timestamp`/`end_timestamp` do NOT exist).
- [x] 5.3 Compute `agentSpeakingSeconds` analogously for `role === 'agent'` using the same word-level approach. Used by the `agent_only_speech` rule.
- [x] 5.4 Determine `questionsAnswered` from `modelOutput.perQuestionScores.filter(q => q.answered).length`. This is independent of what the model put in any `questionsAnswered` field.
- [x] 5.5 Compute the four `hardRulesTriggered` predicates per design.md Decision 3 table. Each triggered rule pushes `{ rule, detail }` onto the `hardRulesTriggered` array.
- [x] 5.6 Take `min(modelOutput.overallScore, cap)` across all triggered caps; if `no_answers` or `agent_only_speech` triggers, additionally set `recommendation = 'insufficient_data'` and `confidence = 'insufficient'`.
- [x] 5.7 Write a unit test (or assertion harness) covering: clean call (no caps), no-answers call (cap to 20), 15s speech call (cap to 40), abandoned call (cap to 50), agent-only call (cap to 10), multiple caps stacked (lowest wins), `callOutput` without `call_analysis` (expects sentinel substituted + `agent_only_speech` trigger appended). Tests live in `src/services/__tests__/analytics-v2-caps.test.ts` (or the project's existing test directory).

## 6. v2 Service Function

- [x] 6.1 Add `runAnalyticsV2(args)` in `src/services/analytics.service.ts` per design.md §Service Layer Contract. The function builds the prompt via `getInterviewAnalyticsPromptV2`, calls OpenAI with the locked parameters (`temperature: 0`, `seed: 7`, `response_format: { type: 'json_schema', json_schema: ANALYTICS_V2_JSON_SCHEMA }`, `model: ANALYTICS_V2_MODEL`), parses the response, runs `applyHardCaps`, and returns the final `AnalyticsV2`.
- [x] 6.2 If the OpenAI SDK version in use doesn't accept `seed`, drop the `seed` argument and add a comment referencing the SDK upgrade follow-up. Determinism is degraded but acceptable.
- [x] 6.3 Verify the call returns valid JSON matching the schema (the `response_format: json_schema` with `strict: true` guarantees this — but add a defensive `try/catch` around the parse and surface a clean error if parsing fails).
- [x] 6.4 Centralize the v2 call args (transcript turns, call analysis, JD, seniority, must-haves, role title, expected duration, questions) into a single `RunAnalyticsV2Args` type so the webhook callsite stays readable.
- [x] 6.x **Defensive `call_analysis`.** Guard `callOutput.call_analysis` with `?? callAnalysisSentinel`. Add unit test in §5.7: feeds `callOutput` without `call_analysis` → expects sentinel + `agent_only_speech` trigger appended.
- [x] 6.y **Service uses two questionsAnswered values.** Prompt builder receives `promptTimeQuestionsAnswered` (transcript-derived, pre-computed before model call). `applyHardCaps` and `AnalyticsV2.questionsAnswered` field both use `modelOutput.perQuestionScores.filter(q => q.answered).length` (model-derived). Document the intentional divergence in code comments — the two values may disagree by ±1 for borderline turns, which is expected and acceptable.

## 7. Webhook Dual-Write

- [x] 7.1 In `src/app/api/response-webhook/route.ts`: after the existing v1 call (preserve it), branch on `ANALYTICS_V2_ENABLED`. When true, also call `runAnalyticsV2` with the same context.
- [x] 7.1.x **Snapshot env flags before first await.** `const v2Enabled = process.env.ANALYTICS_V2_ENABLED === 'true'; const v2AsPrimary = process.env.ANALYTICS_V2_AS_PRIMARY === 'true';` at the top of the handler. Pass these as args to downstream helpers; do not re-read `process.env` inside helpers.
- [x] 7.2 Compute `primary` and `secondary` per design.md §Webhook dual-write contract: when `ANALYTICS_V2_AS_PRIMARY=true`, primary is v2 and secondary is v1; otherwise primary is v1 and secondary is v2.
- [x] 7.3 Update the Supabase update statement to write `analytics: primary` and `analytics_v1: secondary`. When only one flag is on (only v1 or only v2), `secondary` is `null` and `analytics_v1` is set to `null`.
- [x] 7.4 Wrap the v2 call in a try/catch so a v2 failure does NOT break the webhook (v1 still writes through). Log the v2 error to console.error with the response_id for debugging.
- [x] 7.5 Confirm that when both flags are `false` (default), the webhook behavior is identical to today (v1-only, written to `analytics`, `analytics_v1` is null).

## 8. Dashboard Read Path

- [x] 8.1 **Create new component `AnalyticsV2Banner`** (sibling file `src/components/call/analyticsV2Banner.tsx`). Renders the full-width tinted verdict bar. Props: `recommendation`, `confidence`, `overallScore`, `highSeverityFlagCount`, `hardRulesTriggered`. Logic:
  - Compute background tint from `recommendation` using the Tailwind classes locked in design.md Decision OD-4 (`bg-green-50 dark:bg-green-950/30` for `strong_yes`, etc.). Verify these utility classes exist in the project's Tailwind config before use (see Inline fix 6).
  - If `recommendation === 'insufficient_data'`: render the degenerate layout — callout text "This session had insufficient candidate signal to produce a score." followed by each `hardRulesTriggered[].detail` string verbatim as a bullet. Do NOT render a score gauge in this path.
  - Else: render recommendation label (`text-2xl font-semibold`) + confidence chip inline + overall score as secondary element (`text-lg`). When `confidence === 'low' || confidence === 'insufficient'`: apply `opacity-50` to the score gauge AND render inline warning text below it: "Limited signal — treat score as indicative only."
  - If `highSeverityFlagCount > 0`: render compact "⚠ N high-severity flags" link that scrolls to the red-flags panel anchor (`#red-flags`).
  - Recommendation badge must include a glyph: ✓ for yes-family (`strong_yes`, `yes`, `lean_yes`), ✗ for no-family (`lean_no`, `no`), — for `insufficient_data` (accessibility — color alone is not sufficient).

- [x] 8.2 **Create `AnalyticsV2View`** (`src/components/call/analyticsV2View.tsx`). Top-level v2 renderer. Renders components in this order:
  1. `<AnalyticsV2Banner/>` — always first
  2. Overall feedback card — always visible, full width
  3. `<DimensionsAccordion/>` — accordion on mobile (default-collapsed except first row), grid on desktop. When `recommendation === 'insufficient_data'`, omit entirely.
  4. `<RedFlagsPanel/>` — anchored with `id="red-flags"`. High-severity flags rendered with red icon + the word "High" (not just color — accessibility). Medium/low rendered with their respective word labels.
  5. `<PerQuestionSection/>` — implemented as a `<details>` element: default-collapsed on mobile, default-open on desktop (via JS/CSS media check on mount).
  6. `<EvidenceGapsCard/>` and `<HardRulesPanel/>` — both collapsed by default with badge count visible (e.g., "Evidence gaps (3)", "Hard rules (1)"). When `recommendation === 'insufficient_data'`, `<HardRulesPanel/>` is always expanded (it contains the explanation).

- [x] 8.3 **Replace v1 truthy guards in `callInfo.tsx`** with the discriminated-union branch: locate the existing `analytics?.communication &&` and `analytics?.questionSummaries &&` conditionals and replace each with `isAnalyticsV2(analytics) ? <V2Panel/> : <V1Panel/>`. Do not leave the v1 guard wrapping a v2-aware renderer — it will short-circuit on v2 rows (confirmed required per design.md Decision 12).

- [x] 8.4 **Empty `evidenceQuotes: []` handling** — in the dimension accordion row, when the quotes array is empty, show "No candidate evidence" as a label in the collapsed state instead of an empty expand target. Do not render the expand affordance at all when there are no quotes.

- [x] 8.5 **Weight column rendering** — render each dimension's `weight` as a percentage label (e.g., `"25%"` for `0.25`) next to the dimension name. Do NOT render the raw decimal. Do NOT omit it — recruiters benefit from seeing relative weight to understand score contributions.

- [x] 8.6 **Accessibility requirements:**
  - Recommendation badge: include a glyph (✓ / ✗ / —) alongside color, as specified in task 8.1.
  - Severity badges on red flags: include the word ("High" / "Medium" / "Low"), not just color.
  - Score gauge: `aria-label="<score> out of 100 — <recommendation label>"` (e.g., `aria-label="78 out of 100 — Lean Yes"`).

- [x] 8.7 **Backward compat for very old v1 rows missing `communication`** — in `AnalyticsV1View`, when `analytics.communication` is `null` or `undefined`, render a single line "Communication score not available for this response" instead of silently omitting the section.

- [x] 8.x At the top of `callInfo.tsx`, branch via `isAnalyticsV2(analytics)` (helper from task 2.4) and render `<AnalyticsV2View>` or `<AnalyticsV1View>` accordingly.

- [x] 8.8 Confirm v1 rows render exactly as they do today (no regression on existing responses). Confirm `AnalyticsV2View` renders correctly for both the normal path and the `insufficient_data` degenerate path.

## 9. Hiring Workflow Adapter

- [x] 9.1 In `src/lib/hiring-workflow.ts`: update `getResponseScore(response)` to branch via `isAnalyticsV2`: v2 returns `analytics.overallScore`; v1 returns the existing path.
- [x] 9.2 Update `getResponseSummary(response)` similarly: v2 returns `analytics.overallFeedback`; v1 returns `analytics.softSkillSummary`.
- [x] 9.3 Audit all other callers of `response.analytics` in the codebase (`grep -r "\.analytics" src/`) for v1-specific field reads (`analytics.communication`, `analytics.questionSummaries`, etc.). Each call site must either branch via `isAnalyticsV2` or be moved behind an accessor in `hiring-workflow.ts`. The accessor pattern is preferred.
- [x] 9.4 If any v1-specific field is read in a v2-incompatible way, add a TODO with the accessor name; do not silently ignore.

## 10. Calibration Harness

- [x] 10.1 Create `scripts/calibrate-analytics.ts` per design.md Decision 14. CLI args: `--limit N` (default 50), `--since ISO` (default `now() - 30 days`), `--out FILE` (default `calibration-<ISO>.csv`).
- [x] 10.2 Connect to Supabase using the service-role key (read from env). Select responses joined to interviews with non-null `analytics`.
- [x] 10.3 For each response, rebuild the v2 args from the joined interview row + `response.details` (Retell signals) and call `runAnalyticsV2`.
- [x] 10.4 Diff against the stored v1 (or stored v2 in `analytics_v1` during dual-write) and emit one CSV row per response with: `response_id`, `interview_name`, `v1_score`, `v2_score`, `v2_recommendation`, `hard_rules_triggered` (comma-joined), `delta` (v2_score − v1_score), `notes` (any parse failures or context-missing flags).
- [x] 10.5 Document the harness in a comment at the top of the file with usage examples. No package.json script wiring required — operators run `tsx scripts/calibrate-analytics.ts`.

## 11. Documentation

- [x] 11.1 Update `CHANGELOG.md` with a new entry describing the v2 analytics change, the two new env flags, the DDL migration, the dual-write window, and the rollback path. Reference the OpenSpec change name.
- [x] 11.2 Add a brief "Analytics pipeline (v1 vs v2)" section to `AGENTS.md` (or `README.md` if the project uses README for engineering docs). Explain: v1 is legacy; v2 is hiring-grade with hard caps + JD context; the two flags control rollout.
- [x] 11.3 Add `.env.example` documentation for `ANALYTICS_V2_ENABLED` and `ANALYTICS_V2_AS_PRIMARY` (covered in task 3.4 — confirm both flags are present with explanatory comments).

## 12. Verification

- [x] 12.1 Run `tsc --noEmit` — zero type errors.
- [x] 12.2 Run unit tests for `applyHardCaps` (task 5.7) — all pass.
- [x] 12.3 With both flags `false`, exercise the webhook path with a sample call payload (mock or staging) and confirm v1 still writes to `analytics`, `analytics_v1` is null, and the dashboard renders v1 exactly as before.
- [x] 12.4 With `ANALYTICS_V2_ENABLED=true, ANALYTICS_V2_AS_PRIMARY=false`, exercise the webhook path and confirm v1 writes to `analytics`, v2 writes to `analytics_v1`, and the dashboard still renders v1.
- [x] 12.5 With both flags `true`, exercise the webhook path and confirm v2 writes to `analytics`, v1 writes to `analytics_v1`, and the dashboard renders the v2 view.
- [x] 12.6 Run the calibration harness against staging data (or a fixture) and confirm the CSV is produced with the expected columns.
- [x] 12.7 **OPERATOR ACTION REQUIRED — manual smoke test:** (a) trigger an empty-transcript / no-candidate-speech call → confirm `recommendation = 'insufficient_data'`, `overallScore ≤ 20`, `hardRulesTriggered` contains `no_answers` (and/or `agent_only_speech`). (b) Trigger a short-call (~15s candidate speech) → confirm `overallScore ≤ 40`, `hardRulesTriggered` contains `short_call`. (c) Trigger an abandoned call → confirm cap to 50. (d) Trigger a normal full-length call → confirm v2 produces a coherent recommendation with evidence quotes in every dimension. **Prerequisite:** task 1.8 has been completed.

## Inline fixes during apply

These are minor findings that don't require their own tasks but must be addressed inline during the apply step:

1. `src/lib/hiring-workflow.ts` lines 160–165: use `isAnalyticsV2` branch (do NOT add a `softSkillSummary?` field to v2 to suppress the TS error).
2. Before `ANALYTICS_V2_AS_PRIMARY=true`, manually review 5–10 calibration responses from candidates with diverse name/accent backgrounds — document as a non-code checkpoint in §13 (rollout sequence) or §11 (documentation).
3. Calibration script: detect `analytics_v1.schemaVersion === 2` to know whether the secondary column holds v1 or v2 during the dual-write window (needed to correctly label diff columns in the CSV).
4. `ANALYTICS_V2_JSON_SCHEMA` lives in `src/lib/prompts/analytics.ts` (co-located with the prompt builder), not in a sibling file.
5. Task ordering 4→5→6 is fine if `applyHardCaps` is in a sibling file `src/lib/analytics-v2-caps.ts`; confirm import path is correct before starting the apply step.
6. Verify the four Tailwind tint classes (`bg-green-50`, `bg-red-50`, `bg-stone-100`, plus the dark variants `dark:bg-green-950/30`, `dark:bg-red-950/30`, `dark:bg-stone-900`) actually exist in the project's Tailwind config / DESIGN.md. If any are missing or not safelisted, use the closest existing semantic tokens rather than adding new arbitrary values.
7. The `analytics_v1` column name is acknowledged as confusing (it holds whichever payload is NOT primary during dual-write, not necessarily the v1 payload). Track a follow-up rename to `analytics_secondary` for after the v2 cutover, once `ANALYTICS_V2_AS_PRIMARY=true` is stable and v1 dual-write is turned off.
