## Context

The current analytics pipeline lives at `src/services/analytics.service.ts` and is triggered from `src/app/api/response-webhook/route.ts` after Retell posts a call completion webhook. It calls OpenAI (`openai.chat.completions.create` with `response_format: { type: 'json_object' }`) using the prompt from `src/lib/prompts/analytics.ts::getInterviewAnalyticsPrompt(transcript, questions, mins)`. The model is asked to return `{ overallScore, communication: { score, feedback }, softSkillSummary, generalIntelligence, questionSummaries[] }`. Output lands in `response.analytics` (JSONB). The dashboard reads `analytics` directly in `src/components/call/callInfo.tsx`. There is no JD context, no seniority, no must-haves, no Retell-signal fold-in, no determinism, no hard-cap rules, and no evidence requirement. The model can hallucinate qualities the candidate never demonstrated, and that hallucination became the 78/100 production bug.

The `interview` table currently has `name`, `description`, `questions JSONB`, `interviewer_id`, `objective`, `time_duration`, etc. — no `job_description`, no `seniority`, no `must_haves`. The `response` table has `call_id`, `details JSONB` (Retell call metadata), `analytics JSONB`, `candidate_status`, etc. There is no version field on `analytics`, so any new shape must be detectable structurally — we use the presence of `schemaVersion: 2` as the discriminator.

Retell webhooks already post a `call_analysis` block with `call_summary`, `user_sentiment`, `call_completion_rating`, `call_completion_rating_reason`, plus top-level `disconnection_reason`, `duration_ms`, and `transcript_object` (an array of turns with `role: 'agent' | 'user'`). These signals are stored in `response.details` today but are NOT fed into the analytics prompt. v2 changes that: they go into a dedicated CALL_SIGNALS block, and the `transcript_object` is rendered as labeled turns (AGENT: / CANDIDATE:) instead of a single text blob.

## Goals / Non-Goals

**Goals:**

- Add `job_description TEXT`, `seniority TEXT`, `must_haves JSONB` to the `interview` table.
- Add `analytics_v1 JSONB NULL` to the `response` table to hold the legacy v1 output during dual-write.
- Ship `AnalyticsV2` as a discriminated-union type alongside the existing v1 shape, keyed on `schemaVersion: 2`.
- Build a v2 prompt with 11 ordered sections: ROLE, JOB_DESCRIPTION, MUST_HAVES, INTERVIEW_QUESTIONS, CALL_SIGNALS, TRANSCRIPT, HARD_RULES, BIAS_GUARDRAILS, EVIDENCE_REQUIREMENT, ANTI_FABRICATION, OUTPUT_SCHEMA.
- Compute hard-cap triggers in code (not by the LLM) from Retell signals, then apply them deterministically to the assembled output.
- Call OpenAI with `temperature: 0, seed: 7, response_format: json_schema`.
- Add two env flags: `ANALYTICS_V2_ENABLED` (controls whether v2 is generated) and `ANALYTICS_V2_AS_PRIMARY` (controls whether the dashboard reads v2 as the displayed score). Default both `false` so the change is a no-op on land.
- Make the read path (`callInfo.tsx`, `getResponseScore`, `getResponseSummary`) schema-aware: v1 rows render unchanged, v2 rows render the new panels.
- Provide a calibration harness for offline replay + diff during the dual-write window.

**Non-Goals:**

- No multi-sample voting / ensembling. Single sample per call for v2 launch.
- No prompt-versioning UI. Operators don't get a "select scoring prompt" dropdown.
- No retroactive scoring of historical calls inside the production webhook (the calibration harness handles replay offline).
- No A/B test framework with traffic splits. Dual-write means **every** response writes both v1 and v2 during the window — there is no random allocation.
- No new analytics row schema (still JSONB on `response.analytics`).
- No removal of v1. v1 stays available behind `ANALYTICS_V2_ENABLED=false` indefinitely; a future change can deprecate it once v2 has run cleanly for a stretch.
- No new UI for editing JD/seniority/must_haves on the interview create form. Defaults cover existing rows; a follow-up change can add the editor.
- No bias-audit dashboard. The bias guardrails are prompt-level; observability for them is a follow-up.

## Decisions

### 1. Two-flag rollout: `ANALYTICS_V2_ENABLED` + `ANALYTICS_V2_AS_PRIMARY`

**Decision:** Two boolean env flags, both default `false`:

- `ANALYTICS_V2_ENABLED` — when `true`, the analytics service generates v2 output on every webhook. When also `true` with v1 enabled (which is implicit — v1 always generates unless we explicitly switch off below), the webhook **dual-writes**: v2 into `analytics`, v1 into `analytics_v1` (if `ANALYTICS_V2_AS_PRIMARY=true`) or the reverse if `ANALYTICS_V2_AS_PRIMARY=false`.
- `ANALYTICS_V2_AS_PRIMARY` — when `true`, the dashboard treats `analytics` as v2; v1 lives in `analytics_v1`. When `false`, `analytics` is v1 (the dashboard sees v1, as today) and v2 lives in `analytics_v1` for offline inspection.

Rollout sequence:

1. Land code + DDL with both flags `false`. No behavior change.
2. Apply DDL migration to Supabase.
3. Turn on `ANALYTICS_V2_ENABLED=true`, `ANALYTICS_V2_AS_PRIMARY=false`. v1 stays primary; v2 dual-writes to `analytics_v1`. Calibration harness can run against `analytics_v1` rows.
4. Watch for ~7 days. No recruiter-facing change.
5. Run calibration report. If v2 looks sound and there's no recruiter complaint, flip `ANALYTICS_V2_AS_PRIMARY=true`. The dashboard now shows v2 scores; v1 continues writing to `analytics_v1` so we have rollback evidence.
6. Eventually (separate change): turn v1 dual-write off.

**Rationale:** Two flags is the minimum knob set that lets us (a) dual-write for offline calibration without recruiter visibility, then (b) flip the displayed score atomically. A single flag would conflate "generate v2" with "show v2," which forces a riskier cutover.

**Storage convention during dual-write:** the field name `analytics` is always what the dashboard reads. `analytics_v1` is whatever the dashboard is NOT reading. This keeps the read path simple — `callInfo.tsx` only needs to know about `analytics`.

### 2. AnalyticsV2 shape — discriminated union via `schemaVersion: 2`

**Decision:** Add the following TypeScript interface to `src/types/response.ts`:

```typescript
export interface AnalyticsV2 {
  schemaVersion: 2;
  recommendation:
    | 'strong_yes'
    | 'yes'
    | 'lean_yes'
    | 'lean_no'
    | 'no'
    | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  overallScore: number;                 // 0-100, derived from dimensions
  overallFeedback: string;              // 2-3 sentences
  dimensions: Array<{
    name:
      | 'role_fit'
      | 'depth_of_knowledge'
      | 'communication'
      | 'problem_solving'
      | 'examples_evidence'
      | 'professionalism';
    score: number;                      // 0-10
    weight: number;                     // 0-1, sum to 1.0
    feedback: string;                   // 1-2 sentences citing transcript evidence
    evidenceQuotes: string[];           // direct quotes from candidate turns; [] if none
  }>;
  perQuestionScores: Array<{
    question: string;
    answered: boolean;
    score: number | null;               // 0-5; null when answered=false
    summary: string;                    // "Not Asked" / "Not Answered" / evidence-backed paragraph
    evidenceQuotes: string[];
  }>;
  redFlags: Array<{
    flag: string;
    severity: 'low' | 'medium' | 'high';
    evidenceQuote: string | null;
  }>;
  evidenceGaps: string[];               // must-haves or dimensions with zero transcript signal
  hardRulesTriggered: Array<{
    rule: 'no_answers' | 'short_call' | 'abandoned' | 'agent_only_speech';
    detail: string;
  }>;
  candidateSpeakingSeconds: number;
  questionsAnswered: number;
  questionsTotal: number;
  callSignals: {
    callSummary: string;
    userSentiment: string;
    callCompletionRating: string;
    disconnectionReason: string;
    durationSeconds: number;
  };
}

export type Analytics = AnalyticsV1 | AnalyticsV2;
```

The legacy v1 (`AnalyticsV1`) keeps its existing shape — no `schemaVersion` field. Readers branch via `'schemaVersion' in analytics && analytics.schemaVersion === 2`.

**Rationale:** Discriminated union is the cleanest TypeScript pattern for additive schema evolution without runtime conversion. v1 rows in the database pass through untouched. New writes carry `schemaVersion: 2`. The codebase narrows correctly with an `if` check.

**Dimension weights (v2 launch defaults):**

| Dimension          | Weight |
|--------------------|--------|
| role_fit           | 0.25   |
| depth_of_knowledge | 0.25   |
| problem_solving    | 0.20   |
| examples_evidence  | 0.15   |
| communication      | 0.10   |
| professionalism    | 0.05   |
| **Sum**            | **1.00** |

`overallScore = round(sum(dimension.score * dimension.weight) * 10)` — i.e. the weighted average of dimension scores (each 0–10) is multiplied by 10 to produce a 0–100 score. The model is instructed to score each dimension 0–10, but the **service code computes `overallScore` itself** from the model's dimension scores. This protects against the model arithmetic-failing or refusing to compute the weighted average.

### 3. Hard-cap rules computed in code, not by the LLM

**Decision:** Three hard caps, all computed **in the service code** from Retell signals, **after** the model has returned its raw output. The caps then override the model's `overallScore`, `recommendation`, and `confidence` deterministically.

| Rule              | Trigger                                                                                                                            | Effect                                                                                       |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| `no_answers`      | `questionsAnswered === 0` (the model reports this, AND we verify in code by checking `perQuestionScores.every(q => !q.answered)`) | `recommendation = 'insufficient_data'`, `overallScore = min(modelScore, 20)`, `confidence = 'insufficient'` |
| `short_call`      | `candidateSpeakingSeconds < 30` (computed in code from `transcript_object` by summing `user`-role turn durations)                  | `overallScore = min(modelScore, 40)`                                                          |
| `abandoned`       | `disconnection_reason` matches one of `['user_hangup', 'dial_no_answer', 'inactivity', 'error', 'concurrency_limit_reached']` AND `duration_ms < (time_duration * 60_000 * 0.5)` (less than half the expected duration) | `overallScore = min(modelScore, 50)`                                                          |
| `agent_only_speech` | `candidateSpeakingSeconds === 0` while `agentSpeakingSeconds > 30` (defensive — implies the candidate never spoke at all)         | Treated as a stronger `no_answers`: `recommendation = 'insufficient_data'`, `overallScore = min(modelScore, 10)`, `confidence = 'insufficient'` |

When multiple caps trigger, the **lowest** cap wins (most conservative). The applied caps are recorded in `hardRulesTriggered[]` with a `detail` field explaining which threshold was hit. The model is told about the hard rules in the prompt (HARD_RULES section) so its `recommendation` typically aligns, but the **code applies the caps regardless** of what the model returned.

**Rationale:** The 78/100 bug happened because the model was solely responsible for noticing "the candidate didn't really speak." Models are not reliably good at this kind of arithmetic over their own input. Computing the caps in code from Retell's structured signals is deterministic, testable, and impossible for the model to override. The prompt still tells the model to apply these caps (so the model's narrative `overallFeedback` reads coherently) but the numeric truth is asserted by code.

**`candidateSpeakingSeconds` computation:** Walk `transcript_object`. For each turn with `role: 'user'`, compute the duration from word-level timestamps:

```
candidateSpeakingSeconds =
  sum over transcript_object[t] where t.role === 'user' of:
    if t.words.length === 0: 0
    else: t.words[t.words.length - 1].end - t.words[0].start
  // result is in seconds (Retell word timestamps are seconds since call start)
```

**Edge cases:**
- Empty `transcript_object` → 0
- User turn with no `words` array (rare; legacy payload) → 0 for that turn, do not fail
- If `transcript_object` is missing entirely (only `transcript` string present) → 0, and `hardRulesTriggered` adds `{ rule: 'agent_only_speech', detail: 'transcript_object unavailable; cannot verify candidate speech' }`

> **Field reference** (src/types/response.ts lines 68-76):
> ```ts
> transcript_object: Array<{
>   role: 'agent' | 'user';
>   content: string;
>   words: Array<{
>     word: string;
>     start: number;  // seconds since call start
>     end: number;    // seconds since call start
>   }>;
> }>
> ```
> Note: turn-level `start_timestamp`/`end_timestamp` do NOT exist. Only word-level `start`/`end` (seconds) and call-level `start_timestamp`/`end_timestamp` (ms since epoch) on `CallData` itself.

### 4. Determinism: `temperature: 0`, `seed: 7`, `response_format: json_schema`

**Decision:** v2 OpenAI calls use:

```typescript
{
  model: 'gpt-4o-2024-08-06',          // or whatever the project already uses; pin to a dated snapshot
  temperature: 0,
  seed: 7,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'analytics_v2',
      strict: true,
      schema: { /* JSON Schema mirror of AnalyticsV2 */ }
    }
  },
  messages: [{ role: 'user', content: getInterviewAnalyticsPromptV2(args) }]
}
```

**Rationale:** `temperature: 0` + fixed `seed` gives near-deterministic outputs on the same input. `response_format: json_schema` with `strict: true` forces the model to return a value that parses against the schema — no more "the model returned slightly different JSON shape on retry" failures. Single sample per call — no ensembling for launch. The schema lives next to the TypeScript type in `src/lib/prompts/analytics.ts` (or a sibling file) so the two stay in sync. If the OpenAI client used in this codebase doesn't support `seed` (older SDK versions), drop `seed` and rely on `temperature: 0` alone — note that as a follow-up upgrade.

**Model pinning:** The model identifier MUST be a dated snapshot (e.g., `gpt-4o-2024-08-06`), not a rolling alias (`gpt-4o`). Rolling aliases break determinism when OpenAI updates the underlying weights. The exact snapshot is finalized in apply, but the principle is locked here.

### 5. JD ingestion — three required fields on InterviewBase

**Decision:** Add to `interview` table and `InterviewBase` TypeScript type:

- `job_description: string` — full JD text. Empty string allowed (DDL default), but the v2 prompt warns "no JD provided" when it's empty.
- `seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'principal'` — drives the ROLE section ("You are evaluating a [seniority] [role_title] candidate"). Default `'mid'` for existing rows.
- `must_haves: string[]` — bullet list of non-negotiable requirements. Empty array allowed (DDL default `'[]'`). When empty, the prompt omits the MUST_HAVES section entirely so the model doesn't invent must-haves from the JD.

All three are required at the **TypeScript** level (no `?`). DDL defaults handle existing rows so the change is non-breaking. A follow-up change will add the editor UI on the interview create form.

**Rationale:** The model needs grounding for "role fit." Without a JD, it scores against an imagined role and the result is meaningless. Forcing the type to require the fields (with safe defaults at the DB level) keeps the read path simple and forces the create flow to address them when the editor UI lands.

### 6. Retell signals fold-in — structured CALL_SIGNALS block

**Decision:** The prompt's CALL_SIGNALS section is a structured block, not free text:

```
CALL_SIGNALS
- Call summary (from Retell): <call_summary>
- User sentiment (from Retell): <user_sentiment>
- Call completion rating (from Retell): <call_completion_rating>
- Call completion reason (from Retell): <call_completion_rating_reason>
- Disconnection reason: <disconnection_reason>
- Total call duration: <duration_seconds>s
- Candidate speaking time (computed): <candidateSpeakingSeconds>s
- Questions answered (computed): <questionsAnswered> of <questionsTotal>
```

The model is told to **use these signals as evidence** when deciding `recommendation` and `confidence`, but is also told that `candidateSpeakingSeconds` and `questionsAnswered` are computed-in-code values it should treat as ground truth (not re-derive from the transcript).

**Pre-computed `questionsAnswered` for prompt grounding.** To avoid a circular dependency (model decides which questions are answered → that count is then fed to the model as ground truth), the service computes a *prompt-time* `questionsAnswered` estimate from `transcript_object` independently:

```ts
// Count user turns with substantive content (>= 8 words or >= 40 chars), matching
// the existing heuristic in src/lib/retellReviewArtifacts.ts countQuestionsCovered.
const promptTimeQuestionsAnswered = countSubstantiveUserTurns(transcript_object, questions);
```

This value is what goes into the CALL_SIGNALS block of the prompt. The model's own `perQuestionScores.filter(q => q.answered).length` is used only AFTER the model returns, for `applyHardCaps` decisions and for the final `questionsAnswered` field on `AnalyticsV2`. The two values may disagree by ±1 for borderline turns; that's expected and acceptable.

**Rationale:** Retell already produces high-quality call-level signals. Feeding them in explicitly means the model doesn't have to re-derive "did the candidate sound engaged" from the transcript — Retell's `user_sentiment` is a better source. The computed values protect against the model under-counting candidate speech.

**`call_analysis` absent fallback.** When `callOutput.call_analysis` is `undefined` or `null`, do not throw. Substitute a sentinel `RetellCallAnalysis`:
```ts
const callAnalysisSentinel = {
  call_summary: 'N/A — Retell did not return call_analysis',
  user_sentiment: 'N/A',
  agent_sentiment: 'N/A',
  agent_task_completion_rating: 'N/A',
  agent_task_completion_rating_reason: 'N/A',
  call_completion_rating: 'N/A',
  call_completion_rating_reason: 'N/A',
};
```
Append `{ rule: 'agent_only_speech', detail: 'call_analysis missing — limited signal' }` to `hardRulesTriggered` when the sentinel is used. (Reuse the existing trigger rule rather than introducing a new one — the operator-facing effect is the same: scoring proceeds with reduced signal.)

### 7. Transcript rendering — separated turns

**Decision:** Render `transcript_object` as labeled turns in the prompt:

```
TRANSCRIPT
AGENT: <agent turn 1>
CANDIDATE: <candidate turn 1>
AGENT: <agent turn 2>
CANDIDATE: <candidate turn 2>
...
```

Each turn is one labeled line (multi-line content within a turn is kept on the same logical entry, with the label prefix on the first line only). Missing or empty turns are skipped silently.

**Rationale:** v1 fed the transcript as a single text blob. The model had to parse speaker labels from the text. Separating turns eliminates that parsing step and lets the EVIDENCE_REQUIREMENT clause ("cite a direct CANDIDATE quote") work reliably.

### 8. Bias guardrails — explicit prompt clause

**Decision:** Add a verbatim BIAS_GUARDRAILS section to the v2 prompt:

```
BIAS_GUARDRAILS
You MUST NOT infer or score based on protected attributes. This includes:
- Age
- Gender or gender identity
- National origin or ethnicity
- Race
- Accent or perceived native-speaker status
- Disability
- Religion
- Marital or family status
- Sexual orientation

Do not infer these attributes from voice, name, accent, or any transcript content.
Do not score "communication" lower because of accent or non-native fluency.
Score communication on PARTICIPATION (did the candidate engage?) and CLARITY (was their meaning understandable?), not on accent or grammar.
If a candidate's transcript contains references to protected attributes (e.g., "I'm a recent graduate" → age inference), ignore those references when scoring.
```

**Rationale:** Without an explicit clause, models will sometimes penalize non-native English speakers or make demographic inferences from voice cues. The clause is verbatim because we want to be able to audit the exact text shipped to the model.

### 9. Anti-fabrication clause

**Decision:** Add a verbatim ANTI_FABRICATION section:

```
ANTI_FABRICATION
You MUST NOT invent, infer, or assume skills, experiences, qualities, or characteristics that are not directly supported by CANDIDATE turns in the TRANSCRIPT.
If the candidate did not speak about a topic, you must say so in the relevant dimension's feedback and score that dimension low.
If a dimension has no supporting candidate quote, its score MUST be ≤3 and its evidenceQuotes array MUST be empty, and that dimension's name MUST appear in evidenceGaps.
"Inferred from professionalism" or "implied by their answers" are NOT valid evidence. Only direct quotes from CANDIDATE turns count.
```

Paired with EVIDENCE_REQUIREMENT:

```
EVIDENCE_REQUIREMENT
Every dimension feedback string MUST cite at least one direct candidate quote, or explicitly state "No candidate evidence" and score the dimension low.
Every perQuestionScores entry with answered=true MUST have at least one evidenceQuote.
Every redFlag with severity 'high' MUST have an evidenceQuote (non-null).
```

**Rationale:** This is the direct fix for the 78/100 bug. The model was given a transcript with no candidate substance and still wrote glowing dimension feedback. The clauses force every claim back to a citation.

### 10. v2 prompt structure — 11 ordered sections

**Decision:** The v2 prompt body is composed in this exact order. The full text of each section is locked at apply time; the structure is locked here.

1. **ROLE** — `You are a hiring evaluator for a [seniority] [role_title] role at [company_name].` (`role_title` is derived from `interview.name` or `interview.objective`; `company_name` is a constant.)
2. **JOB_DESCRIPTION** — full `interview.job_description` text. If empty, render `JOB_DESCRIPTION\n(none provided — score conservatively on role_fit)`.
3. **MUST_HAVES** — bullet list of `interview.must_haves`. If empty, omit the section entirely (so the model doesn't invent must-haves).
4. **INTERVIEW_QUESTIONS** — numbered list of `interview.questions[].question`.
5. **CALL_SIGNALS** — structured Retell metadata block (see Decision 6).
6. **TRANSCRIPT** — separated turns (see Decision 7).
7. **HARD_RULES** — verbatim text of the three hard-cap rules. Model is told these caps WILL be applied in code, so its `overallScore` should already reflect them.
8. **BIAS_GUARDRAILS** — verbatim (see Decision 8).
9. **EVIDENCE_REQUIREMENT** — verbatim (see Decision 9).
10. **ANTI_FABRICATION** — verbatim (see Decision 9).
11. **OUTPUT_SCHEMA** — pointer text: "Return JSON matching the schema enforced by response_format." The actual JSON Schema is passed via the API's `response_format` parameter, not duplicated in the prompt body.

**Rationale:** Section order matters for instruction-following. ROLE first (sets the lens), context (JD/must-haves/questions/signals/transcript) next, then rules (hard rules, bias, evidence, anti-fabrication) immediately before output. Putting rules last means they're freshest in the model's attention when it generates.

### 11. Service-layer hard-cap application — pure function

**Decision:** Hard-cap application is a pure function:

```typescript
function applyHardCaps(modelOutput: AnalyticsV2, retellSignals: RetellSignals, questionsTotal: number): AnalyticsV2
```

It computes `candidateSpeakingSeconds`, `questionsAnswered`, and `hardRulesTriggered` from `retellSignals` + `modelOutput.perQuestionScores`, then mutates a clone of `modelOutput` to enforce caps and returns the final `AnalyticsV2`. No I/O, no OpenAI calls. Trivially unit-testable.

**Rationale:** Keeping the cap logic pure lets us cover it with table-driven tests (see tasks §11). The webhook path becomes "call OpenAI → run `applyHardCaps` → write to DB." Each step is independently testable.

### 12. Dashboard read path — schema-aware rendering

**Decision:** `src/components/call/callInfo.tsx` detects the schema at render time:

```tsx
const isV2 = analytics && 'schemaVersion' in analytics && analytics.schemaVersion === 2;
return isV2
  ? <AnalyticsV2View analytics={analytics} />
  : <AnalyticsV1View analytics={analytics} />;
```

`AnalyticsV1View` is the existing UI (extracted into a sub-component if helpful but otherwise unchanged). `AnalyticsV2View` is a new sub-component that renders:

- A header with the recommendation badge (`strong_yes` → green, `yes` → green-soft, `lean_yes` → amber, `lean_no` → amber-soft, `no` → red, `insufficient_data` → grey) and the `overallScore` (0–100).
- A confidence chip below the score.
- `overallFeedback` as a paragraph.
- A dimensions table: name, weight, score (0–10), feedback, evidenceQuotes (collapsible).
- A per-question section: question text, answered/not-answered badge, score (0–5), summary, evidenceQuotes.
- A red flags panel: each flag with severity badge and evidenceQuote.
- An evidence gaps panel: bullet list.
- A hard-rules-triggered panel (only shown if non-empty): rule + detail.

**Critical:** The existing component contains `analytics?.communication` and `analytics?.questionSummaries` truthy guards (callInfo.tsx ~lines 462, 538). These MUST be replaced (not augmented) with `isAnalyticsV2(analytics) ? <V2Panel/> : <V1Panel/>` branches. A v2 row has no `communication` or `questionSummaries` field and will silently render nothing if the v1 guard is left in place.

**Rationale:** Schema-aware rendering keeps v1 rows working forever without conversion. The new panels are additive — operators can adapt to the new layout while v1 rows continue to look identical. Visual treatment of the v2 view is locked in `plan_design_review`.

#### Verdict bar layout (v2 only)

The following four operator decisions are locked and apply exclusively to `AnalyticsV2View`.

**Decision OD-1 — Degenerate state (`recommendation === 'insufficient_data'`):**
Hide the score gauge entirely. Replace with a callout: "This session had insufficient candidate signal to produce a score." Render the `hardRulesTriggered[].detail` strings verbatim below the callout so recruiters see WHY (e.g., "0 of 5 questions answered", "candidate spoke for 4 seconds"). In degenerate state, render only: verdict bar + overall feedback + redFlags (if any) + evidence gaps. Do not render the dimensions accordion, per-question section, or score gauge.

**Decision OD-2 — Mobile collapse priority:**
- Visible by default on small viewports: verdict bar (recommendation + confidence + score), high-severity red flags, overall feedback.
- Collapsed by default on small viewports: dimensions (accordion, tap to expand each row), per-question section (disclosure), evidence gaps + hard rules (collapsed with badge count showing item count).
- On desktop, dimensions and per-question section default to expanded.

**Decision OD-3 — Confidence visual treatment:**
When `confidence === 'low' || confidence === 'insufficient'`:
- (a) Reduce score gauge opacity to ~50% (`opacity-50` Tailwind class).
- (b) Show inline warning text below the gauge: "Limited signal — treat score as indicative only."
Both visual (opacity) and textual (warning) redundancy are required.

**Decision OD-4 — Verdict bar pattern:**
Full-width banner that breaks from the DetailCard grid. Lives above the panel grid. Background tint keyed to `recommendation`:
- `strong_yes` → `bg-green-50 dark:bg-green-950/30`
- `yes` / `lean_yes` → lighter green wash (e.g., `bg-green-50/60 dark:bg-green-950/20`)
- `lean_no` / `no` → `bg-red-50 dark:bg-red-950/30`
- `insufficient_data` → `bg-stone-100 dark:bg-stone-900`

Recommendation label: `text-2xl font-semibold`. Confidence chip: inline beside the recommendation label. Overall score: secondary element inside the same banner at `text-lg`.

**Wireframe — normal state (v2):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [LEAN YES]    confidence: medium                              78  │ ← full-width banner, tinted
│                                                            / 100  │
│  ⚠ 2 high-severity flags                                          │
└─────────────────────────────────────────────────────────────────────┘

[Overall feedback DetailCard — full width below banner]
[Dimensions accordion — collapsed by default on mobile, expanded on desktop]
[Red flags panel — high-severity items also linked from banner]
[Per-question section — collapsed on mobile, expanded on desktop]
[Evidence gaps + hard rules — collapsed with badge count]
```

**Wireframe — degenerate state (`insufficient_data`):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [INSUFFICIENT DATA]                                                │ ← neutral grey banner
│  This session had insufficient candidate signal to produce a score. │
│  • 0 of 5 questions answered                                        │
│  • Candidate spoke for 4 seconds                                    │
└─────────────────────────────────────────────────────────────────────┘
```

No score gauge. No dimensions card. Show only: verdict bar + overall feedback + redFlags if any + evidence gaps.

### 13. `hiring-workflow.ts` — version-aware accessors

**Decision:** Update `getResponseScore()` and `getResponseSummary()` to branch on `schemaVersion`:

```typescript
function getResponseScore(response: Response): number {
  const a = response.analytics;
  if (!a) return 0;
  if ('schemaVersion' in a && a.schemaVersion === 2) return a.overallScore;
  return a.overallScore ?? 0;
}

function getResponseSummary(response: Response): string {
  const a = response.analytics;
  if (!a) return '';
  if ('schemaVersion' in a && a.schemaVersion === 2) return a.overallFeedback;
  return a.softSkillSummary ?? '';
}
```

Other accessors that read v1-specific fields (e.g., `communication.feedback`) need similar branching where they fire.

**Rationale:** All downstream consumers (decision_makers signal, recruiter view, exports) work against the accessors. Centralizing the version check keeps the call sites clean.

### 14. Calibration harness — offline replay + diff

**Decision:** New script `scripts/calibrate-analytics.ts`:

```
Usage: tsx scripts/calibrate-analytics.ts [--limit N] [--since ISO] [--out FILE]
```

It:

1. Connects to Supabase with the service-role key.
2. Selects up to N responses (default 50) since `--since` (default 30 days ago) that have `analytics_v1 IS NOT NULL` (i.e., dual-write produced them) or `analytics IS NOT NULL` (legacy).
3. For each response, rebuilds the v2 prompt context from the joined `interview` + `response.details` (Retell signals).
4. Calls OpenAI with the same v2 prompt + hard-cap logic and computes a fresh v2 output.
5. Diffs against either (a) the stored v2 in `analytics_v1` (during dual-write window) or (b) the stored v1 in `analytics_v1` (legacy comparison).
6. Writes a CSV with `response_id`, `interview_name`, `v1_score`, `v2_score`, `recommendation`, `hard_rules_triggered`, `delta`, `notes`.

**Rationale:** Operators need a way to inspect v2's behavior before flipping `ANALYTICS_V2_AS_PRIMARY=true`. The harness is offline (no production traffic impact), reuses production code (`getInterviewAnalyticsPromptV2`, `applyHardCaps`), and produces a single artifact (CSV) for review.

### 15. Migration strategy — DDL first, code second, flags last

**Decision:** Ship order:

1. **Migration** runs against Supabase first: `ALTER TABLE interview ADD COLUMN ...` × 3 and `ALTER TABLE response ADD COLUMN analytics_v1 JSONB NULL`. Idempotent via `IF NOT EXISTS`.
2. **Code** lands with both flags `false`. No behavior change. Existing rows have safe defaults on the new `interview` columns.
3. **Flag flip** to `ANALYTICS_V2_ENABLED=true, ANALYTICS_V2_AS_PRIMARY=false`. Dual-write begins; v1 stays primary.
4. **7-day calibration window** with the harness available for offline inspection.
5. **Flag flip** to `ANALYTICS_V2_AS_PRIMARY=true`. v2 becomes the displayed score; v1 retained in `analytics_v1` for rollback evidence.
6. **(Future change)** Turn off v1 dual-write entirely once v2 has been stable for a stretch.

**Rollback at each stage:**

- Step 2 → Step 1: revert the code commit; no DB rollback needed (new columns have safe defaults, no code reads them).
- Step 3 → Step 2: flip `ANALYTICS_V2_ENABLED=false`. Dual-write stops; future writes don't carry `schemaVersion`. Existing dual-written rows are harmless (the dashboard ignores `analytics_v1`).
- Step 5 → Step 3: flip `ANALYTICS_V2_AS_PRIMARY=false`. Dashboard reads v1 again. v2 continues to dual-write to `analytics_v1` until step 3 is also rolled back.

## Risks / Trade-offs

- **OpenAI cost roughly doubles during dual-write.** Two completions per webhook (v1 + v2) for the calibration window. Accepted cost for ~7 days; mitigated by capping the window length and turning v1 off after v2 is stable.
- **`seed` parameter may not be supported by the project's OpenAI SDK version.** If unsupported, drop it and rely on `temperature: 0` alone. Determinism is degraded slightly but acceptable.
- **Dimension weights are launch defaults, not science.** The 0.25/0.25/0.20/0.15/0.10/0.05 weights are an opinionated first cut. A follow-up change can move weights into the `interview` row so they're per-interview tunable.
- **Hard-cap thresholds (30s, 0 questions, abandoned + <50% duration) are heuristics.** They will produce false negatives on edge cases (a candidate who answered fully but spoke quickly might trip <30s; an interview that was supposed to be 5 mins and ended at 4 might trip "abandoned"). Mitigated by making the rules transparent (recorded in `hardRulesTriggered[]`) and reviewable.
- **`analytics_v1` column doubles JSONB storage per response during dual-write.** Accepted. Postgres TOAST handles it; query cost is unchanged because we don't index either column.
- **Dashboard renders two distinct UIs (v1 + v2).** Maintenance burden during the dual-write window. Mitigated by extracting v1 into a sub-component and leaving it untouched.
- **No multi-tenant scoping on `interview.job_description`** — the JD is per-interview (which is per-org in practice today), but there's no per-org review of JD content. Out of scope.

## Service Layer Contract

### `runAnalyticsV2(args): Promise<AnalyticsV2>`

New function in `src/services/analytics.service.ts`:

```typescript
async function runAnalyticsV2(args: {
  transcriptObject: TranscriptTurn[];
  callAnalysis: RetellCallAnalysis;
  disconnectionReason: string;
  durationMs: number;
  questions: Question[];
  jobDescription: string;
  seniority: Seniority;
  mustHaves: string[];
  roleTitle: string;
  expectedDurationMinutes: number;
}): Promise<AnalyticsV2> {
  const prompt = getInterviewAnalyticsPromptV2(args);
  const modelOutput = await openai.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    temperature: 0,
    seed: 7,
    response_format: { type: 'json_schema', json_schema: ANALYTICS_V2_SCHEMA },
    messages: [{ role: 'user', content: prompt }]
  });
  const parsed = JSON.parse(modelOutput.choices[0].message.content) as AnalyticsV2;
  return applyHardCaps(parsed, retellSignals, questions.length);
}
```

### `applyHardCaps(modelOutput, retellSignals, questionsTotal): AnalyticsV2`

Pure function (no I/O). Computes:

- `candidateSpeakingSeconds` from `transcriptObject`.
- `questionsAnswered` from `modelOutput.perQuestionScores.filter(q => q.answered).length`.
- `hardRulesTriggered[]` from the three rule predicates (Decision 3).
- Applies the lowest cap from triggered rules to `overallScore`.
- Sets `recommendation = 'insufficient_data'` and `confidence = 'insufficient'` when `no_answers` or `agent_only_speech` triggers.
- Writes `hardRulesTriggered`, `candidateSpeakingSeconds`, `questionsAnswered`, `questionsTotal`, and `callSignals` into the final object.

Returns a new object — does not mutate input.

### Webhook dual-write contract

`src/app/api/response-webhook/route.ts` after the Retell call completes:

```typescript
const v1 = ANALYTICS_V1_ALWAYS_ON ? await runAnalyticsV1(...) : null;
const v2 = ANALYTICS_V2_ENABLED ? await runAnalyticsV2(...) : null;
const primary = ANALYTICS_V2_AS_PRIMARY ? v2 : v1;
const secondary = ANALYTICS_V2_AS_PRIMARY ? v1 : v2;
await supabase.from('response').update({
  analytics: primary,
  analytics_v1: secondary,  // misleadingly named — holds whichever is NOT primary
  // ... other fields
}).eq('call_id', callId);
```

`ANALYTICS_V1_ALWAYS_ON` is effectively `true` for the dual-write window — implemented as `!ANALYTICS_V2_AS_PRIMARY || ANALYTICS_V2_ENABLED` (i.e., v1 runs unless we explicitly turn it off in a later change). The column name `analytics_v1` is kept literal even though it holds whichever version is non-primary; a follow-up rename to `analytics_secondary` can happen if it becomes confusing.

**Flag snapshot rule.** Both `ANALYTICS_V2_ENABLED` and `ANALYTICS_V2_AS_PRIMARY` MUST be read into local `const`s at the top of the `call_analyzed` handler, BEFORE the first `await`. All downstream branching uses the snapshots, never re-reads `process.env`. This prevents a transient mixed-state race during a deploy that flips a flag mid-request.

## Migration Plan

### Schema migration

```sql
-- 1) interview table
ALTER TABLE interview ADD COLUMN IF NOT EXISTS job_description TEXT NOT NULL DEFAULT '';
ALTER TABLE interview ADD COLUMN IF NOT EXISTS seniority TEXT NOT NULL DEFAULT 'mid';
ALTER TABLE interview ADD COLUMN IF NOT EXISTS must_haves JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) response table — dual-write secondary column
ALTER TABLE response ADD COLUMN IF NOT EXISTS analytics_v1 JSONB NULL;

-- 3) Optional CHECK on seniority enum-like column (Postgres-compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'interview' AND constraint_name = 'interview_seniority_check'
  ) THEN
    ALTER TABLE interview
      ADD CONSTRAINT interview_seniority_check
      CHECK (seniority IN ('junior', 'mid', 'senior', 'staff', 'principal'));
  END IF;
END $$;
```

**Notes:**

- Idempotent — safe to re-run.
- No backfill needed for `job_description` or `must_haves` — defaults are `''` and `'[]'`. The v2 prompt handles empty values gracefully (renders "(none provided)" or omits the section).
- `seniority` defaults to `'mid'` for existing rows. Operators can update specific rows post-migration if needed; the create-form editor (follow-up change) will set explicit values going forward.
- The `CHECK` constraint is added defensively. If it's an undue maintenance burden, drop it — the TypeScript type is the practical enforcement.

### Rollback

```sql
ALTER TABLE response DROP COLUMN IF EXISTS analytics_v1;
ALTER TABLE interview DROP CONSTRAINT IF EXISTS interview_seniority_check;
ALTER TABLE interview DROP COLUMN IF EXISTS must_haves;
ALTER TABLE interview DROP COLUMN IF EXISTS seniority;
ALTER TABLE interview DROP COLUMN IF EXISTS job_description;
```

Safe if no code is reading the new columns. The code defaults both flags to `false`, so a code-only rollback is also safe — the DB columns sit unused.

### Post-migration steps

1. Regenerate (or hand-update) `src/types/database.types.ts` to include the new columns on `interview.Row/Insert/Update` and `response.Row/Insert/Update`.
2. Run `tsc --noEmit` to confirm no type errors.
3. Verify defaults populated correctly:
   ```sql
   SELECT id, name, seniority, length(job_description) AS jd_len, jsonb_array_length(must_haves) AS mh_count
   FROM interview ORDER BY id;
   ```

## Known Gaps Deferred to Follow-Up

- **Editor UI for `job_description`, `seniority`, `must_haves`** on the interview create/edit form. Without the editor, operators rely on defaults (empty JD, `'mid'` seniority, empty must-haves), which means v2 effectively scores blind on those dimensions for existing interviews. Tracked as `add-jd-seniority-must-haves-editor`.
- **Bias-audit dashboard** showing dimension-score distributions by inferred candidate demographic (where consented). Out of scope; the prompt-level guardrails are the v1 line of defense.
- **Per-interview dimension weights.** Currently the six dimension weights are fixed in code. A follow-up can move them into `interview` or per-org settings.
- **Drop v1 entirely.** After v2 has been primary and stable, a separate change can turn off v1 dual-write and drop the `analytics_v1` column.
- **Multi-sample voting.** Single sample for launch. A future change can average over N samples to further reduce variance.

## Open Questions

All major questions from brainstorming are resolved by the locked decisions above. The decisions captured here cover:

- Scoring shape (Decision 2)
- Decision output (Decision 2 + Decision 3)
- Hard caps and where they execute (Decision 3 + Decision 11)
- JD ingestion (Decision 5)
- Retell signals (Decision 6 + Decision 7)
- Determinism (Decision 4)
- Calibration gate / flags (Decision 1 + Decision 15)
- Bias clause (Decision 8)
- Anti-fabrication / evidence (Decision 9)
- Schema versioning (Decision 2 + Decision 12 + Decision 13)

No open questions remain for the apply step. UI surface details for the v2 view land in `plan_design_review`.
