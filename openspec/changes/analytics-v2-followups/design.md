## Implementation Order (Recommended)

1. **Item 3 — Unit tests** (`analytics-v2-caps.test.mjs`) lands first. Pure safety net with zero risk; no shared state with other items.
2. **Item 2 — Form UI** (`details.tsx`) lands second. Adds the `job_description`, `seniority`, and `must_haves` fields to the create popup.
3. **Item 1 — Calibration harness** (`scripts/calibrate-analytics.ts`) lands last. Depends on at least Item 2 being mergeable so JD fields can be populated for fresh test runs against real data.

This is a recommendation, not a hard dependency.

---

## Context

This change implements three items deferred from the `hiring-grade-analytics-scoring` change. The v2 analytics pipeline is now the only path (env gating removed, v1 dual-write dropped per `a37fa92`). The deferred items are:

1. `scripts/calibrate-analytics.ts` — an offline calibration harness for replaying historical calls through `runAnalyticsV2`.
2. Interview create-form UI for `job_description`, `seniority`, `must_haves` — the columns exist; only the UI is missing.
3. Unit tests for `applyHardCaps` — the most critical pure function in the pipeline has no test coverage.

All three items have been fully scoped via CGC. The decisions below are locked.

## Goals / Non-Goals

**Goals:**

- Implement `scripts/calibrate-analytics.ts` with the exact CLI surface and CSV schema described below.
- Add `job_description`, `seniority`, and `must_haves` fields to the interview create popup (`details.tsx`), flowing into both submit handlers.
- Write 10 table-driven test cases for `applyHardCaps` and its helpers using `node:test`.

**Non-Goals:**

- No DB migration — columns already exist.
- No edits to v2 prompt, scoring logic, or service layer.
- No editing of JD fields on existing interviews (create-form only).
- No calibration harness UI — CLI script only.

## Decisions

### 1. Calibration Harness — `scripts/calibrate-analytics.ts`

#### 1.1 CLI surface

```
npx tsx scripts/calibrate-analytics.ts \
  [--limit N]        # default 50; max rows to process (hard max: 500)
  [--since ISO]      # default: now() - 30 days; ISO 8601 date string
  [--out FILE]       # default: calibration-<ISO timestamp>.csv
  [--dry-run]        # if present, prints CSV to stdout instead of writing a file
  [--yes]            # suppress cost-confirmation prompt (use with --limit > 10)
```

#### 1.1a Cost guard

When `--limit > 10` AND `--dry-run` is not set, the script MUST prompt for confirmation showing the estimated cost (`rows × ~$0.02 OpenAI per call ≈ $X.XX`). Suppress with `--yes` flag. In `--dry-run`, no confirmation needed (no real OpenAI calls).

#### 1.1b Hard cap on --limit

Reject `--limit > 500` with an explicit error: `"Maximum limit is 500 rows per run. Use multiple runs with --since for larger windows."` Document this in the script header comment.

#### 1.1c Sequential processing

Rows are processed strictly sequentially (`for...of` with `await`, NOT `Promise.all`). This caps OpenAI rate-limit exposure and makes cost linear with `--limit`. Do not parallelize without rate-limit handling. Add a comment in the loop body explaining this constraint.

#### 1.2 CSV columns

| Column | Description |
|--------|-------------|
| `response_id` | UUID of the response row |
| `interview_name` | `interview.name` from the FK join |
| `original_score` | `response.analytics.overallScore` (whatever is currently stored; could be v2 already) |
| `v2_score` | `overallScore` from the fresh `runAnalyticsV2` call |
| `v2_recommendation` | `recommendation` from the fresh v2 call |
| `v2_confidence` | `confidence` from the fresh v2 call |
| `hard_rules_triggered` | pipe-joined list of `rule` values from `hardRulesTriggered[]`, e.g. `short_call|no_answers`; empty string if none |
| `delta` | `v2_score - original_score` (integer, may be negative) |
| `has_evidence_quotes` | count of all `evidenceQuotes` across all dimensions (integer) |
| `notes` | free-text; populated on parse failures, missing `call_analysis`, missing `transcript_object`, interview deleted, or any per-row exception |

#### 1.3 Supabase client

The script creates its own `createClient(url, serviceRoleKey)` inline — no shared service-role client exists in the project today. Both values are read from `process.env`:

```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

`SUPABASE_SERVICE_ROLE_KEY` must be added to `.env.example` with the comment:
```
# Required ONLY for scripts/calibrate-analytics.ts. Never expose in client bundles.
SUPABASE_SERVICE_ROLE_KEY=
```

#### 1.4 Query pattern

Use Supabase foreign-key embed to fetch interview in one round-trip:

```ts
const { data, error } = await supabase
  .from('response')
  .select('*, interview(*)')
  .not('analytics', 'is', null)
  .gte('created_at', sinceISO)
  .order('created_at', { ascending: false })
  .limit(limit);
```

#### 1.5 `RunAnalyticsV2Args` reconstruction

For each row, build `RunAnalyticsV2Args` from:
- `row.interview.job_description`, `.seniority`, `.must_haves`, `.questions`, `.objective`, `.time_duration`, `.name`
- `row.details` (the Retell call payload): `transcript_object`, `call_analysis`, `disconnection_reason`, `duration_ms`

When `call_analysis` is absent, the sentinel substitution inside `runAnalyticsV2` / `applyHardCaps` handles it — the script does not need to special-case it.

#### 1.6 `original_score` labeling

Detect `row.analytics?.schemaVersion === 2` and note it in the `notes` column (e.g., "original already schemaVersion:2"). This makes it obvious when the baseline is already a v2 score (making the delta less meaningful).

#### 1.7 Per-row error handling

Wrap each row in a `try/catch`. On exception:
- Emit a CSV row with `v2_score`, `delta`, `has_evidence_quotes`, and `v2_recommendation` left blank.
- Set `notes` to a short summary of the exception (e.g., "interview deleted", "transcript_object missing", "OpenAI parse failure: ...").
- Continue to the next row. Never abort the entire run on a per-row failure.

#### 1.8 Progress reporting

Print to `stderr` every 10 rows: `[calibrate] processed N / total` so operators can track progress without polluting the CSV on stdout (when `--dry-run` is set).

#### 1.9 `tsx` devDependency

Add `tsx` to `package.json` devDependencies. Invocation: `npx tsx scripts/calibrate-analytics.ts`. Document this in the usage comment at the top of the script file.

---

### 2. Interview Create-Form UI — `details.tsx`

**File:** `src/components/dashboard/interview/create-popup/details.tsx`

#### 2.1 New state slices

Add six local `useState` hooks, initialized from `interviewData` defaults:

```ts
const [jobDescription, setJobDescription] = useState<string>(
  interviewData.job_description ?? ''
);
const [seniority, setSeniority] = useState<string>(
  interviewData.seniority ?? 'mid'
);
const [mustHaves, setMustHaves] = useState<string[]>(
  interviewData.must_haves ?? []
);
const [mustHaveInput, setMustHaveInput] = useState<string>('');
// PDF upload state for JD upload zone
const [jdIsUploaded, setJdIsUploaded] = useState<boolean>(false);
const [jdFileName, setJdFileName] = useState<string>('');
```

`mustHaveInput` is ephemeral (the current value of the text input before the user commits it with "Add"). It is not spread into submit handlers. `jdIsUploaded` and `jdFileName` are display-only — the source of truth is `jobDescription`.

#### 2.2 Submit-handler spread

Both `onGenrateQuestions` (line ~100) and `onManual` (line ~117) must receive the three new fields. Mirror the existing pattern (how `objective` and `time_duration` are spread):

```ts
// inside onGenrateQuestions and onManual:
job_description: jobDescription,
seniority: seniority,
must_haves: mustHaves.map(s => s.trim()).filter(Boolean),
```

#### 2.3 `useEffect` reset — critical

The existing `useEffect` on line 131–141 of `details.tsx` resets state when the modal closes. After this change, that `useEffect` MUST also reset all six new state slices to prevent stale values persisting across modal reopens:

```ts
setJobDescription('');
setSeniority('mid');
setMustHaves([]);
setMustHaveInput('');
setJdIsUploaded(false);
setJdFileName('');
```

Failure to reset these will cause a visible bug where values from a previous form opening reappear.

#### 2.4 `seniority` — shadcn Select with flat-underline styling

First use of `<Select>` in this popup. Add the import:

```ts
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
```

Options: `junior`, `mid`, `senior`, `staff`, `principal`. The Select must never be clearable — always has a value (defaulting to `'mid'`). No empty/placeholder option.

The `SelectTrigger` MUST use a flat-underline className override to visually match the existing Name/Objective/Duration `<input>` fields in the popup:

```tsx
<SelectTrigger
  id="seniority-select"
  className="border-b-2 border-gray-500 rounded-none bg-transparent h-9 px-0 focus:ring-0 focus:ring-offset-0 text-sm"
>
  <SelectValue placeholder="Select seniority" />
</SelectTrigger>
```

Key constraints: `border-b-2 border-gray-500`, no rounded corners (`rounded-none`), transparent background (`bg-transparent`), no focus ring (`focus:ring-0 focus:ring-offset-0`), matching baseline height (`h-9`).

#### 2.5 JD PDF upload + textarea

The "Hiring criteria" section contains TWO separate `<FileUpload>` instances:

1. **Existing FileUpload** — unchanged. Labeled "Upload any documents". Its `setUploadedDocumentContext` callback writes to the existing question-generation context state slice. Do NOT repurpose it.

2. **New JD FileUpload** — dedicated PDF upload for job description. Uses the existing component at `src/components/dashboard/interview/fileUpload.tsx`. Label: "Upload Job Description (PDF) — optional". Its callback writes parsed text to `jobDescription` state slice (NOT `uploadedDocumentContext`). Also sets `jdIsUploaded(true)` and `jdFileName` for display feedback.

The JD textarea below the JD FileUpload:

```tsx
<label htmlFor="job-description" className="text-sm font-medium">
  Job Description — optional
</label>
<Textarea
  id="job-description"
  value={jobDescription}
  onChange={e => setJobDescription(e.target.value)}
  placeholder="Paste or upload a job description. You can edit after upload."
  maxLength={5000}
  className="..."
/>
{jobDescription.length > 3500 && (
  <p className="text-xs text-muted-foreground text-right">
    {5000 - jobDescription.length} characters remaining
  </p>
)}
```

The textarea is editable AND is the single source of truth stored in `interview.job_description`. Operators may also paste/type directly without uploading a PDF.

#### 2.6 PDF truncation (OD-3)

When parsed PDF text exceeds 5000 chars on upload, slice to first 5000 chars and call:

```ts
toast.warning("Job description trimmed to 5000 characters. Please review and edit if needed.");
```

The textarea reflects the trimmed value. Soft cap: the `maxLength={5000}` UI attribute enforces the cap on direct input as well. The remaining-chars counter appears when `jobDescription.length > 3500`.

#### 2.7 `must_haves` — chip list pattern

No external library. The Add button and text input are disabled when `mustHaves.length >= 10`.

```tsx
{/* Input row */}
<div className="flex gap-2">
  <input
    id="must-have-input"
    type="text"
    value={mustHaveInput}
    onChange={e => setMustHaveInput(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter') { e.preventDefault(); handleAddMustHave(); }
    }}
    placeholder="e.g. 5+ years TypeScript"
    disabled={mustHaves.length >= 10}
    className="flex-1 ..."
  />
  <button
    type="button"
    onClick={handleAddMustHave}
    disabled={mustHaves.length >= 10}
  >
    Add
  </button>
</div>
{/* Chip list */}
<div className="flex flex-wrap gap-1 mt-1">
  {mustHaves.map((item, i) => (
    <span
      key={i}
      className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-300 text-xs px-2 py-0.5"
    >
      {item}
      <button
        type="button"
        aria-label={`Remove ${item}`}
        className="text-stone-500 hover:text-stone-900"
        onClick={() => removeMustHave(item)}
      >
        ×
      </button>
    </span>
  ))}
</div>
```

`handleAddMustHave`: trim the input, drop empty strings, enforce a cap of 10 items (no-op if already at 10), push to `mustHaves`, clear `mustHaveInput`.

`removeMustHave(item)`: filter out the matching item by value from `mustHaves`.

#### 2.8 Validation rules

- `job_description`: optional; empty string is valid (v2 prompt handles "(none provided)").
- `seniority`: required; UI never allows clearing (Select always has a value; default `'mid'` is the implicit fallback).
- `must_haves`: optional; empty array valid; items capped at 10 to prevent prompt bloat.

#### 2.9 Layout — "Hiring criteria" section

Insert between the existing Objective textarea (lines ~219–226) and the `gap-3` row containing FileUpload + transcript (line ~258).

Visual grouping: add a `<hr className="my-3 border-t border-dashed border-stone-200" />` immediately above the section label. Section label style: `text-sm font-medium` (NOT `text-muted-foreground`).

The four sub-controls appear in this order:

```
ASCII layout sketch:

┌─────────────────────────────────────────┐
│  Objective                              │
│  [textarea]                             │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  ← <hr dashed>
│  Hiring criteria                        │  ← text-sm font-medium
│                                         │
│  Upload Job Description (PDF)—optional  │
│  [JD FileUpload zone]                   │
│                                         │
│  Job Description — optional             │
│  [Textarea, maxLength=5000]             │
│  [counter when >3500 chars]             │
│                                         │
│  Seniority level                        │
│  [Select: flat-underline style]         │
│                                         │
│  Must-haves — optional, up to 10       │
│  [input (disabled at cap)]  [Add btn]   │
│  [chip] [chip] [chip]                   │
├─────────────────────────────────────────┤
│  [Existing FileUpload] [transcript]     │
└─────────────────────────────────────────┘
```

Required-vs-optional labeling:
- "Upload Job Description (PDF) — optional"
- "Job Description — optional"
- "Seniority level" (no qualifier; `'mid'` is the implicit default)
- "Must-haves — optional, up to 10"

#### 2.10 Accessibility

All new inputs have explicit `id` props and paired `htmlFor` on their labels:

| Label `htmlFor` | Input `id` |
|---|---|
| `"job-description"` | `<Textarea id="job-description">` |
| `"seniority-select"` | `<SelectTrigger id="seniority-select">` |
| `"must-have-input"` | `<input id="must-have-input">` |

---

### 3. Unit Tests — `src/lib/analytics-v2-caps.test.mjs`

#### 3.1 Test file location and style

- **Path:** `src/lib/analytics-v2-caps.test.mjs` (co-located with `analytics-v2-caps.ts`)
- **Runtime:** `node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs`
- **Style:** mirror `retellReviewArtifacts.test.mjs` — `node:test` + `node:assert/strict`, no external test runner.
- **Import:** `import { applyHardCaps, computeCandidateSpeakingSeconds, countSubstantiveUserTurns, computeOverallScoreFromDimensions } from "./analytics-v2-caps.ts";`

#### 3.2 Test cases table

| # | Case name | What is tested | Key assertions |
|---|-----------|----------------|----------------|
| 1 | `clean call — no caps triggered` | Full transcript, model score in mid-range, no cap predicates fire. | `recommendation !== 'insufficient_data'`, `overallScore === modelScore` (capped at model value, which is above all thresholds), `hardRulesTriggered.length === 0` |
| 2 | `no-answers — all questions unanswered` | `perQuestionScores` all have `answered: false`. | `recommendation === 'insufficient_data'`, `overallScore <= 20`, `confidence === 'insufficient'`, `hardRulesTriggered` contains `{ rule: 'no_answers' }` |
| 3 | `short call — candidateSpeakingSeconds < 30` | Transcript has user turns but total word-time is < 30s; at least one question answered. | `overallScore <= 40`, `hardRulesTriggered` contains `{ rule: 'short_call' }`, `recommendation` is NOT forced to `insufficient_data` |
| 4 | `abandoned call — hangup + duration < 50%` | `disconnection_reason === 'user_hangup'`, `duration_ms < time_duration * 60_000 * 0.5`. | `overallScore <= 50`, `hardRulesTriggered` contains `{ rule: 'abandoned' }` |
| 5 | `agent-only — candidate speaks 0s, agent speaks 30s+` | No user turns in transcript_object; agent turns present with total > 30s. | `recommendation === 'insufficient_data'`, `overallScore <= 10`, `confidence === 'insufficient'`, `hardRulesTriggered` contains `{ rule: 'agent_only_speech' }` |
| 6 | `multiple caps stacked — no-answers + short-call` | Both `no_answers` and `short_call` predicates fire simultaneously. | `overallScore <= 20` (lowest cap wins, not 40), `hardRulesTriggered` contains both `no_answers` and `short_call` entries, `recommendation === 'insufficient_data'` |
| 7 | `call_analysis missing (sentinel)` | `callAnalysis` is the sentinel object (all fields `'N/A'`). No other cap predicates fire; candidate spoke enough. | `hardRulesTriggered` contains `{ rule: 'agent_only_speech' }` with a "limited signal" detail, `overallScore` is NOT capped (sentinel alone doesn't cap), `recommendation` not forced to `insufficient_data` |
| 8 | `empty transcript_object entirely` | `transcript_object` is `[]`; `candidateSpeakingSeconds === 0`, `agentSpeakingSeconds === 0`. | `hardRulesTriggered` contains `{ rule: 'agent_only_speech' }`, `overallScore <= 10`, `recommendation === 'insufficient_data'` |
| 9 | `computeOverallScoreFromDimensions — weights sum + math` | Feed six dimension objects with known scores and the canonical weights. | Resulting score matches manual calculation `round(sum(score_i * weight_i) * 10)`, and a weights-sum assertion passes (sum within floating-point epsilon of 1.0) |
| 10 | `countSubstantiveUserTurns — counting heuristic` | Feed a transcript with a mix of: agent turns, user turns with >= 8 words, user turns with >= 40 chars but < 8 words, and user filler turns (< 8 words and < 40 chars). | Count equals only the user turns that meet the threshold (>= 8 words OR >= 40 chars); agent turns and sub-threshold fillers are excluded |

#### 3.3 Each test structure

Each test uses `test('case name', async (t) => { ... })` and includes at least 3 assertions using `assert.strictEqual`, `assert.ok`, or `assert.deepStrictEqual` as appropriate.

#### 3.4 Test file header

Add a comment block at the very top of the test file:

```js
// Run with: node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs
```

#### 3.5 Fixture helpers

Define fixture builder functions at the top of the test file (not exported). To avoid 30-line setup per test case, extract these helpers:

```ts
// Build a Retell user turn with given content and timing
function makeUserTurn(content, startSec, endSec) {
  const words = content.split(/\s+/).filter(Boolean);
  const dur = endSec - startSec;
  const perWord = dur / words.length;
  return {
    role: 'user',
    content,
    words: words.map((w, i) => ({
      word: w,
      start: startSec + i * perWord,
      end: startSec + (i + 1) * perWord,
    })),
  };
}

// Build a minimal valid AnalyticsV2 modelOutput for hard-cap tests
function makeModelOutput(opts = {}) { /* sensible defaults; opts overrides */ }
```

In addition to `makeUserTurn` and `makeModelOutput`, also define:
- `makeAnalyticsV2(overrides)` — base `AnalyticsV2` object with all required fields set to safe defaults; `overrides` shallow-merged.
- `makeTranscriptTurn(role, words)` — creates a `{ role, content, words }` turn where `words` is an array of `{ word, start, end }` objects spaced 0.3s apart starting from a given `start` offset.
- `makeRetellSignals(overrides)` — base signals object (`disconnection_reason: 'call_ended'`, `duration_ms: 600_000`, `time_duration: 10`, empty `transcript_object`).

Each test case references these helpers directly — no per-test boilerplate setup blocks.
