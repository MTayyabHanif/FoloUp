## Why

The `hiring-grade-analytics-scoring` change shipped the v2 analytics pipeline and explicitly deferred three items to keep the landing surface small. Now that v2 is the only path (env gating removed, v1 dual-write dropped), those deferred items become the immediate priority:

1. **Calibration harness** — before operators trust v2 scores to make hiring decisions, they need a way to replay historical calls offline and inspect how the new scoring behaves. The archived design captured the script's purpose but did not implement it.
2. **Interview create-form UI for JD/seniority/must_haves** — the DB columns exist and the types are enforced, but the create-form still cannot set them. Every new interview defaults to empty JD, `'mid'` seniority, and zero must-haves, which means v2 scores blind on role_fit and must-have coverage.
3. **Unit tests for `applyHardCaps`** — the hard-cap function is the single most load-bearing piece of the v2 pipeline (it prevents the 78/100 hallucination regression), but it ships with no test coverage. Any future modification is unprotected.

Together these three items complete the v2 rollout: the harness validates existing data, the form feeds good data into new interviews, and the tests lock behavior so the pipeline can be extended safely.

## What Changes

- **`scripts/calibrate-analytics.ts`** (new): a CLI script that connects to Supabase with the service-role key, replays up to N historical `response` rows through `runAnalyticsV2`, and emits a CSV diff (`original_score` vs `v2_score`, delta, hard rules triggered, evidence quote count, notes on any per-row failures). Requires `tsx` in devDependencies and a new `SUPABASE_SERVICE_ROLE_KEY` env var (documented in `.env.example`, required only for this script).
- **`src/components/dashboard/interview/create-popup/details.tsx`** (modified): adds three new form fields — `job_description` (Textarea), `seniority` (shadcn Select, options: junior/mid/senior/staff/principal), and `must_haves` (repeatable chip list with Add button + click-to-remove). The new fields are grouped in a labeled "Hiring criteria" section inserted between the existing Objective textarea and the FileUpload row.
- **`src/lib/analytics-v2-caps.test.mjs`** (new): ten table-driven test cases covering `applyHardCaps`, `computeCandidateSpeakingSeconds`, `countSubstantiveUserTurns`, and `computeOverallScoreFromDimensions`. Uses `node:test` + `node:assert/strict`, matching the existing `retellReviewArtifacts.test.mjs` style. Runs via `node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs`.

## Capabilities

### New Capabilities

- `analytics-v2-calibration-harness`: Offline replay of historical calls through the v2 scoring pipeline, producing a CSV diff for operator review before trusting v2 scores in production hiring decisions.

### Modified Capabilities

- `interview-create-form`: Interview creation now accepts `job_description`, `seniority`, and `must_haves`, giving v2 the context it needs for role-fit and must-have coverage scoring. All three fields flow through the existing submit handlers (`onGenrateQuestions` and `onManual`).
- `analytics-v2-hiring-grade` (tested): The `applyHardCaps` pure function now has table-driven test coverage locking all hard-cap rules, stacking behavior, and edge cases against regression.

## Non-Goals

- No DB schema changes — all three columns (`job_description`, `seniority`, `must_haves`) already exist on the `interview` table.
- No new API routes or server actions — the form submits through the existing create flow.
- No calibration harness UI — the script is a CLI tool only; its output (CSV) is reviewed offline.
- No editing of JD/seniority/must_haves on existing interviews (create-form only; an edit-form follow-up is separate).
- No change to the v2 prompt or scoring logic — this change is purely additive (tooling + UI + tests).
- No migration SQL — not needed.

## Success Criteria

1. `npx tsx scripts/calibrate-analytics.ts --limit 5` runs to completion on staging, produces a valid CSV with at least 5 rows and all expected columns, and exits 0.
2. Creating a new interview via the UI and supplying a job description, seniority level, and at least one must-have persists all three values to the DB (verifiable via Supabase table editor or `SELECT` query).
3. All 10 test cases in `src/lib/analytics-v2-caps.test.mjs` pass with `node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs`.

## Impact

- **`scripts/calibrate-analytics.ts`** (new file, new directory).
- **`package.json`**: add `tsx` to `devDependencies`.
- **`.env.example`**: add `SUPABASE_SERVICE_ROLE_KEY` with an explanatory comment.
- **`src/components/dashboard/interview/create-popup/details.tsx`**: new state slices, shadcn Select import, chip-list pattern, layout grouping, submit-handler spread for three new fields.
- **`src/lib/analytics-v2-caps.test.mjs`** (new file, co-located with `analytics-v2-caps.ts`).
- **No changes to** `supabase_schema.sql`, `src/types/`, `src/services/`, `src/lib/prompts/`, `src/app/api/`, or dashboard read-path components.
