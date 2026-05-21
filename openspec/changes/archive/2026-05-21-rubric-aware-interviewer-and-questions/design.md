## Implementation Order (Recommended)

1. **§4 — Type + schema additions** land first. Tiny, no behavior change; unblocks all later items.
2. **§1 + §2 — Rubric-first generator** (constants matrix, generator I/O contract, prompt template).
3. **§3 — `numQuestions ≥ 4` enforcement** in the create-interview stepper.
4. **§5 — `PROMPT_FOOTER_TEMPLATE` coverage checklist** woven into `createInterview` at the service layer.
5. **§6 — Preflight validator** (API route + modal flow in `details.tsx`).
6. **§7 — `not_assessed` scoring state** (scorer prompt + service-side override + renormalization).

**Hard dependency order:**
- M.1 (migration) is a hard dependency for §6.10 (writing `coverage_warnings` to the row).
- §4 type updates are a hard dependency for §2 (generator output) and §7 (scorer).
- §1–3 can land independently of each other.

---

## Context

The v2 hiring-grade rubric has been the only scoring path since the analytics-v2 simplification (`a37fa92`). The rubric defines six dimensions with fixed weights:

| Dimension | Weight | Type |
|---|---:|---|
| `role_fit` | 0.25 | active |
| `depth_of_knowledge` | 0.25 | active |
| `problem_solving` | 0.20 | active |
| `examples_evidence` | 0.15 | active |
| `communication` | 0.10 | observational |
| `professionalism` | 0.05 | observational |

**Active** = requires dedicated questions to produce evidence. **Observational** = judged from the whole call.

Today, the question generator only knows about `objective`. The agent prompt has no coverage requirements. The scorer is asked to rate every dimension even when the question set provided zero opportunity to assess it. This change makes the rubric structural rather than incidental.

All decisions below are locked from the brainstorming + CGC + flow design pass.

---

## Behavioral changes

> **CHANGELOG-style callout — operators and reviewers must read this before deploying.**

**OD-A: Legacy interview `assessed` override is UNIVERSAL.** All interviews — both legacy (untagged questions) and newly rubric-aware ones — go through the strict `assessed: false` service override in `applyHardCaps`. Concretely: when an existing v2-scored response is re-analyzed after this change ships, all four active dimensions (`role_fit`, `depth_of_knowledge`, `problem_solving`, `examples_evidence`) will be forced to `assessed: false` if no question in that interview carries a matching `targetDimension`. The historical scoring math will then renormalize against `communication` + `professionalism` only (combined weight sum 0.15). This means **legacy responses re-analyzed post-deploy will show materially lower or zero overall scores** compared to their original scores.

This is a deliberate product decision. The previous scores were computed against dimensions for which no structured evidence was gathered; renormalization is the correct behavior. Operators should be aware that triggering re-analysis on legacy interviews will update their scores.

**Smoke test required:** verify a known legacy response re-renders with all active dims `assessed: false` and an overall score derived solely from observational dimensions (see V.9 in tasks.md).

---

## Goals / Non-Goals

**Goals:**

- The four active rubric dimensions are guaranteed coverage at generation time via a hard-coded seniority × `numQuestions` allocation matrix.
- The agent's runtime prompt carries a per-interview coverage checklist + an explicit weakest-dimension probing loop.
- A preflight validator runs at Save time, blocks (or warns) on missing coverage, and persists `coverage_warnings` to the row when the operator chooses to save anyway.
- The scorer can mark a dimension `not_assessed`; the service overrides the scorer when the question set could not have provided evidence; the overall score renormalizes against the assessed subset.

**Non-Goals:**

- No change to the six weight values themselves.
- No DDL on the `response` table (`assessed` lives inside the existing JSONB blob).
- No retro-tagging of existing interview rows (existing untagged questions remain untagged; the system tolerates this).
- No edit-form changes (create-time only).

**In-scope (OD-B):** `coverage_warnings` badge IS in scope. Render as a small amber pill near `SessionCoverageRow` in `callInfo.tsx`. Pattern: `inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 text-amber-800 text-xs px-2 py-0.5` with an `AlertTriangle` icon. Clicking the pill expands an inline list (not a separate modal) showing each warning string.

---

## Decisions

### §1 Rubric first-class in the interviewer plan

Items 2 + 5 together make the rubric structural: questions carry `targetDimension`, the prompt carries `{{coverage_checklist}}`. There is no separate "rubric plan" object — the plan IS the tagged questions list plus the substituted prompt footer.

The service layer is the authority on whether a dimension was "covered by design" — never the scorer, never the agent. That authority is exercised in:
- `createInterview` (writes the agent prompt with the actual checklist)
- `applyHardCaps` (forces `assessed: false` when no question carried `targetDimension === dim.name` for active dims)

---

### §2 Generator overhaul

#### 2.1 Generator input contract

```ts
// src/app/api/generate-interview-questions/route.ts (POST body)
type GenerateInterviewQuestionsRequest = {
  name: string;                         // existing
  objective: string;                    // existing
  numQuestions: number;                 // existing (now constrained 4..8)
  context: string;                      // existing (uploaded document context)
  // NEW:
  jobDescription: string;               // empty string = "(none provided)"
  mustHaves: string[];                  // [] valid
  seniority: Seniority;                 // 'junior' | 'mid' | 'senior' | 'staff' | 'principal'
  rubric: {                             // passed for prompt construction
    active: typeof ACTIVE_DIMENSIONS;
    observational: typeof OBSERVATIONAL_DIMENSIONS;
    weights: typeof ANALYTICS_V2_DIMENSION_WEIGHTS;
  };
};
```

The generator MUST refuse `numQuestions < 4` or `numQuestions > 8` with a 400 error. Defense in depth — the UI clamps but the API is authoritative.

#### 2.2 Generator output contract

```ts
type GeneratedQuestion = {
  question: string;
  targetDimension: ActiveDimension;     // REQUIRED on every question
  rubricNote: string;                   // 1-line coaching string for the scorer
};

type GenerateInterviewQuestionsResponse = {
  questions: GeneratedQuestion[];       // length === request.numQuestions
};
```

Note `targetDimension` is required at the API boundary (the generator always tags). It is optional on the `Question` type (§4) only because existing rows pre-date this change.

#### 2.2a Generator response_format (locked)

Use `response_format: { type: "json_schema", strict: true, schema: {...} }` matching the scorer's pattern. The verbatim JSON Schema object:

```json
{
  "type": "object",
  "required": ["questions", "description"],
  "additionalProperties": false,
  "properties": {
    "description": { "type": "string" },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["question", "targetDimension", "rubricNote"],
        "additionalProperties": false,
        "properties": {
          "question": { "type": "string" },
          "targetDimension": {
            "type": "string",
            "enum": ["role_fit", "depth_of_knowledge", "problem_solving", "examples_evidence"]
          },
          "rubricNote": { "type": "string" }
        }
      }
    }
  }
}
```

Both `question`, `targetDimension`, and `rubricNote` are `required` on every item. Task §2.6 must wire this schema into the route's OpenAI call.

`rubricNote` is a short instruction to the future scorer about what evidence to look for in the answer. Examples:

- `targetDimension: 'depth_of_knowledge'` → `"probe for first-principles understanding, not framework names"`
- `targetDimension: 'examples_evidence'` → `"require past-tense, project-specific specifics — push back on hypotheticals"`

#### 2.3 Allocation matrix (verbatim, hard-coded)

In `src/lib/constants.ts`:

```ts
export const ACTIVE_DIMENSIONS = [
  "role_fit",
  "depth_of_knowledge",
  "problem_solving",
  "examples_evidence",
] as const;

export const OBSERVATIONAL_DIMENSIONS = [
  "communication",
  "professionalism",
] as const;

export type ActiveDimension = (typeof ACTIVE_DIMENSIONS)[number];
export type ObservationalDimension = (typeof OBSERVATIONAL_DIMENSIONS)[number];

type AllocationCell = Record<ActiveDimension, number>;
type AllocationBySeniority = Record<4 | 5 | 6 | 7 | 8, AllocationCell>;

export const ACTIVE_DIM_ALLOCATION: Record<Seniority, AllocationBySeniority> = {
  junior: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 2, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    7: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    8: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 2 },
  },
  mid: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 2 },
    8: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 2 },
  },
  senior: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 2, examples_evidence: 1 },
    8: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 2, examples_evidence: 2 },
  },
  staff: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 3, examples_evidence: 1 },
    8: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 3, examples_evidence: 1 },
  },
  principal: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 3, examples_evidence: 1 },
    8: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 3, examples_evidence: 1 },
  },
};
```

Invariants (tested via unit test in §verify):
- Every cell `Object.values(cell).reduce((a,b) => a+b, 0) === numQuestions`.
- Every cell `Object.values(cell).every(n => n >= 1)` (anchor floor: every active dim ≥ 1).

#### 2.4 Generator prompt construction

The generator prompt receives the allocation as an explicit instruction block. Pseudocode for the substitution inside the generator's system prompt template:

```
You will produce exactly {{numQuestions}} questions.
Each question must be tagged with one of these active rubric dimensions:
{{#each ACTIVE_DIMENSIONS}}
- {{this}} — {{DIMENSION_RUBRIC_HINT[this]}}
{{/each}}

For this {{seniority}} role at {{numQuestions}} questions, allocate exactly:
{{#each allocationCell}}
- {{key}}: {{value}} question(s)
{{/each}}

Each question must also carry a `rubricNote` — a one-line coaching string for the scorer
explaining what kind of evidence to look for in the candidate's answer.

Inputs:
- name: {{name}}
- objective: {{objective}}
- jobDescription: {{jobDescription || "(none provided)"}}
- mustHaves: {{mustHaves.join(", ") || "(none)"}}
- context: {{context}}

Return JSON: { "questions": [ { "question", "targetDimension", "rubricNote" }, ... ] }
```

`DIMENSION_RUBRIC_HINT` is a constant map from dimension → short description (one line each) used inside the generator prompt; live in `constants.ts` alongside `ACTIVE_DIMENSIONS`.

---

### §3 `numQuestions ≥ 4` enforcement

`details.tsx` is a 3-step stepper. `numQuestions` lives on Step 3 (Settings).

Changes:

1. **HTML input**: `<input type="number" min={4} max={8} step={1} ... />`. (Was `min={1}`, `max={5}`.)
2. **`onChange` clamp**: clamp `Number(e.target.value)` into `[4, 8]` before `setInterviewData({ ...prev, numQuestions: ... })`. Out-of-range typed input snaps to bounds on blur.
3. **Stepper validators** (`step0Valid` and `step2Valid`): require `Number(numQuestions) >= 4 && Number(numQuestions) <= 8`. The "Next" button on the relevant step and the "Create" button on the final step are disabled when invalid.
4. **Helper copy** on Step 3 below the field changes from "Max 5" → "Min 4 (one per active scoring dimension), max 8".
5. **Default `numQuestions`** in `interviewData` initial state: bump from current default to `4` (matches the new floor). Any preset that previously used `1..3` is bumped to `4`.

---

### §4 Question schema additions

In `src/types/interview.ts`:

```ts
import type { ActiveDimension } from "@/lib/constants";

export type { ActiveDimension };

export interface Question {
  id: string;
  question: string;
  follow_up_count: number;
  // v3 rubric-aware fields (this change). Both optional for backward compat
  // with rows generated before this change shipped.
  targetDimension?: ActiveDimension;
  rubricNote?: string;
}
```

The `interview.questions` column is `JSONB` — no DDL needed for these two optional fields. Existing rows continue to deserialize cleanly with `undefined` for both.

Type updates to `src/types/database.types.ts` are limited to the new `interview.coverage_warnings` column (see §migration).

---

### §5 `PROMPT_FOOTER_TEMPLATE` updates

Add a new substitution variable `{{coverage_checklist}}` to the template. The full footer block appended to the agent's runtime prompt becomes verbatim:

```
# Coverage requirements
Across this interview you MUST gather substantive evidence for these four dimensions:
{{coverage_checklist}}

After the candidate's first answer to each main question, before moving on:
1. Identify the weakest-evidenced dimension so far in the call
2. Ask one follow-up that probes that dimension specifically
3. Only advance when you have a concrete, evidence-rich answer

Before saying "That's everything from my side":
- Mentally tally evidence for each of the 4 dimensions above
- If any is thin, ask one more targeted probe before closing
- Communication and professionalism are judged observationally from the whole call — do not dedicate questions to them

Score communication on PARTICIPATION (did the candidate engage?) and CLARITY (was their meaning understandable?), not on accent or grammar.
```

#### 5.1 `{{coverage_checklist}}` rendering

A numbered list, one line per tagged question, in question order:

```
1. {{dimension}} — {{rubricNote}}
2. {{dimension}} — {{rubricNote}}
...
N. {{dimension}} — {{rubricNote}}
```

Where `N === interview.questions.length`. Untagged questions (legacy rows) emit `N. (untagged)` and a service-layer warning log; they should not occur for newly-created interviews because §6 blocks Save.

#### 5.2 Substitution model (Retell-runtime — important)

The `{{name}}`, `{{mins}}`, `{{objective}}`, and `{{questions}}` placeholders in `PROMPT_FOOTER_TEMPLATE` are **Retell-runtime substitutions** — they are NOT filled by our service at interview-save time. They are passed as `retell_llm_dynamic_variables` via `dynamic_data` in `src/app/api/register-call/route.ts` (line ~60) before the `retellClient.call.createWebCall` call.

**`{{coverage_checklist}}` follows the same pattern.** It MUST also be a Retell dynamic variable, NOT a static substitution at save time. The footer template stays static with `{{coverage_checklist}}` as a literal placeholder. The checklist string is computed server-side at **`register-call` time** (not interview-save time), derived from `interview.questions[].targetDimension` + `rubricNote` at the moment of the call, then included in `dynamic_data` alongside the existing variables.

Implementation site: `src/app/api/register-call/route.ts` — extend the `dynamic_data` object with `coverage_checklist: buildCoverageChecklist(interview.questions)` where `buildCoverageChecklist` produces the numbered list string from §5.1.

The `interviews.service.ts::createInterview` function does NOT need to fill `{{coverage_checklist}}`; it only needs to persist the footer template with the literal placeholder intact.

#### 5.4 Footer validator update (F8)

The `normalizeWhitespace` comparison in `/api/interviewers/route.ts` (lines ~95–110) validates that the interviewer's saved prompt ends with the canonical `PROMPT_FOOTER_TEMPLATE` text. After this change the template includes the new coverage-requirements block with `{{coverage_checklist}}`. Update the comparison string in that validator to match the NEW `PROMPT_FOOTER_TEMPLATE` text. Without this fix, existing operator-saved interviewer prompts will fail validation on save because the saved footer won't match the new canonical text.

---

### §6 Preflight validator at Save

#### 6.1 Site

In `src/components/dashboard/interview/create-popup/details.tsx`, the validator runs:
- inside `onGenrateQuestions` AND `onManual`,
- BEFORE `setLoading(true)`,
- AFTER all form-field validation but BEFORE the `setInterviewData(...)` that triggers persistence.

#### 6.2 State machine

```
[Save clicked]
      |
      v
[ruleCheck = every active dim has >=1 tagged question?]
      |
      +-- false ---> [open modal with rule-based gap list]
      |                       |
      |                       +-- "Regenerate all"   --> regenerate from scratch, return to form
      |                       +-- "Fill gaps only"   --> generate missing dims only, append, return to form
      |                       +-- "Save anyway"      --> persist `coverage_warnings` + proceed with original setInterviewData
      |
      +-- true ----> [semanticCheck IF !questionsDirty]
                              |
                              +-- gaps found ---> [same modal, semantic gap list]
                              +-- clean --------> proceed (setLoading + setInterviewData)
```

`questionsDirty` is a `useState<boolean>` initialized `false`, set to `true` whenever the operator edits any field on the questions list (text edit, dimension change, reorder, add/remove). Reset to `false` after every successful generate call returns.

#### 6.3 LLM semantic check API

New route: `POST /api/validate-question-coverage`.

```ts
// Request
type ValidateCoverageRequest = {
  jobDescription: string;
  mustHaves: string[];
  questions: Array<Pick<Question, "question" | "targetDimension" | "rubricNote">>;
};

// Response
type ValidateCoverageResponse = {
  uncovered_must_haves: string[];   // must-haves with no plausible question coverage
  semantic_gaps: string[];          // free-text gap descriptions, max 5 items
};
```

The route calls `gpt-4o-mini-2024-07-18` with `temperature: 0`, `seed: 7`, and `response_format: { type: "json_schema", strict: true, schema: { type: "object", required: ["uncovered_must_haves", "semantic_gaps"], additionalProperties: false, properties: { uncovered_must_haves: { type: "array", items: { type: "string" } }, semantic_gaps: { type: "array", items: { type: "string" } } } } }`. No retries; on parse failure return `{ uncovered_must_haves: [], semantic_gaps: ["validator unavailable — proceed at your own risk"] }` and surface as a soft warning. The route is server-side only (uses the project's existing OpenAI client wiring). `gpt-4o-mini-2024-07-18` is used (cheaper than `gpt-4o` since this is a quick gap check).

The semantic check is skipped entirely when `questionsDirty === true` to avoid running the LLM against operator-edited content where the operator presumably already knows what they want.

#### 6.4 Modal UI shape

Three buttons in the modal footer: `Regenerate all` (primary) | `Fill gaps only` (secondary, disabled when there are zero missing tagged dimensions) | `Save anyway` (tertiary, danger styling).

**Mobile button order:** Override `AlertDialogFooter` with `<AlertDialogFooter className="!flex-col sm:!flex-row">` so buttons stack on small viewports with "Regenerate all" on top, "Fill gaps only" second, "Save anyway" last.

**"Regenerate all" warning copy:** Render `<p className="text-xs text-stone-500 mt-1">Discards your current question list.</p>` directly under the "Regenerate all" button.

**In-flight state (while the API call is in flight):** Disable all three CTAs. The "Fill gaps only" button shows an inline spinner `<Loader2 className="animate-spin" />`. The modal stays open until the response returns. On failure, render `<p className="text-sm text-red-600">{{errorMessage}}</p>` inline in the modal body and re-enable all three CTAs.

The modal body lists gap groups. Only render a group header when the group is non-empty:

- **"Missing scoring dimensions"** — dimensions with no tagged question (rule check).
- **"Uncovered must-haves"** — must-haves with no plausible question coverage (LLM check).
- **"Semantic gaps"** — free-text gap descriptions (LLM check).

Each group header: `<p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mt-3 mb-1">`. Each bullet under a header: `- {{text}}`. No icons, no emoji.

#### 6.5 Action handlers

- **Regenerate all**: calls the generator with the full current inputs from scratch, replaces `interviewData.questions`, resets `questionsDirty = false`, closes the modal, returns the operator to the form (does NOT auto-save).
- **Fill gaps only**: calls the generator with the same inputs PLUS an `existingQuestions` array and a `missingDimensions: ActiveDimension[]` filter. The generator returns ONLY new questions for the missing dimensions, which are APPENDED to the current questions array. Resets `questionsDirty = false`, closes modal, returns to form.
- **Save anyway**: The "Save anyway" button is disabled until the operator checks an acknowledgement checkbox rendered above it: _"I understand this interview may under-score uncovered dimensions"_. After the checkbox is checked a single click on the button proceeds. The handler builds `coverage_warnings: string[]` from the rule + LLM warnings (one warning string per bullet), calls `setInterviewData({ ..., coverage_warnings })`, then proceeds to the original `setLoading(true)` + persistence path. The `coverage_warnings` field is persisted to the `interview` row.

`coverage_warnings` is reset to `[]` on every successful `Regenerate all` AND every successful `Fill gaps only` (the rationale is that after a regen the gap state is presumed fresh). When the preflight rule check passes AND the LLM check passes (or is skipped), `coverage_warnings` is also reset to `[]` on the saved interview row before proceeding with `setInterviewData` (§6.5b).

#### 6.6 Generator's "fill gaps" mode

The generator route accepts an optional `existingQuestions` + `missingDimensions` in its request body. When both are present and non-empty, it produces only enough new questions to satisfy the missing dimensions (one per missing dimension), tagged accordingly. The response shape stays the same `{ questions: GeneratedQuestion[] }` — caller appends.

#### 6.7 `questionsDirty` tracking

```ts
const [questionsDirty, setQuestionsDirty] = useState<boolean>(false);
```

- `false` immediately after a successful generate response.
- `true` whenever the operator: edits any question's `question` text, edits its `targetDimension`, edits its `rubricNote`, reorders the list, removes a question, or manually adds one.

The flag is cleared back to `false` after every successful generate-mode call (regenerate all OR fill gaps only).

---

### §7 `not_assessed` scoring state

#### 7.1 Type addition

```ts
// On the AnalyticsV2 type
export type AnalyticsV2Dimension = {
  name: DimensionName;
  score: number;
  rationale: string;
  evidenceQuotes: string[];
  // NEW (this change):
  assessed?: boolean;     // missing = true (legacy default)
};
```

#### 7.2 Scorer prompt instruction

Append to the scorer system prompt:

> For each of the six dimensions, set `assessed: true` if you saw any candidate evidence (even tangential) that lets you score the dimension. Set `assessed: false` if the question set provided no opportunity to evaluate the dimension. When `assessed: false`, still emit a `score` (use your best guess) and `rationale` (explain why no evidence was available) — the service may discard the score, but the rationale must survive.

#### 7.3 Service-side override (`applyHardCaps`)

Authority order (service wins on conflict):

```
for each dim in modelOutput.dimensions:
  if dim.name in OBSERVATIONAL_DIMENSIONS:
    # observational dims can be assessed from the whole call;
    # service does NOT override the scorer's decision here.
    dim.assessed = dim.assessed ?? true
    continue

  # Active dim:
  hasTaggedQuestion = questions.some(q => q.targetDimension === dim.name)
  if !hasTaggedQuestion:
    # Service authority: no question provided evidence opportunity.
    dim.assessed = false
  else:
    dim.assessed = dim.assessed ?? true

# Hard-cap coupling:
if no_answers fires OR agent_only_speech fires:
  for each dim in all 6 dimensions (active AND observational):
    dim.assessed = false
```

**Timing constraint (F1 — blocker):** `computeOverallScoreFromDimensions` MUST be called AFTER the `assessed` override loop above AND AFTER the hard-cap evaluation, using the fully-patched dimensions array as input. If the current implementation calls `computeOverallScoreFromDimensions` before the override loop, it must be moved. See §7.5 task for the explicit fix.

Legacy rows: when a question has `targetDimension === undefined`, the `hasTaggedQuestion` check returns `false` for that dim — meaning fully-legacy interviews (zero tagged questions) end up with all four active dims unassessed. This is intentional and correct: those interviews never had structured coverage, so the v2 scoring should not pretend it did. The overall score will be computed from observational dims only (weight sum 0.15) or default to 0 if those are also unassessed.

#### 7.4 `computeOverallScoreFromDimensions` renormalization

```
const assessed = dimensions.filter(d => d.assessed !== false);
if (assessed.length === 0) return 0;
const weightSum = assessed.reduce((s, d) => s + DIMENSION_WEIGHTS[d.name], 0);
const weighted = assessed.reduce((s, d) => s + d.score * DIMENSION_WEIGHTS[d.name], 0);
return Math.round((weighted / weightSum) * 10);
```

Edge cases:
- All 6 unassessed → return 0 (preserves existing behavior on `insufficient_data` cases).
- 1+ assessed → renormalize against the actual sum (not the full 1.0). This means a candidate scoring 8/10 on a single assessed dim returns `Math.round(8/1 * 10) = 80`, not `Math.round(8 * weight * 10)`.
- Floating-point: existing rounding behavior preserved.

#### 7.5 Backward-compat with legacy v2 rows + timing fix task

Existing v2-scored responses have no `assessed` field on any dimension. The default `dim.assessed !== false` treats absent-as-true → legacy rows compute exactly as they did before.

**Timing fix (task §7.5):** Move the `dimensionOverall` computation in `applyHardCaps` to AFTER the rule-evaluation block. Verify line-by-line that the patched dimensions array (with `assessed: false` overrides applied) is the input to `computeOverallScoreFromDimensions`. This is a blocker: computing overall score before overrides produces stale values.

**"Not assessed" pill rendering:** When `dim.assessed === false`, render a pill in place of the score badge:
- Style: `inline-flex items-center rounded-full bg-stone-100 border border-stone-300 text-stone-600 text-xs px-2 py-0.5`
- Pill text: "Not assessed"
- `title` attribute: `Not assessed — no question targeted ${DIMENSION_LABEL[d.name]}`
- The `<details>` element for the dimension remains openable. When opened, render the dimension's `feedback`/`rationale` (which will explain the lack of coverage) but skip the evidence-quotes list (empty for unassessed dims).

---

## Migration

See `migration.sql`. Single ALTER:

```sql
ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS coverage_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;
```

Backward-compatible: existing rows pick up `[]`. `database.types.ts` updates: `coverage_warnings: Json` on Row, `coverage_warnings?: Json | undefined` on Insert/Update.

---

## Verification surface

Locked tests:

1. **Allocation matrix invariants** (`src/lib/constants.test.mjs`): every cell sums to its `numQuestions` key; every cell has every active dim ≥ 1.
2. **Generator output shape** (manual smoke): generate against each seniority × `numQuestions ∈ {4,8}` and assert the returned dimensions equal `Object.entries(ACTIVE_DIM_ALLOCATION[seniority][numQuestions])`.
3. **Prompt substitution** (manual smoke): create an interview, fetch the row, assert the agent prompt contains the verbatim coverage block + N numbered checklist lines.
4. **Preflight rule check** (manual smoke): create an interview with only 2 active dims tagged → modal opens with the correct missing-dim list.
5. **`applyHardCaps` `assessed` flow** (`src/lib/analytics-v2-caps.test.mjs` extension): four new test cases — (a) untagged active dim → forced `false`; (b) tagged active dim → respects scorer; (c) observational dim → never overridden by absence-of-tag; (d) hard-cap fire → all 6 forced `false`.
6. **`computeOverallScoreFromDimensions` renormalization** (same file): assessed subset renormalizes; all-unassessed returns 0; legacy (no `assessed` anywhere) matches pre-change output exactly.
