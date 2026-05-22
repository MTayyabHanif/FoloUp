## Context

The `add-interviewer-crud-mvp` change added `POST /api/interviewers` (create) and `DELETE /api/interviewers/[id]` (soft-delete). The create flow provisions one Retell LLM + one Retell agent per interviewer. The `interviewer` table now has `prompt`, `voice_id`, and `deleted_at`, but does NOT store `retell_llm_id` — the LLM ID returned by Retell on create was never persisted. This creates a gap: to PATCH an interviewer's prompt in Retell, the LLM ID is required, but it is not in the DB.

Three seed interviewers (Explorer Lisa, Empathetic Bob, Robust Bot) pre-exist with Retell agent IDs stored in `agent_id`. Lisa and Bob share a single Retell LLM (legacy quirk from the seed route). Robust Bot has its own LLM. None have `retell_llm_id` in the DB. Newly created interviewers (via the CRUD MVP POST route) also never had `retell_llm_id` persisted.

The `interviewer` table is globally shared — no org scoping. The `interview.interviewer_id` FK means a given agent_id is already associated with sessions; we must never re-provision (change agent_id). PATCH in-place is the only safe mutation strategy.

File anchors:
- `src/app/api/interviewers/route.ts:9-11` — Retell client instantiation pattern.
- `src/app/api/interviewers/route.ts:93-176` — validation + Retell provisioning pattern to mirror.
- `src/app/api/interviewers/[id]/route.ts:11` — where DELETE lives; PATCH goes in the same file.
- `src/services/interviewers.service.ts:98+` — `deleteInterviewer`; `updateInterviewer` goes alongside.
- `src/contexts/interviewers.context.tsx:35-66` — context surface; `deleteInterviewer` at line 52 is the mirror pattern.
- `src/components/dashboard/interviewer/CreateInterviewerModal.tsx:95-152` — extractable sub-components (`Fieldset` at 95, `TraitSlider` at 117) and INITIAL_STATE shape at line 41. Note: sub-components are inlined, not yet extracted.
- `src/components/dashboard/interviewer/InterviewerCard.tsx:214-224` — current delete trigger button; edit trigger goes immediately before it (left of trash icon).
- `src/types/interviewer.ts:1-16` — interface to extend.
- `src/types/database.types.ts:142-192` — Row/Insert/Update shapes.
- `supabase_schema.sql:21-36` — CREATE TABLE block to document.
- `src/app/api/register-call/route.ts:218-221` — confirms only `agent_id` is used on call-start.

**Important: `params` is a Promise in Next.js App Router.** The existing DELETE handler signature is `{ params }: { params: Promise<{ id: string }> }` with `const { id: rawId } = await params;`. The PATCH handler MUST follow this exact same async params pattern — not the older sync form.

## Goals / Non-Goals

**Goals:**
- Add `PATCH /api/interviewers/[id]` that syncs mutations to Retell in-place (no re-provisioning).
- Persist `retell_llm_id` via lazy backfill on first edit (no migration backfill required).
- Extract shared sub-components (`TraitSlider`, `Fieldset`, `AvatarGrid`) so Create and Edit modals share the same UI atoms.
- Add `EditInterviewerModal` pre-filled from the existing interviewer row (footer stripped from prompt display).
- Add an edit trigger on `InterviewerCard` adjacent to the delete trigger.
- Add `promptFooter.ts` util (`stripFooter`, `appendFooter`) to replace inline footer logic and power edit-modal prefill.

**Non-Goals:**
- Re-provisioning (changing `agent_id` or `llm_id`) — PATCH in-place only.
- Mid-session prompt updates — `interview.interviewer_id` FK already isolates calls to the agent at call-start time.
- Retell voice catalog fetch — voice picker remains a static list from `VOICE_OPTIONS`.
- Bulk edit.
- Prompt versioning or history.
- Migration backfill of `retell_llm_id` — lazy on first edit only.

## Decisions

### 1. PATCH in-place, never re-provision

**Decision:** `PATCH /api/interviewers/[id]` never creates or deletes Retell resources. It only calls `retellClient.llm.update()` and/or `retellClient.agent.update()` as needed, then updates the DB row. The `agent_id` and `retell_llm_id` stored in the DB remain stable across the edit.

**Rationale:** `interview.interviewer_id` FK ties session history to the interviewer. Changing `agent_id` would either orphan history or require a cascade update. Re-provisioning also risks a race condition where an in-flight call references the old agent while it's being replaced. PATCH in-place is the only safe option.

**Alternative considered:** Delete + re-create (new agent_id on every edit). Rejected — breaks session history FK and in-flight calls.

### 2. Retell call routing: which calls to make

Three branches based on what changed in the body:

```
PATCH body received
│
├── prompt OR any trait slider changed?
│     └── retellClient.llm.update(llm_id, { general_prompt: appendFooter(body) })
│
├── voice_id OR name changed?
│     └── retellClient.agent.update(agent_id, { voice_id?, agent_name? })
│
└── only avatar/description changed?
      └── skip both Retell calls; go straight to DB UPDATE
```

Fields with Retell mappings:
- `prompt` / trait sliders → LLM general_prompt
- `voice_id` → agent voice_id
- `name` → agent agent_name

Fields with no Retell mapping (avatar/image, description) → no Retell call needed.

A single PATCH body can trigger both LLM and agent updates (e.g., prompt + voice_id both changed). Both calls are made sequentially.

### 3. Atomicity: Retell-first, DB-second

**Decision:** Order of operations:
1. Lazy backfill `retell_llm_id` if null (Retell agent retrieve).
2. Retell LLM PATCH (if needed).
3. Retell agent PATCH (if needed).
4. DB UPDATE (includes `retell_llm_id` if newly resolved).

On Retell failure at any step → return error to client, abort, no DB write.
On DB write failure after Retell success → surface error to client; accept transient drift (next edit will reconverge Retell state since the DB row still has the old values).

**Sequence diagram — normal edit (prompt + voice_id both changed):**

```
Client          PATCH handler          Retell API          Supabase
  │                   │                    │                   │
  │── PATCH body ────>│                    │                   │
  │                   │── retrieve agent ─>│                   │
  │                   │<─ agent (llm_id) ──│                   │
  │                   │── llm.update() ───>│                   │
  │                   │<─ 200 OK ──────────│                   │
  │                   │── agent.update() ──>│                  │
  │                   │<─ 200 OK ──────────│                   │
  │                   │────────────────────────── DB UPDATE ──>│
  │                   │<───────────────────────── updated row ─│
  │<── 200 + row ─────│                    │                   │
```

**Sequence diagram — lazy backfill (retell_llm_id IS NULL):**

```
Client          PATCH handler          Retell API          Supabase
  │                   │                    │                   │
  │── PATCH body ────>│                    │                   │
  │                   │─── SELECT row ─────────────────────── >│
  │                   │<─── row (llm_id=NULL) ────────────────│
  │                   │── agent.retrieve(agent_id) ──>│        │
  │                   │<─ { response_engine: { type, llm_id }}│ │
  │                   │  [if type !== 'retell-llm': return 500]│
  │                   │  [else: llm_id resolved] │             │
  │                   │── llm.update(llm_id, ...) ─>│          │
  │                   │<─ 200 OK ──────────│        │          │
  │                   │── agent.update(..) ─>│       │          │
  │                   │<─ 200 OK ──────────│        │          │
  │                   │──── DB UPDATE (patch fields + retell_llm_id) ─>│
  │                   │<─── updated row ───────────────────────│
  │<── 200 + row ─────│                    │                   │
```

**Sequence diagram — skip Retell (only avatar/description changed):**

```
Client          PATCH handler          Retell API          Supabase
  │                   │                    │                   │
  │── PATCH body ────>│                    │                   │
  │                   │  [no Retell-mapped fields — skip]      │
  │                   │──────────────────────── DB UPDATE ────>│
  │                   │<──────────────────────── updated row ──│
  │<── 200 + row ─────│                    │                   │
```

**Retell-first failure model — explicit drift cases:**

- **Retell LLM update succeeds, Retell agent update fails → DB not written.** The Retell LLM already reflects the new prompt; the agent still has the old voice. The DB row still has the old values. Transient drift: LLM is ahead of DB and agent. On next edit, the same Retell calls are made and converge. This is accepted. Surfaced as 500 to the client.
- **Both Retell calls succeed, DB write fails.** Retell is fully updated; DB is stale. Same reconvergence path: next edit re-applies the same Retell values (idempotent), and the DB write is retried. Surfaced as 500.
- **Retell LLM update fails (no agent update attempted) → DB not written.** Clean failure; no drift.

Neither drift case is silent. In all drift cases, the client receives a 500, and the next successful edit re-aligns state. This matches the accepted posture from the create/delete MVP.

**Rationale for Retell-first:** If DB writes first and Retell fails, the DB reflects a state that Retell will never achieve — a permanent inconsistency. Writing Retell first means on DB failure, the user sees an error but the next attempt will re-apply the same Retell state (Retell PATCH is idempotent for the same input).

### 4. retell_llm_id lazy backfill — no migration backfill

**Decision:** `retell_llm_id` column is added as `TEXT NULL`. No SQL backfill in the migration. On the first PATCH for any row where `retell_llm_id IS NULL`:
1. Call `retellClient.agent.retrieve(agent_id)`.
2. Assert `response_engine.type === 'retell-llm'`. If not, return 500 with a clear error message — do not silently fall through to a NOOP.
3. Read `response_engine.llm_id`.
4. Include `retell_llm_id` in the same DB UPDATE as the rest of the patch.

**Rationale:** A SQL backfill requires knowing the `llm_id` for each existing row. Lisa/Bob share one LLM (the legacy seed quirk) — their `llm_id` is not stored anywhere in the codebase. Rather than hard-coding it into SQL, we read it lazily from the Retell API on first edit. This is safe: the Retell API is the source of truth for `llm_id`, and the lazy read is idempotent (if it fails, the next edit retries it).

**Alternative considered:** One-time backfill script that calls Retell for all rows. Rejected — adds operational complexity and a separate execution step. Lazy backfill is transparent to the operator.

### 5. promptFooter.ts utility

**Decision:** New `src/lib/promptFooter.ts` exports:
- `appendFooter(body: string): string` — trims body, appends two newlines + `PROMPT_FOOTER_TEMPLATE`.
- `stripFooter(prompt: string): string` — removes the `PROMPT_FOOTER_TEMPLATE` suffix (whitespace-normalized) from the full prompt, returning only the user-authored body.

The existing inline footer-append in `src/app/api/interviewers/route.ts:109-115` is replaced with `appendFooter`. The edit modal's prompt prefill uses `stripFooter` to show only the body portion to the user (the footer is shown read-only below, as in the create modal).

**Rationale:** Without a shared utility, `stripFooter` would need to be duplicated or inlined in the edit modal, and the append logic would continue to live ad-hoc in the route. Centralizing both functions removes the duplication and gives the footer logic a single, testable home.

### 6. Shared sub-component extraction

**Decision:** Extract from `CreateInterviewerModal.tsx` lines 53–152:
- `TraitSlider.tsx` — a labeled range slider for a single trait (empathy, rapport, exploration, speed).
- `Fieldset.tsx` — a labeled form field wrapper with error state.
- `AvatarGrid.tsx` — the 4×2 thumbnail grid for avatar selection.

Extraction location: `src/components/dashboard/interviewer/shared/`.

Both `CreateInterviewerModal` and `EditInterviewerModal` import from there. No external API change — this is an internal refactor of `CreateInterviewerModal` coincident with adding `EditInterviewerModal`.

**Rationale:** Without extraction, `EditInterviewerModal` would either copy the sub-component code (duplication) or import from inside `CreateInterviewerModal` (coupling). Extraction is the clean pattern and matches the project's existing colocation convention.

### 7. Edit trigger placement on InterviewerCard

**Decision:** An edit (pencil) icon button is added adjacent to the existing delete trigger at `InterviewerCard.tsx:78`. It uses the same hover-reveal pattern as the trash icon (`opacity-0 group-hover:opacity-100`). Edit icon is to the left of the delete icon at `right-14 top-4`. Clicking opens `EditInterviewerModal` pre-filled with the card's interviewer. `e.stopPropagation()` is applied so the details modal does not open.

**Rationale:** Consistent with the established hover-reveal delete pattern. Side-by-side placement (edit left, delete right) follows the universal convention for destructive-vs-non-destructive action ordering.

### 7a. Edit entry point in the details modal

**Decision:** The read-only `InterviewerDetailsModal` gains an "Edit persona" button in its footer. Clicking it closes the details modal and opens `EditInterviewerModal` pre-filled with the same interviewer. The button is styled as a ghost/secondary action alongside any existing footer content; it does not replace the copy-prompt action.

**Rationale:** Without this, a user who opens the details view to inspect a persona has no direct path to editing — they must close the modal and find the hover-only pencil icon. That is poor discoverability, especially on touch devices where hover states are unavailable. The details modal and the edit modal solve complementary needs (inspect vs. mutate); a direct bridge between them completes the flow. The `InterviewerCard` manages both modal states already (`detailsOpen`, `deleteOpen`), so adding `editOpen` follows the same local state pattern with no new infrastructure.

### 7b. Unsaved-changes behavior in the edit modal

**Decision:** No confirm-on-close dialog is shown when the user dismisses the edit modal with unsaved changes. The modal's form state is reset on close (same pattern as `CreateInterviewerModal.reset()`). If the modal is open and `isSubmitting` is true, close is blocked entirely (same as the create modal via `closeOnOutsideClick={!isSubmitting}` and the early-return guard in `handleClose`).

**Rationale:** The pre-filled defaults are always recoverable (re-opening the modal re-hydrates from the live interviewer row). A confirm dialog adds friction for the common case (user accidentally clicks outside while reading). The `isSubmitting` block already prevents accidental close during the slow Retell roundtrip, which is the highest-stakes moment. Adding a confirm dialog is deferred as a future polish item if user research shows it matters.

### 7c. Edit modal submit button label

**Decision:** The submit button label is "Save changes" (loading state: spinner + "Saving..."). The cancel button label is "Cancel". The modal title is "Edit interviewer persona".

**Rationale:** Distinct labels differentiate create vs. edit intent and avoid the wrong affordance text being read aloud by screen readers.

### 7d. Prompt textarea sizing in edit modal

**Decision:** The prompt body textarea in `EditInterviewerModal` uses a dynamic initial row count: `rows={Math.min(18, Math.max(10, stripFooter(interviewer.prompt).split("\n").length + 2))}`. Minimum 10 rows; maximum 18. The `min-h-[220px]` constraint from `CreateInterviewerModal` is relaxed — instead, `min-h-[240px]` is used to accommodate the typical prompt body length of seeded personas.

**Rationale:** The create modal uses a fixed `rows={10}` because the textarea starts empty. For edit, the prompt body is pre-filled with potentially long content (the seed interviewers have 200–400 word prompts). A fixed `rows={10}` would require immediate scrolling. Dynamic sizing based on newline count (capped at 18) fits the content into view for most cases without an unbounded modal.

### 7e. Error message differentiation

**Decision:** The edit modal error banner distinguishes two failure classes:
- **Retell rejection (any Retell PATCH 4xx/5xx):** "This change was rejected — your interviewer is unchanged. Check your input and try again."
- **DB write failure after Retell success:** "Your changes were applied to the AI model but could not be saved to the record. Saving again should fix it."
- **Validation failure (422):** Use the server's `error` field directly (same as create modal).

The API returns 500 for both Retell and DB failures. To differentiate, the PATCH handler includes a `type` field in the 500 error body: `{ error: "...", type: "retell_failure" | "db_failure" }`. The modal reads `body.type` to select the appropriate message.

**Rationale:** Both failures present as 500 but have very different user implications. A Retell rejection means nothing changed and the user should revise their input. A DB failure means Retell was updated and a retry will reconverge — a generic "something went wrong" is misleading because the change *did* partially land. Honest, specific copy reduces confusion and reduces support burden.

### 8. Validation on PATCH: partial, same guards as POST

**Decision:** All fields in the PATCH body are optional. Only fields present in the body are validated. Empty body (no recognized fields) returns 400. For any present field:
- `name`, `description`, `image`, `voice_id`: `isNonEmptyString` guard.
- `empathy`, `rapport`, `exploration`, `speed`: number in range 1–10.
- `prompt`: if present, must be a non-empty string. The route calls `appendFooter` internally; the client sends only the body portion (no footer in the PATCH body). The assembled full prompt is validated for footer presence using the same `normalizeWhitespace` + `.includes(PROMPT_FOOTER_TEMPLATE)` check as POST.

**Alternative considered:** Require all fields on every PATCH (PUT semantics). Rejected — forces the client to re-send fields it doesn't intend to change, increasing the attack surface for accidental overwrites.

**`retell_llm_id` is not a client-facing field.** The PATCH handler MUST NOT accept `retell_llm_id` in the request body. If a client sends it, it is silently ignored (not validated, not written). The field is internal — always resolved via lazy backfill from Retell, never from client input. No validation error is needed; omitting it from the recognized field set is sufficient.

### 9. Auth posture

Same as POST/DELETE — authenticated route via the project's existing session middleware. No middleware auth-bypass added. Unauthenticated requests return 401.

## Risks / Trade-offs

- **Transient Retell/DB drift on DB write failure** → After a successful Retell PATCH, if the DB update fails, Retell reflects the new state but the DB does not. The next edit will re-apply the same Retell values (idempotent), so the drift self-heals on next edit. Surfaced as a 500 to the client. Accepted same-posture as the create/delete MVP.
- **Lisa/Bob shared LLM** → If an operator edits Lisa's prompt, the Retell LLM update will also affect Bob (they share one LLM object). This is a pre-existing legacy quirk inherited from the seed route and is not changed by this PR. A future change can provision separate LLMs for Lisa and Bob. Document this as a known limitation in the PATCH route's code comment.
- **Retell `response_engine.type !== 'retell-llm'`** → The lazy backfill returns 500 with a clear message. This should be impossible for CRUD-provisioned interviewers (which always get a retell-llm), but could occur for seed-route interviewers provisioned differently. Documented and surfaced loudly rather than silently skipped.
- **retell_llm_id column NULL for all existing rows** → Every existing interviewer will trigger the lazy backfill on its first edit. This adds one Retell API call (agent retrieve) to the first edit latency. Acceptable — happens once per interviewer and is transparent to the operator.
- **Prompt body extraction in the edit modal** → `stripFooter` must handle edge cases where the stored prompt was saved before the footer-validation rule existed (pre-CRUD-MVP rows). If the footer is not found in the stored prompt, `stripFooter` returns the full prompt string unchanged. The edit modal still renders correctly — the user sees the full prompt in the body textarea and the read-only footer below. On submit, `appendFooter` appends the footer again, and the PATCH validation catches any pre-existing footer-shape issues. This is acceptable.

## Migration Plan

### Schema change

Single statement (no backfill):

```sql
ALTER TABLE interviewer ADD COLUMN retell_llm_id TEXT NULL;
```

Safe to run on a live database. The column is nullable; no existing code references it before the code deploy. No rollback script needed — dropping the column (`ALTER TABLE interviewer DROP COLUMN retell_llm_id`) is safe if applied before any edit operations persist data to it.

### Deployment order

1. Run the migration SQL (add `retell_llm_id` column).
2. Deploy the code changes.

No in-flight request is affected by the column addition (the column is not read or written by any existing route until the code deploy lands).

### Post-deploy verification

- Open the interviewers dashboard; confirm the edit (pencil) icon appears on hover.
- Edit one interviewer's name → confirm the Retell agent name updates (observable via Retell dashboard).
- Edit one interviewer's prompt body → confirm the Retell LLM `general_prompt` updates.
- Edit one interviewer's avatar only → confirm the request completes without any Retell API calls (observable in server logs).
- Confirm `retell_llm_id` is populated in the DB row after the first edit.

## Open Questions

All major decisions are resolved in brainstorming and design review and locked above. No open questions remain for the apply step.

Design review additions (now locked):
- Edit entry point in the details modal (decision 7a) — "Edit persona" button in details modal footer
- Unsaved-changes behavior (decision 7b) — no confirm dialog; block close during save only
- Submit button label (decision 7c) — "Save changes" / "Saving..." / modal title "Edit interviewer persona"
- Prompt textarea sizing (decision 7d) — dynamic rows (10–18) with min-h-[240px]
- Error message differentiation (decision 7e) — type field on 500 body; distinct copy for retell_failure vs db_failure
