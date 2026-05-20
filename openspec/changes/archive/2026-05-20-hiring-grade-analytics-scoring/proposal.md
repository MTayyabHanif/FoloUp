## Why

The current analytics pipeline produces hiring-grade decisions that don't survive scrutiny. The originating bug: a recent interview with effectively **zero candidate signal** (the candidate barely spoke, no real answers were given) was scored `78/100` and surfaced to recruiters as a strong candidate. The current v1 prompt (`getInterviewAnalyticsPrompt` in `src/lib/prompts/analytics.ts`) has no concept of job description, must-haves, candidate speaking time, abandoned-call handling, or evidence requirements. It rates "soft skills" on a 0–100 scale with no hard floor for empty interviews, no anti-fabrication guardrails, and no bias guardrails. The model happily invents qualities that don't exist in the transcript.

This change rewrites the analytics pipeline as a hiring-grade evaluator: structured dimensions with weights, an explicit recommendation enum, deterministic hard-cap rules computed in code (not by the LLM), JD/must-haves/seniority context fed into the prompt, Retell call signals folded in, evidence requirements with direct candidate quotes, bias guardrails, and a `json_schema` response format with `temperature: 0` + fixed seed for determinism. It ships behind two feature flags (`ANALYTICS_V2_ENABLED` and `ANALYTICS_V2_AS_PRIMARY`) so v1 and v2 dual-write for ~7 days before the dashboard flips to v2 as the displayed score.

## What Changes

- **DDL migration on `interview`**: add `job_description TEXT NOT NULL DEFAULT ''`, `seniority TEXT NOT NULL DEFAULT 'mid'`, `must_haves JSONB NOT NULL DEFAULT '[]'`. Required for v2 prompt context. Defaults make the migration safe for existing rows; later, UI validation can enforce non-empty values on create/edit.
- **DDL migration on `response`**: add `analytics_v1 JSONB NULL` so dual-write can preserve the legacy v1 output alongside the new v2 output in the existing `analytics` column.
- **New v2 analytics shape**: discriminated-union type `AnalyticsV2 { schemaVersion: 2, ... }` with dimensions[], overallScore (0–100), recommendation enum, per-question scores, red flags, evidence gaps, hard-rules triggered, candidate speaking seconds, and Retell call signals snapshot. v1 rows pass through unchanged (no `schemaVersion` field = v1).
- **New v2 prompt builder**: `getInterviewAnalyticsPromptV2(args)` in `src/lib/prompts/analytics.ts` with 11 ordered sections (ROLE, JOB_DESCRIPTION, MUST_HAVES, INTERVIEW_QUESTIONS, CALL_SIGNALS, TRANSCRIPT with separated turns, HARD_RULES, BIAS_GUARDRAILS, EVIDENCE_REQUIREMENT, ANTI_FABRICATION, OUTPUT_SCHEMA). The legacy `getInterviewAnalyticsPrompt` is kept temporarily for v1 dual-write but marked deprecated.
- **Service rewrite**: `src/services/analytics.service.ts` gains a v2 branch gated on `ANALYTICS_V2_ENABLED`. v2 calls OpenAI with `temperature: 0, seed: 7, response_format: { type: 'json_schema', json_schema: {...} }`. Hard-cap rules (0 questions answered → `insufficient_data` + score cap 20; <30s candidate speaking → cap 40; abandoned/interrupted call → cap 50) are computed **in code** from Retell signals and then applied to the model output deterministically — the LLM cannot override them.
- **Webhook dual-write**: `src/app/api/response-webhook/route.ts` writes v2 to `analytics` (when v2 enabled), v1 to `analytics_v1` (when both flags enabled). When `ANALYTICS_V2_AS_PRIMARY=false`, the dashboard still reads `analytics` (which is v1 in single-write mode). When `ANALYTICS_V2_AS_PRIMARY=true`, `analytics` holds v2 and `analytics_v1` holds the legacy v1.
- **Dashboard read path**: `src/components/call/callInfo.tsx` detects `analytics.schemaVersion === 2` and renders the new dimensions table, recommendation badge, red-flags panel, and evidence-gaps panel. v1 rows (no `schemaVersion`) render with the existing UI unchanged.
- **Hiring-workflow adapter**: `src/lib/hiring-workflow.ts` updates `getResponseScore()` to read `overallScore` from either shape, and `getResponseSummary()` to read `softSkillSummary` (v1) or `overallFeedback` (v2). All downstream consumers (decision_makers signal, recruiter view) work for both versions.
- **Calibration harness**: `scripts/calibrate-analytics.ts` replays N historical calls through the v2 prompt and diffs against stored v1 outputs. Produces a CSV report (per-call v1 score, v2 score, recommendation, hard-rules triggered, delta) for offline review during the 7-day dual-write window.
- **Bias guardrails**: explicit prompt instruction forbidding inference about protected attributes (age, gender, national origin, race, accent-as-proxy, disability, religion). Positive instruction to score communication on participation + clarity, not native-speaker status.
- **Documentation**: update `CHANGELOG.md` with the migration note + flag-rollout sequence.

## Capabilities

### New Capabilities

- `analytics-v2-hiring-grade`: Hiring-grade response analytics with JD-aware scoring dimensions, recommendation enum, deterministic hard-cap rules, evidence requirements, bias guardrails, and a versioned schema (`schemaVersion: 2`).

### Modified Capabilities

- `response-analytics` (existing v1 path): v1 prompt + scoring remain available behind the `ANALYTICS_V2_ENABLED=false` flag. When v2 is the primary, v1 still dual-writes to `analytics_v1` for calibration. The v1 output shape is unchanged — readers detect version by the presence/absence of `schemaVersion`.

## Impact

- **`supabase_schema.sql`**: three new columns on `interview` (`job_description`, `seniority`, `must_haves`), one new column on `response` (`analytics_v1`).
- **`src/types/database.types.ts`**: add the new columns to `interview.Row/Insert/Update` and `response.Row/Insert/Update`.
- **`src/types/interview.ts`**: add `job_description: string`, `seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'principal'`, `must_haves: string[]` to `InterviewBase`. All three are required at the TypeScript level; DDL defaults cover existing rows.
- **`src/types/response.ts`**: add `AnalyticsV2` interface as a discriminated union with v1 via `schemaVersion`. Update `Analytics` to be `AnalyticsV1 | AnalyticsV2`.
- **`src/lib/prompts/analytics.ts`**: add `getInterviewAnalyticsPromptV2(args)`. Mark `getInterviewAnalyticsPrompt` as `@deprecated` but keep it operational for v1 dual-write.
- **`src/services/analytics.service.ts`**: branch on `ANALYTICS_V2_ENABLED`. v2 path calls OpenAI with `temperature: 0, seed: 7, response_format: json_schema`; computes hard caps in code; assembles `AnalyticsV2`.
- **`src/app/api/response-webhook/route.ts`**: dual-write logic when both flags are on; primary-write switching keyed on `ANALYTICS_V2_AS_PRIMARY`.
- **`src/components/call/callInfo.tsx`**: schema-aware rendering. v1 path untouched; v2 path renders new panels.
- **`src/lib/hiring-workflow.ts`**: `getResponseScore()` and `getResponseSummary()` become version-aware.
- **`scripts/calibrate-analytics.ts`** (new): CLI script for replay + diff during the calibration window.
- **`.env.example` and deployment config**: add `ANALYTICS_V2_ENABLED` (default `false`) and `ANALYTICS_V2_AS_PRIMARY` (default `false`) flags. Both default off so the change is a no-op until explicitly turned on.
- **`CHANGELOG.md`**: migration note + rollout sequence.
- **Branch**: applied on `main` (no parallel feature branch dependency).
