## Context

The `interviewer` table currently has no `prompt`, `voice_id`, or `deleted_at` columns. Three rows exist in production (Explorer Lisa, Empathetic Bob, Robust Bot). Their prompts are stored only in `src/lib/constants.ts`; their voice IDs are hardcoded only in `src/app/api/create-interviewer/route.ts`. No runtime CRUD exists — the only path to add or remove interviewers is via the seed route or direct DB access.

The `feat/atlassian-design-system-redesign` branch (current) already contains the Robust Bot interviewer commit. The design targets this branch. The `interviewer` table is globally shared — no `org_id` or `user_id` scoping exists, and this MVP does not introduce it.

The existing soft-delete pattern in the codebase uses `is_archived BOOLEAN` on the `interview` table. This MVP deliberately diverges from that pattern by using `deleted_at TIMESTAMPTZ NULL` — which is more expressive (timestamped, recoverable) and is the pattern locked in brainstorming. Future changes may want to align the two patterns, but that is out of scope here.

Lisa and Bob share a single Retell LLM object (provisioned by the original seed route with the general prompt). Robust Bot has its own LLM. This legacy quirk is NOT changed by this MVP — we do not re-provision Lisa/Bob. The new CRUD flow creates one Retell LLM per interviewer always, even if the prompt text is identical to an existing LLM.

## Goals / Non-Goals

**Goals:**
- Add `prompt TEXT NOT NULL`, `voice_id TEXT NULL`, `deleted_at TIMESTAMPTZ NULL` to the `interviewer` table with correct backfill.
- Expose `POST /api/interviewers` (authenticated, creates Retell LLM + Retell agent + DB row).
- Expose `DELETE /api/interviewers/[id]` (authenticated, soft-delete only — no Retell API calls).
- Add `VOICE_OPTIONS` (Chloe + Brian) and `PROMPT_FOOTER_TEMPLATE` constants.
- Show a create modal in the dashboard roster grid (New Interviewer card).
- Show the prompt as read-only in the details modal.
- Add a delete confirmation dialog to each interviewer card.
- Null-guard `register-call` against unknown `interviewer_id`.
- Remove dead `createInterviewer` from context; delete unused `useInterviewersQuery` hook.

**Non-Goals:**
- Multi-tenancy / org scoping (no `org_id` column, no per-org list filtering).
- Per-interviewer prompt or voice editing (delete + recreate is the v1 mutation pattern).
- Live Retell voice catalog fetch (no API call to Retell for available voices).
- Audio preview in the create form.
- Retell resource cleanup on soft-delete (LLM + agent leak is an accepted v1 cost).
- Trait sliders affecting Retell agent behavior (sliders remain decorative metadata).
- Versioned prompts or prompt history.
- Idempotency guard on the seed route `GET /api/create-interviewer` (pre-existing gap).
- Re-provisioning Lisa/Bob with a dedicated Retell LLM each (legacy quirk, out of scope).

## Decisions

### 1. Three-resource coordination on create (Retell LLM → Retell agent → DB INSERT)

**Decision:** `POST /api/interviewers` calls `retellClient.llm.create()`, then `retellClient.agent.create()` with the returned `llm_id`, then `InterviewerService.createInterviewer()` with the returned `agent_id`. One Retell LLM per interviewer, always.

**Rationale:** Sharing LLMs across interviewers would require tracking which LLM has which prompt and matching on create — unnecessary complexity for an MVP. One LLM per interviewer is simple, unambiguous, and consistent regardless of prompt duplication.

**Partial-failure handling:** If Retell LLM creation succeeds but agent creation fails, or if agent creation succeeds but DB insert fails, orphaned Retell resources are left behind. This is an accepted v1 cost (same category as the delete-side leak). The route returns a 500 in these cases. A future change can add a cleanup + retry layer. **The design doc explicitly does NOT attempt cleanup in the error path** — a failed cleanup after a failed create is worse than a clean error response with a known leak.

**Alternative considered:** Cleanup on partial failure (delete the created LLM if agent creation fails). Rejected — adds code complexity, is not atomic, and Retell deletes can themselves fail, leaving the code in an even more ambiguous state. Document the leak and move on.

### 2. Soft-delete only; no Retell deletion in v1

**Decision:** `DELETE /api/interviewers/[id]` sets `deleted_at = NOW()` on the DB row. It does NOT call `retellClient.llm.delete()` or `retellClient.agent.delete()`.

**Rationale:** Deleting Retell resources while in-flight calls may reference them would break active interviews. Soft-delete gives us a safe, recoverable state. The Retell resource leak (one LLM + one agent per deleted interviewer) is an accepted cost for MVP.

**Double-delete contract (operator-locked):** The SQL does NOT include a `deleted_at IS NULL` filter: `UPDATE interviewer SET deleted_at = NOW() WHERE id = ?`. Re-deleting an already-deleted interviewer simply overwrites the timestamp and returns 200. The operation is idempotent — callers that retry on network failure will not receive an unexpected error.

**Known cost:** Retell account accumulates LLM + agent objects for deleted interviewers. A future "interviewer purge" routine can call Retell delete on rows where `deleted_at` is older than some threshold and no interviews reference them.

### 3. `register-call` null-guard (F1 mitigation)

**Decision:** Add an early-return 404 in `src/app/api/register-call/route.ts` if `getInterviewer` returns null or throws.

**Rationale:** Currently the route will pass `undefined` as `agent_id` to Retell if the interviewer is missing, causing an opaque 500 downstream. A 404 with a clear message is the correct HTTP response for a missing resource. The `getInterviewer` method intentionally does NOT filter on `deleted_at` — soft-deleted interviewers must still be able to serve in-flight calls. The null-guard only protects against truly missing rows (wrong ID, hard delete, etc.).

**`getInterviewer` null-on-missing contract:** The service method MUST catch Supabase error code `PGRST116` (the "JSON object requested, multiple (or no) rows returned" error that `.single()` emits on zero rows) and return `null` rather than throwing. All other errors are re-thrown. Callers (including `register-call`) check for `null` return and respond with 404. This prevents the route from receiving an unhandled exception for a completely valid "no such interviewer" scenario.

```ts
// getInterviewer — pseudocode
const { data, error } = await supabase.from('interviewer').select('*').eq('id', id).single();
if (error) {
  if (error.code === 'PGRST116') return null; // row not found — not an error
  throw error; // real DB error — propagate
}
return data;
```

### 4. Context mutation pattern: full refetch (no react-query wiring)

**Decision:** Post-mutation (create or delete), call `fetchInterviewers()` (the existing full-refetch from context). Do NOT wire up `useInterviewersQuery` / `useInvalidateInterviewers`.

**Rationale:** The context already owns the `interviewers[]` state. A full refetch is simple and correct. The `useInterviewersQuery` hook exists but is unused everywhere — wiring it up would touch more files and split the data-ownership pattern mid-MVP. The hook should be deleted (it's dead code). A future "use react-query everywhere" refactor is the right place to unify.

**F7 resolution:** Delete `src/hooks/useInterviewersQuery.ts`.

### 5. `create-interviewer` route: deprecate, do not remove

**Decision:** Mark `GET /api/create-interviewer` deprecated with a comment and `console.warn` on every invocation. Leave it functional.

**Rationale:** The route is the only way to seed a fresh environment. Removing it would break the dev setup flow. The CRUD MVP does not provide a batch-seed equivalent. The button on the dashboard that calls it (`createInterviewerButton.tsx`) is replaced by the new "New Interviewer" card, so the route becomes unreachable from the UI — but keep it for direct invocation in dev environments.

### 6. `VOICE_OPTIONS` shape and values (v1)

**Decision:** Two entries only:

```ts
export const VOICE_OPTIONS = [
  { id: "11labs-Chloe", label: "Chloe (warm, articulate female)" },
  { id: "11labs-Brian", label: "Brian (clear, neutral male)" },
] as const;
```

**Rationale:** Both voices are already in production (Lisa uses Chloe, Bob and Robust Bot use Brian). Zero risk of an invalid `voice_id` being submitted to Retell. The operator can append entries to this constant without any backend changes.

**Trait sliders helper text (details modal):** Inside `InterviewerDetailsModal`, next to the trait sliders section, add a small helper line:

```tsx
<p className="text-xs text-muted-foreground">Display only — does not affect interview behavior.</p>
```

Place this immediately after the `<h3>` (or equivalent section header) for the traits/sliders block, before the first slider. This text applies to both the create modal and the details modal (see Decision 8 for the create modal placement).

**Prompt textarea in details modal:** Render the prompt as a fixed-size read-only textarea:

```tsx
<Textarea
  readOnly
  value={interviewer.prompt}
  rows={Math.min(24, Math.max(6, interviewer.prompt.split('\n').length + 2))}
  className="font-mono text-xs resize-none"
/>
```

`rows` is computed dynamically: `Math.min(24, Math.max(6, prompt.split('\n').length + 2))` — at least 6 rows, at most 24, adapting to short prompts so the modal isn't unnecessarily tall. The textarea does NOT scroll internally (`resize-none`; no `overflow-auto` on the textarea element). The modal container's `overflow-y-auto` is the single scroll context. This avoids nested scroll confusion.

### 7. `PROMPT_FOOTER_TEMPLATE` shape and server-side validation

**Decision:**

```ts
export const PROMPT_FOOTER_TEMPLATE = `
- Candidate name: {{name}}
- Duration: keep the interview to roughly {{mins}} minutes
- Role and objective: {{objective}}
- The screening questions for this role (use these as your anchor — do not deviate from the objective):
{{questions}}`.trim();
```

The `POST /api/interviewers` handler validates that the submitted `prompt` string ends with (or contains) the exact `PROMPT_FOOTER_TEMPLATE` text. If the footer is missing, the request is rejected with 422.

**Rationale:** The footer contains the four dynamic-variable placeholders (`{{name}}`, `{{mins}}`, `{{objective}}`, `{{questions}}`) that `register-call` injects at runtime. Without them, a Retell call will have no candidate context. Server-side validation prevents API-direct callers from creating a broken interviewer.

**Implementation note:** The server normalizes whitespace before comparison: trim leading/trailing whitespace, collapse `\r\n` → `\n`. The check is `normalize(prompt).includes(normalize(PROMPT_FOOTER_TEMPLATE))`. The comparison is whitespace-normalized but still byte-exact on content (no placeholder fuzzing — any missing `{{...}}` placeholder fails validation). A helper function `normalizeWhitespace(s: string): string` trims and normalizes line endings.

Additionally, the server validates that the prompt body (the user-authored portion before the footer is appended) is non-empty after trimming. The client constructs the full prompt as `promptBody + "\n\n" + PROMPT_FOOTER_TEMPLATE`; the server extracts the body by stripping the footer suffix and trims what remains. If the body is empty, the request is rejected with 422 and a clear error message ("Prompt body must not be empty").

The create modal renders the footer below the textarea as visually distinct, read-only text and appends it automatically on submit.

### 8. Create form layout: modal, not a dedicated page; always-render grid

**Decision:** A "New Interviewer" card in the roster grid (same grid as existing `InterviewerCard` items) opens a modal dialog containing the create form. No route change (`/dashboard/interviewers/new` is NOT added).

**Always-render grid:** `src/app/(client)/dashboard/interviewers/page.tsx` MUST always render the `DataGrid` — the `interviewers.length === 0` EmptyState branch (if one exists) is removed. `<NewInterviewerCard>` is rendered as the **last** card in the `DataGrid` at all times (position locked to last — existing roster stays visually stable as more interviewers are added). When the interviewer list is empty, the page shows only the `NewInterviewerCard` — no separate empty-state helper text is needed because the card itself serves as the affordance. This avoids a code path where clicking "New Interviewer" is impossible when the list is empty.

**Rationale:** Operator confirmed modal placement. The form fields (name, description, avatar, voice picker, prompt textarea + locked footer, trait sliders) fit in a scrollable modal. The roster grid is not navigated away from, keeping context.

**Modal field order:**
1. Name (text input, required)
2. Description (textarea, required)
3. Avatar (image picker from the 8 entries in `avatars.ts`, required)
4. Voice (dropdown from `VOICE_OPTIONS`, required)
5. Prompt body (textarea, required — user edits this part)
6. Locked footer (read-only, visually distinct — appended automatically on submit)
7. Trait sliders: Empathy, Rapport, Exploration, Speed (1–10 range, decorative)

#### Avatar picker (4×2 thumbnail grid)

The avatar picker renders the 8 avatars from `src/components/dashboard/interviewer/avatars.ts` as a **4-column × 2-row grid** (CSS `grid grid-cols-4 gap-2`) inside the create modal — no horizontal scroll. Each avatar is wrapped in a `<button type="button">` element:

```tsx
<button
  type="button"
  aria-label={`Avatar option ${avatar.id}`}  // or the filename if more descriptive
  onClick={() => setImage(avatar.img)}
  className={cn(
    "rounded-md overflow-hidden border-4",
    image === avatar.img ? "border-brand-bold" : "border-transparent"
  )}
>
  <img src={avatar.img} alt="" aria-hidden="true" className="w-full h-full object-cover" />
</button>
```

Selected avatar is shown with `border-4 border-brand-bold` (match the existing app convention in `details.tsx`; use `ring-4 ring-brand-bold` if that is the convention found in the codebase — check at apply time). Unselected avatars have `border-transparent`. Clicking sets the form's `image` field to the avatar's `img` path.

#### Trash icon — hover-revealed

The delete affordance on each `InterviewerCard` is a **hover-revealed** absolute-positioned trash icon button:

```tsx
// InterviewerCard parent must have className="... group relative"
<button
  type="button"
  aria-label="Delete interviewer"
  onClick={(e) => { e.stopPropagation(); openDeleteDialog(); }}
  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
  style={{ width: 28, height: 28 }}
>
  <Trash2 size={16} />  {/* Trash2 from lucide-react */}
</button>
```

- `e.stopPropagation()` is required so the details modal does not also open when the trash icon is clicked.
- The `group` class must be on the outermost card element.
- Icon size: 28×28px button, `Trash2` icon from `lucide-react`.

**Mobile gap (known UX limitation):** Touch devices have no hover state, so the trash icon will be invisible on mobile. This is a known v1 limitation (see "Known UX Limitations" below).

**Optional enhancement (not required to land):** Add a CSS media query so touch devices always show the icon:

```css
@media (hover: none) {
  .trash-icon { opacity: 1; }
}
```

Or via Tailwind if the project uses `[@media(hover:none)]:opacity-100`. Implementer may add this at their discretion — it is a nice-to-have, not a landing requirement.

#### Error banner in create modal

When the create API call fails, render an error banner **pinned between the form body and the footer button row** (submit + cancel):

```tsx
{error && (
  <div className="bg-destructive/10 border border-destructive text-destructive text-sm rounded-md p-3">
    {errorMessage}
  </div>
)}
```

- Hidden entirely when no error is present (do not reserve dead space).
- For **422** (validation): surface the server's exact `error.message` (e.g., `"Prompt body is empty"` or `"Prompt footer placeholder missing: {{questions}}"`).
- For **500** (Retell/DB failure): in non-production environments render `"Failed to create interviewer — please try again. (Detail: <details>)"`. In production: `"Failed to create interviewer — please try again."`.
- Both 422 and 500 keep the modal open (do not close on error).

#### Submit button loading state

The create call typically takes 2–5 seconds (two Retell roundtrips + DB insert). During the in-flight call:

- The submit button is `disabled` and shows `<Loader2 className="animate-spin" />` with the label `"Creating..."` (replacing `"Create interviewer"`).
- The Cancel button is also `disabled` (to prevent half-aborts).
- Form fields remain enabled (the user can read them; the disabled submit is the only exit).
- No full-modal overlay or spinner — the spinner inside the button is sufficient.

```tsx
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? (
    <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Creating...</>
  ) : (
    "Create interviewer"
  )}
</Button>
<Button type="button" variant="ghost" disabled={isSubmitting} onClick={onClose}>
  Cancel
</Button>
```

#### Trait sliders helper text (create modal)

In the create modal, immediately after the sliders section header (before the first slider), add:

```tsx
<p className="text-xs text-muted-foreground">Display only — does not affect interview behavior.</p>
```

This same helper text also appears in the `InterviewerDetailsModal` (see Decision 6).

#### Known UX Limitations

- **ESC closes modal silently:** ESC closes the create modal without an unsaved-changes guard. Any text typed into the form fields is discarded. This matches the existing app-wide modal pattern (`Modal` wrapper uses Radix Dialog which closes on ESC by default). A `useUnsavedChangesGuard` hook is out of v1 scope.
- **Trash icon invisible on touch devices:** Hover-reveal means the trash icon is not accessible on mobile without hover support. The optional `@media (hover: none)` enhancement (described above) can be added during apply at the implementer's discretion.

### 9. Phantom `user_id` removal (F2 fix)

**Decision:** Remove `user_id: string` from `src/types/interviewer.ts` when adding the new fields.

**Rationale:** This field has never existed in the `interviewer` table (confirmed via `supabase_schema.sql` and `src/types/database.types.ts`). It is a type lie. No code reads `interviewer.user_id` at runtime. Removal is safe and cosmetically correct.

### 10. `voice_id` persisted to `interviewer` table (F8 fix)

**Decision:** `voice_id TEXT NULL` column added to `interviewer` table. The `createInterviewer` service method accepts and stores it. The `POST /api/interviewers` route passes the operator-submitted `voice_id` to both Retell agent creation and DB insert.

**Rationale:** Without storing `voice_id`, there is no way to know which voice a CRUD-created interviewer used. Displaying it in the details modal or re-provisioning later would be impossible. The column is `NULL` to accommodate the three seed interviewers whose voice was hardcoded in the seed route (backfilled in the migration).

### 11. Dead code removal (F5 + F7)

**Decision:** Remove `createInterviewer` from `interviewers.context.tsx` (F5). Delete `src/hooks/useInterviewersQuery.ts` (F7).

**Rationale:** F5: The context `createInterviewer` is unused by any component. The new create flow goes through `POST /api/interviewers` via a fetch call in the create modal — server-side validation and Retell provisioning must not be bypassable from the client context. F7: The hook is entirely unused and would cause confusion about which data-fetching pattern to follow.

## Risks / Trade-offs

- **Retell resource leak on create failure** → Document the leak; return 500 with a clear message; do not attempt cleanup. A future change can add idempotency/cleanup.
- **Retell resource leak on delete** → Accepted v1 cost. Document that `deleted_at IS NOT NULL` rows have orphaned Retell resources. Future purge routine can address.
- **`deleted_at` diverges from `is_archived` pattern on `interview` table** → Acknowledged. `deleted_at` is more expressive (timestamped, recoverable). Brainstorming decision locked. Future change can unify the two patterns.
- **Lisa/Bob share a single Retell LLM (legacy quirk)** → NOT changed by this MVP. This means Lisa and Bob's prompts are not persisted per-row in the DB today; the migration backfills the prompt text from constants to both rows, but changing either's prompt via CRUD is not supported (no edit flow). A "delete + recreate" workaround works.
- **`create-interviewer` route idempotency gap (pre-existing)** → Not introduced by this change. The deprecated route still has no idempotency guard. Document as pre-existing.
- **Single-org only** → The roster is globally shared. Any authenticated user can create or delete any interviewer. Acceptable for the current single-org deployment; multi-tenancy is an explicit non-goal.

## Service Layer Contract

### `getInterviewer(id)`

Calls `.single()` which throws a `PGRST116` error when the row is not found. The method MUST catch this specific code and return `null` instead of propagating the exception. All other Supabase errors are re-thrown. See Decision 3 above for pseudocode.

### `createInterviewer(payload)`

The Supabase insert MUST chain `.select().single()` to return the created row:

```ts
const { data, error } = await supabase
  .from('interviewer')
  .insert(payload)
  .select()
  .single();
```

Without `.select()`, Supabase returns `null` as the data even on success, making the 201 response body empty. The route MUST return the full created interviewer object (including `id` and `agent_id`) in the 201 body.

### `deleteInterviewer(id)`

Uses Supabase client syntax (not raw SQL):

```ts
const { data, error } = await supabase
  .from('interviewer')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id)
  .select();
```

No `deleted_at IS NULL` filter — the update applies regardless of prior soft-delete state (idempotent, see Decision 2). The route returns 404 only if `data` is an empty array (no row with that id at all). Re-deleting an already-deleted row returns 200.

## Migration Plan

### Schema migration (run via Supabase migration or direct SQL)

```sql
-- Step 1: Add prompt column with temporary default (IF NOT EXISTS — safe to re-run)
ALTER TABLE interviewer
  ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';

-- Step 2: Backfill — Lisa and Bob use the general prompt
UPDATE interviewer
SET prompt = 'You are an interviewer who is an expert in asking follow up questions to uncover deeper insights. You have to keep the interview for {{mins}} or short.

The name of the person you are interviewing is {{name}}.

The interview objective is {{objective}}.

These are some of the questions you can ask.
{{questions}}

Once you ask a question, make sure you ask a follow up question on it.

Follow the guidlines below when conversing.
- Follow a professional yet friendly tone.
- Ask precise and open-ended questions
- The question word count should be 30 words or less
- Make sure you do not repeat any of the questions.
- Do not talk about anything not related to the objective and the given questions.
- If the name is given, use it in the conversation.'
WHERE name IN ('Explorer Lisa', 'Empathetic Bob');

-- Step 3: Backfill — Robust Bot uses its own prompt
UPDATE interviewer
SET prompt = '# Role

You are conducting a first-round screening interview for a role at Robust Devs, a custom web development agency. The specific role, the interview objective, and the questions are provided to you separately for each interview — read them and stay grounded in that role. You are an experienced interviewer who has screened many candidates and watched plenty of them overpromise. Your job is to find out whether this candidate can actually do the work. It is not to make them feel good.

# How you behave

Do not praise answers. No "great answer," "excellent," "I love that," "perfect." When a candidate finishes, acknowledge briefly and neutrally — "Okay." "Understood." "Got it." — then move on. A strong answer and a weak answer get the same flat acknowledgment.

Do not agree reflexively or validate. Stay neutral in tone and word choice. Don''t telegraph whether an answer landed.

Probe every substantive answer one level deeper before moving on. If they describe a process, ask what happened the last time it broke. If they claim a result, ask how they measured it. If they mention a project or task, ask what their specific role was and what they personally decided.

Reject vague or generic answers out loud. If an answer is hand-wavy, buzzword-heavy, or textbook, say so and ask for something concrete: "That''s general — give me a specific example and what you actually did." "That''s the textbook answer. What happened on a real project?"

If they don''t answer the question asked, point it out and repeat it: "That''s not quite what I asked. The question was..."

Do not help them. Don''t finish their sentences, don''t hint at the answer you want, don''t soften a hard question after asking it. Let silences sit.

# Tone

Direct and concise. Short questions, no filler, no warm-up padding. You are exacting, not rude — you never insult, mock, or talk over the candidate. Think of a senior colleague who respects the candidate''s time enough not to waste it, and respects the role enough not to wave a weak answer through.

# Fairness

Judge the substance of answers, not accent or fluency. Many candidates are not native English speakers. Give them time to think, let pauses sit, and allow them to rephrase. Probing means pushing for depth and specifics — never rushing someone or penalizing how they sound.

# Pacing

This is a short first-round screen. Keep to roughly equal time across the questions and stay aware of the clock. If an answer runs long without adding substance, cut in politely: "Let me stop you there." Once you have a clear, specific answer plus one follow-up, move to the next question.

# Opening

Keep it short: "Hi, thanks for making the time. This is a short first-round screening interview. I''ll be direct and I''ll push on your answers — that''s by design, not a bad sign. Ready when you are — first question."

# Closing

Brief, no false warmth, no verdict: "That''s everything from my side. We''ll review and be in touch about next steps. Thanks for your time." Never tell the candidate how they did or whether they''re progressing.

# Context for this interview

- Candidate name: {{name}}
- Duration: keep the interview to roughly {{mins}} minutes
- Role and objective: {{objective}}
- The screening questions for this role (use these as your anchor — do not deviate from the objective):
{{questions}}'
WHERE name = 'Robust Bot';

-- Step 4: Drop the temporary default (idempotent via DO block)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interviewer' AND column_name = 'prompt'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE interviewer ALTER COLUMN prompt DROP DEFAULT;
  END IF;
END $$;

-- Step 5: Add soft-delete column (IF NOT EXISTS — safe to re-run)
ALTER TABLE interviewer
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Step 6: Add voice_id column (IF NOT EXISTS — safe to re-run)
ALTER TABLE interviewer
  ADD COLUMN IF NOT EXISTS voice_id TEXT NULL;

-- Step 7: Backfill voice_id for existing rows
UPDATE interviewer SET voice_id = '11labs-Chloe' WHERE name = 'Explorer Lisa';
UPDATE interviewer SET voice_id = '11labs-Brian' WHERE name IN ('Empathetic Bob', 'Robust Bot');
```

**Notes on the migration:**
- Backfill uses `name` matching. If duplicate names exist (seed route called twice), all rows with that name receive the same prompt and voice, which is correct behavior.
- The prompt text in the SQL above is copied verbatim from `src/lib/constants.ts` as of commit `d5ce802`. Any change to the constants after this point requires the migration SQL to be updated before running.
- **The migration is safe to re-run.** All `ADD COLUMN` statements use `IF NOT EXISTS`. The `DROP DEFAULT` step is wrapped in a `DO` block that checks whether a default exists before attempting to drop it.
- **SQL escaping:** The implementer MUST SQL-escape any single quotes in the prompt text (`'` → `''`) when transcribing into the UPDATE statements. The Robust Bot prompt already uses this convention in the SQL above (e.g., `don''t`, `it''s`). Verify the full prompt text against `src/lib/constants.ts` at apply time — the SQL shown above is illustrative; the apply step will produce the exact runnable SQL with correct escaping.
- The migration is **not reversible** without a full backup. There is no rollback script — the three new columns have safe defaults (empty string, NULL, NULL) and no existing code references them, so adding them is safe even if apply fails partway through.

### Post-migration steps

1. Regenerate or hand-update `src/types/database.types.ts` to include `prompt: string`, `voice_id: string | null`, and `deleted_at: string | null` on the `interviewer` row type.
2. Run `tsc --noEmit` to confirm no type errors before opening a PR.

### Rollback

If the migration must be reversed before any CRUD usage:

```sql
ALTER TABLE interviewer DROP COLUMN IF EXISTS prompt;
ALTER TABLE interviewer DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE interviewer DROP COLUMN IF EXISTS voice_id;
```

This is safe because no application code reads these columns until the code deploy lands.

## Known Gaps Deferred to Follow-Up

The following issues are out of MVP scope but should be addressed in a follow-up change:

### `fix-interviewer-null-guards-component-callers`

After the BLOCKER fix to `getInterviewer` (which makes the service return `null` instead of throwing on PGRST116), two component-level callers still index directly on the result without a null check:

- `src/components/dashboard/interview/interviewCard.tsx:32` — accesses `.image`, `.name`, etc. on the result of `getInterviewer` without checking for null.
- `src/components/call/index.tsx:711` — same pattern.

Because the service no longer throws, these callers will receive `null` silently and may render broken UI (undefined property access) rather than crashing. The correct fix is to add null-guard branches in both components before accessing interviewer properties. This is deferred because: (a) both callers only execute when `interviewer_id` is known at call time, making null extremely rare in practice; (b) fixing them requires component-level logic changes not related to the CRUD MVP scope.

The follow-up change should be tracked as `fix-interviewer-null-guards-component-callers`.

## Open Questions

All major questions from `.cgc-notes.md` are resolved by the locked decisions above:

- **Q1 (API route structure)**: REST (`/api/interviewers`, `/api/interviewers/[id]`). Locked.
- **Q2 (Context vs react-query)**: Full refetch via `fetchInterviewers()`. `useInterviewersQuery` deleted. Locked.
- **Q3 (Create form placement)**: Modal. Locked.
- **Q4 (Delete confirmation)**: Required — always show a confirmation dialog. Locked.
- **Q5 (`create-interviewer` fate)**: Deprecated with comment + `console.warn`. Locked.
- **Q6 (Retell LLM per create)**: One LLM per interviewer always. Locked.
- **Q7 (Details modal prompt)**: YES — read-only textarea with monospace font. Locked.

No open questions remain for the apply step.
