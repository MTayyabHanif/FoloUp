## Implementation Order

Recommended landing order (not a hard dependency):

1. **§3 — Unit tests** first. Zero risk, pure safety net.
2. **§2 — Form UI** second.
3. **§1 — Calibration harness** last. Depends on §2 being mergeable so JD fields are populated for real-data test runs.

---

## 1. Calibration Harness — `scripts/calibrate-analytics.ts`

- [ ] 1.1 Add `tsx` to `devDependencies` in `package.json` (`npm install --save-dev tsx` or `pnpm add -D tsx`).
- [ ] 1.2 Add `SUPABASE_SERVICE_ROLE_KEY=` to `.env.example` with the comment: `# Required ONLY for scripts/calibrate-analytics.ts. Never expose in client bundles.`
- [ ] 1.3 Create the `scripts/` directory and `scripts/calibrate-analytics.ts`. Add a usage comment block at the top of the file documenting all CLI flags (`--limit`, `--since`, `--out`, `--dry-run`, `--yes`), the hard max-limit note (500), and the `npx tsx scripts/calibrate-analytics.ts` invocation.
- [ ] 1.4 Implement inline Supabase service-role client: `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)`. Fail fast with a clear error message if either env var is missing.
- [ ] 1.5 Parse CLI args: `--limit N` (default 50), `--since ISO` (default `new Date(Date.now() - 30 * 86400_000).toISOString()`), `--out FILE` (default `calibration-<timestamp>.csv`), `--dry-run` (boolean flag), `--yes` (boolean flag, suppresses cost confirmation).
- [ ] 1.5a Enforce hard cap: reject `--limit > 500` with the error message `"Maximum limit is 500 rows per run. Use multiple runs with --since for larger windows."` and exit non-zero. Document this limit in the script header comment.
- [ ] 1.5b Cost guard: when `--limit > 10` AND `--dry-run` is NOT set AND `--yes` is NOT set, prompt the operator for confirmation showing estimated cost (`limit × ~$0.02 ≈ $X.XX`). Abort if not confirmed. Skip prompt entirely when `--dry-run` is set.
- [ ] 1.6 Implement the Supabase query using FK embed: `select('*, interview(*)')` filtered by `.not('analytics', 'is', null)`, `.gte('created_at', sinceISO)`, `.order('created_at', { ascending: false })`, `.limit(limit)`.
- [ ] 1.7 For each row, reconstruct `RunAnalyticsV2Args` from `row.interview` fields (`job_description`, `seniority`, `must_haves`, `questions`, `objective`, `time_duration`, `name`) and `row.details` (Retell payload: `transcript_object`, `call_analysis`, `disconnection_reason`, `duration_ms`).
- [ ] 1.8 Detect `row.analytics?.schemaVersion === 2` and note it in the `notes` column (e.g., `"original already schemaVersion:2"`). Set `original_score` from `row.analytics.overallScore` regardless of schema version.
- [ ] 1.9 Process rows strictly sequentially using `for...of` with `await` (NOT `Promise.all`). Add a comment in the loop body: `// Sequential by design — caps OpenAI rate-limit exposure; cost is linear with --limit.` Call `runAnalyticsV2(args)` for each row. Compute `has_evidence_quotes` as the count of all `evidenceQuotes` items across all dimensions in the fresh v2 result.
- [ ] 1.10 Wrap each row's processing in a `try/catch`. On exception: emit a CSV row with `v2_score`, `delta`, `has_evidence_quotes`, and `v2_recommendation` blank; set `notes` to a short exception summary. Continue to the next row without aborting.
- [ ] 1.11 Print progress to stderr every 10 rows: `[calibrate] processed N / total`.
- [ ] 1.12 Implement the CSV writer. When `--dry-run` is set, print the CSV to stdout. Otherwise write to the `--out` path. The CSV must include a header row with all 10 columns defined in design.md §1.2.
- [ ] 1.13 Verify end-to-end: `npx tsx scripts/calibrate-analytics.ts --limit 5 --dry-run` against staging environment prints a valid CSV with 5 data rows and exits 0 (or exits with a clear error if no rows match the filter).

## 2. Interview Create-Form UI — `details.tsx`

- [ ] 2.1 In `src/components/dashboard/interview/create-popup/details.tsx`, add six new `useState` slices: `jobDescription` (string, init `interviewData.job_description ?? ''`), `seniority` (string, init `interviewData.seniority ?? 'mid'`), `mustHaves` (string[], init `interviewData.must_haves ?? []`), `mustHaveInput` (string, init `''`), `jdIsUploaded` (boolean, init `false`), `jdFileName` (string, init `''`).
- [ ] 2.2 Add the shadcn Select import: `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';`. This is the first use of `<Select>` in this popup. Also import `Textarea` from `@/components/ui/textarea` if not already imported.
- [ ] 2.3 Add a dedicated JD `<FileUpload>` instance above the JD textarea, using the existing component at `src/components/dashboard/interview/fileUpload.tsx`. Label it "Upload Job Description (PDF) — optional". Its `setUploadedDocumentContext` callback writes parsed text to `jobDescription` state slice (NOT the existing `uploadedDocumentContext`). On successful parse, also call `setJdIsUploaded(true)` and `setJdFileName(filename)`. The existing "Upload any documents" FileUpload remains unchanged.
- [ ] 2.4 Add the `<Textarea>` for job description labeled "Job Description — optional" (`htmlFor="job-description"`, `id="job-description"`). Bind to `jobDescription` / `setJobDescription`. Apply `maxLength={5000}`. Show remaining-chars counter (`<p>...{5000 - jobDescription.length} characters remaining</p>`) when `jobDescription.length > 3500`.
- [ ] 2.5 Add the PDF truncation on upload: if parsed text exceeds 5000 chars, slice to first 5000 and call `toast.warning("Job description trimmed to 5000 characters. Please review and edit if needed.")`. The truncated value is written to `jobDescription`.
- [ ] 2.6 Add the `seniority` `<Select>` labeled "Seniority level" (`htmlFor="seniority-select"`, `SelectTrigger id="seniority-select"`). Options: `junior`, `mid`, `senior`, `staff`, `principal`. Apply the flat-underline `SelectTrigger` className per design.md §2.4: `"border-b-2 border-gray-500 rounded-none bg-transparent h-9 px-0 focus:ring-0 focus:ring-offset-0 text-sm"`.
- [ ] 2.7 Implement `handleAddMustHave`: trim `mustHaveInput`, drop empty strings, no-op if `mustHaves.length >= 10`, push to `mustHaves`, clear `mustHaveInput`. Implement `removeMustHave(item: string)`: filter out matching item from `mustHaves`.
- [ ] 2.8 Add the must-haves chip-list UI per design.md §2.7: text input (`id="must-have-input"`, `disabled={mustHaves.length >= 10}`) with `onKeyDown` Enter handler, "Add" button (`disabled={mustHaves.length >= 10}`), helper text "(up to 10)" always visible, and chip row with concrete `className` per design.md §2.7. Each chip remove button has `aria-label={`Remove ${item}`}`.
- [ ] 2.9 Add accessibility pairs per design.md §2.10: `htmlFor`/`id` for all three new inputs (`job-description`, `seniority-select`, `must-have-input`). See table in design.md §2.10.
- [ ] 2.10 Add visual grouping: `<hr className="my-3 border-t border-dashed border-stone-200" />` immediately above the "Hiring criteria" section label. Section label: `<p className="text-sm font-medium">Hiring criteria</p>` (NOT `text-muted-foreground`).
- [ ] 2.11 Spread the three new fields into BOTH submit handlers: `onGenrateQuestions` (line ~100) and `onManual` (line ~117): `job_description: jobDescription, seniority: seniority, must_haves: mustHaves.map(s => s.trim()).filter(Boolean)`.
- [ ] 2.12 Update the existing `useEffect` that resets state on modal close (lines ~131–141) to also reset all six new state slices: `setJobDescription('')`, `setSeniority('mid')`, `setMustHaves([])`, `setMustHaveInput('')`, `setJdIsUploaded(false)`, `setJdFileName('')`. This prevents stale values from persisting across modal reopens.
- [ ] 2.13 Verify: create a new interview via the UI with a non-empty job description (typed and via PDF upload), a non-default seniority, and at least two must-haves. Confirm the values are present in the DB row. Also reopen the modal and confirm all fields are blank/reset.

## 3. Unit Tests — `src/lib/analytics-v2-caps.test.mjs`

- [ ] 3.1 Create `src/lib/analytics-v2-caps.test.mjs`. Add the runner comment at the very top: `// Run with: node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs`. Mirror the structure of `src/lib/retellReviewArtifacts.test.mjs`: `import { test } from 'node:test'; import assert from 'node:assert/strict';`.
- [ ] 3.2 Add the import: `import { applyHardCaps, computeCandidateSpeakingSeconds, countSubstantiveUserTurns, computeOverallScoreFromDimensions } from "./analytics-v2-caps.ts";` (`.ts` extension, matching existing convention).
- [ ] 3.3 Define `makeUserTurn(content, startSec, endSec)` fixture helper per design.md §3.5: splits content into words, distributes timing evenly across the range, returns `{ role: 'user', content, words: [...] }`.
- [ ] 3.4 Define `makeModelOutput(opts = {})` fixture helper per design.md §3.5: returns a minimal valid model output object for hard-cap tests, with `opts` as shallow overrides.
- [ ] 3.5 Define `makeAnalyticsV2(overrides)`, `makeTranscriptTurn(role, words)`, and `makeRetellSignals(overrides)` fixture helpers per design.md §3.5.
- [ ] 3.6 Write test case 1: `clean call — no caps triggered`. Full transcript, mid-range model score. Assert: `hardRulesTriggered.length === 0`, `overallScore === <model score>`, `recommendation !== 'insufficient_data'`. (≥3 assertions)
- [ ] 3.7 Write test case 2: `no-answers — all questions unanswered`. All `perQuestionScores` have `answered: false`. Assert: `recommendation === 'insufficient_data'`, `overallScore <= 20`, `confidence === 'insufficient'`. Verify `hardRulesTriggered` includes a `no_answers` entry. (≥3 assertions)
- [ ] 3.8 Write test case 3: `short call — candidateSpeakingSeconds < 30`. User turns present but total word-time < 30s; at least one question answered. Assert: `overallScore <= 40`, `hardRulesTriggered` includes `short_call`, `recommendation` is NOT `insufficient_data`. (≥3 assertions)
- [ ] 3.9 Write test case 4: `abandoned call — hangup + duration < 50%`. `disconnection_reason === 'user_hangup'`, `duration_ms < time_duration * 60_000 * 0.5`. Assert: `overallScore <= 50`, `hardRulesTriggered` includes `abandoned`. (≥3 assertions)
- [ ] 3.10 Write test case 5: `agent-only — candidate speaks 0s, agent speaks 30s+`. No user turns in transcript. Assert: `recommendation === 'insufficient_data'`, `overallScore <= 10`, `confidence === 'insufficient'`. Verify `hardRulesTriggered` includes `agent_only_speech`. (≥3 assertions)
- [ ] 3.11 Write test case 6: `multiple caps stacked — no-answers + short-call`. Both predicates fire. Assert: `overallScore <= 20` (lowest cap wins, not 40), `hardRulesTriggered` contains both `no_answers` and `short_call`, `recommendation === 'insufficient_data'`. (≥3 assertions)
- [ ] 3.12 Write test case 7: `call_analysis missing (sentinel)`. Pass sentinel `callAnalysis`. No other cap predicates fire; candidate spoke enough. Assert: `hardRulesTriggered` contains an `agent_only_speech` entry with "limited signal" in the `detail`, `overallScore > 10` (NOT capped by sentinel alone), `recommendation !== 'insufficient_data'`. (≥3 assertions)
- [ ] 3.13 Write test case 8: `empty transcript_object entirely`. `transcript_object === []`. Assert: `hardRulesTriggered` contains `agent_only_speech`, `overallScore <= 10`, `recommendation === 'insufficient_data'`. (≥3 assertions)
- [ ] 3.14 Write test case 9: `computeOverallScoreFromDimensions — weights sum + math`. Feed six dimension objects using the canonical weights from `ANALYTICS_V2_DIMENSION_WEIGHTS`. Assert: the returned score matches `Math.round(sum * 10)` for the manually computed weighted average, and assert that the weights sum to within floating-point epsilon of 1.0. (≥3 assertions)
- [ ] 3.15 Write test case 10: `countSubstantiveUserTurns — counting heuristic`. Feed a transcript with agent turns, user turns with >=8 words, user turns with >=40 chars but <8 words, and user filler turns (<8 words, <40 chars). Assert: count equals only the qualifying user turns; agent turns are excluded; filler turns are excluded. (≥3 assertions)
- [ ] 3.16 Run `node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs` and confirm all 10 test cases pass (exit 0).
