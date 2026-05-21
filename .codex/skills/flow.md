---
name: flow
description: Walk a change request through a consistent OpenSpec-backed pipeline. Use for any non-trivial change — bugs, features, refactors. The skill announces the planned shape, lets the user skip or expand steps, and delegates to OpenSpec, installed review skills, and code-context-analysis. Does NOT enforce, classify into tracks, or run silently — every invocation prints the plan and waits for confirmation.
---

# Flow — Change Pipeline Orchestrator

## What this skill does

`/flow` is a single orchestrator that walks a change request through the same ordered pipeline every time, scaling depth (not shape) to the size of the work. It does **not** classify into tracks, does **not** enforce gates, and does **not** run silently. On every invocation it announces the planned shape, takes the user's edits, and proceeds.

The canonical pipeline (depth scales per change):

```
brainstorming → cgc → propose → plan_eng_review → plan_design_review →
apply → qa → review → ship → archive
```

Steps not enabled in `.codex/flow.yaml` are skipped by default. The user can force any step inline at the announcement gate.

## Non-goals

- **No classification.** Same shape for typos and platform rewrites. Depth varies, not order.
- **No enforcement.** Skill announces and confirms; it never blocks tool calls, commits, or merges.
- **No silent routing.** Every invocation prints the plan before doing anything.
- **No reimplementation.** Delegates to OpenSpec (`source-command-opsx-*`), installed review skills in `~/.agents/skills/`, and code-context-analysis. Reads their files and follows them in-session.

## When to invoke

- User describes a change request in plain English ("fix the hero copy," "add a webhook for X," "rebuild positioning").
- User explicitly types `/flow <request>` or invokes this skill.

> **Note on examples:** Concrete examples in this skill (request phrases, change names, scope paths) reference whatever is configured in the active project's `.codex/flow.yaml`. When you copy this skill to a new repo, those examples will read against your new `flow.yaml` keys, not these.

## When NOT to invoke

- User is asking a question or seeking a recommendation. Answer directly.
- User explicitly requests a single tool (e.g., "just run /qa") — honor that.
- The skill is already running on a change. Resume from state instead of restarting.

---

## Step 0 — ClickUp ingestion (when applicable)

Run before anything else. If the request contains no ClickUp URL, skip this section entirely and proceed to Step 1. ClickUp ingestion is invisible to operators who never paste ClickUp URLs.

### Step 0.1 — URL detection

Scan the request string for the regex:

```
https?://app\.clickup\.com/(?:[^/\s]+/(?:v/li/[^/\s]+/)?)?t/([A-Za-z0-9_-]+)(?:\?[^\s#]*)?(?:#[^\s]*)?
```

Captures all three common ClickUp URL formats. Capture group 1 is the task ID. The two trailing non-capturing groups consume optional query strings and fragments so they do not bleed into the captured ID or the operator notes.

- **No URL found** → skip Step 0 entirely, proceed to Step 1.
- **Multiple URLs found** (anywhere in the request, including what would otherwise become operator notes) → hard fail: *"Multiple ClickUp URLs detected. `/flow` runs one change at a time — invoke separately for each task."*

**Deliberate edge case:** A second ClickUp URL pasted as a reference (e.g., "see also https://app.clickup.com/t/abc123") triggers the multi-URL hard fail. To reference a related task without triggering this, use the ID alone (e.g., "see also DEV-1234"). This is intentional — alternative behaviors are fragile and surprising.

### Step 0.2 — Config gate

Read `flow.yaml.integrations.clickup.enabled` (default `false` if unset).

If `false` → hard fail: *"ClickUp URL detected but `integrations.clickup.enabled: false` in flow.yaml. Set it to `true` or invoke with a plain-text request."*

### Step 0.3 — Tool availability check

Verify the `clickup_get_task` MCP tool is available in the current session.

If not available → hard fail: *"ClickUp URL detected but `clickup_get_task` tool isn't connected. Connect the ClickUp MCP server, or invoke `/flow` with a plain-text request."*

### Step 0.4 — Fetch

Call `clickup_get_task(taskId=<id>)` and `clickup_get_task_comments(taskId=<id>)` in parallel (single message with two tool calls).

On any error from either call → hard fail: *"ClickUp fetch failed: `<verbatim error>`. Verify the task ID is correct and you have access, then re-invoke."*

If one call succeeds and the other errors, discard the successful call's data and hard-fail. No partial state. An empty comments list is **not** an error — it just means the Comments section in the canonical request format / artifact is omitted (per the section-omission rules below).

### Step 0.5 — Operator notes extraction

Strip the matched URL (including any consumed query string and fragment) from the request string. Trim leading/trailing whitespace from the remainder. The trimmed remainder is the operator notes string. Empty string is allowed.

### Step 0.6 — Conversation state

Set in-session state for use by later steps (treat these as variables persisted in conversation, not files):

- `clickupSourced = true`
- `clickupTaskId = <task id from regex capture group 1>`
- `clickupTaskUrl = <original URL, including any query/fragment>`
- `clickupCustomId = <custom_id from API response, or empty string if absent>`
- `clickupTaskTitle = <name field from clickup_get_task>`
- `clickupTaskStatus = <status.status field from clickup_get_task>`
- `clickupDescription = <description field from clickup_get_task>`
- `clickupCustomFields = <list of {name, value} pairs from custom_fields, filtered to non-empty values>` — for structured field types (dropdown, date, user, etc.), use the API's display value (`value` subfield) when present; otherwise stringify the raw value with `String()` semantics. Skip fields where the resulting string is empty or whitespace-only.
- `clickupComments = <list of {author, date, body} from clickup_get_task_comments, sorted chronologically oldest-first>`
- `clickupFetchedAt = <ISO 8601 UTC timestamp of the fetch>`
- `operatorNotes = <text from Step 0.5>`

### Step 0.7 — Continue

Proceed to Step 1. Step 2's existing resume-detection logic now has access to the derived change name (see "Change-name derivation" subsection below) and uses it as the lookup key for resume detection.

**Handoff contract:** When `clickupSourced` is true, Step 2 MUST use the change name produced by the "Change-name derivation" subsection as the lookup key for the existing `openspec/changes/<name>/` resume check — not the raw URL string. Without this handoff, Step 2 would never find an existing folder and would treat every ClickUp invocation as new.

### Canonical request format

When `clickupSourced` is true, the request string passed to all downstream steps (brainstorming, cgc, propose, plan reviews, apply, etc.) is constructed as:

```
# <clickupTaskTitle>

**ClickUp:** <clickupTaskUrl>
**Status:** <clickupTaskStatus>

## Description

<clickupDescription>

## Acceptance Criteria & Custom Fields

- **<field name>:** <value>
- **<field name>:** <value>

## Comments

**<author> — <ISO date>:**
<comment body>

**<author> — <ISO date>:**
<comment body>

## Operator Notes

<operatorNotes text>
```

**Section omission rules** (apply identically here and in `clickup-context.md`):

- **Acceptance Criteria & Custom Fields** — header and body omitted entirely if `clickupCustomFields` is empty.
- **Comments** — header and body omitted entirely if `clickupComments` is empty.
- **Operator Notes** — header and body omitted entirely if `operatorNotes` is an empty string after trimming.

Never emit empty section headers in either the canonical request string or the persisted artifact.

### Change-name derivation

When `clickupSourced` is true, the change name (which becomes the `openspec/changes/<name>/` folder name and shows up in commits, PR titles, and the archive folder) is derived as follows. This replaces Step 2's default kebab-case derivation for ClickUp-sourced runs.

**ID component:**

- If `clickupCustomId` is non-empty (e.g., `"DEV-1234"`), use it lowercased and kebab-cased: `dev-1234`.
- Otherwise, use `clickupTaskId` raw, lowercased: `86a1zk2x4`.

**Title component:**

1. Lowercase `clickupTaskTitle`.
2. Replace runs of non-alphanumeric characters with single hyphens.
3. Strip leading and trailing hyphens.
4. Truncate to 50 characters; if truncation falls inside a word, back up to the previous hyphen.

**Combination:** `<title-kebab>-<id-component>`.

Examples:

- Title `"Add user authentication"`, task ID `86a1zk2x4`, no custom_id → `add-user-authentication-86a1zk2x4`
- Title `"Fix: hero copy isn't centered (mobile)"`, custom_id `"MARK-42"` → `fix-hero-copy-isnt-centered-mobile-mark-42`
- Title `"Implement comprehensive observability across the marketing site"` (>50 chars), no custom_id → `implement-comprehensive-observability-across-86a1zk2x4`

**Collision handling:**

Before `propose` runs (Step 8), check whether `openspec/changes/<derived-name>/` already exists.

- If it does **and** the existing folder's `.flow-state.json` has a matching `clickupTaskId` → treat as resume (see Step 2 + the Resume behavior section under Failure modes).
- If it does **and** the existing folder is unrelated (different `clickupTaskId` or no ClickUp metadata) → append `-2`, `-3`, etc. until the path is free.

**Operator override:** Unchanged from existing flow — the `rename to <new-name>` modification at the announcement gate (Step 6) still works. ClickUp-derived names are defaults, not mandates.

---

## Step 1 — Load configuration

Read `.codex/flow.yaml`. If absent, use built-in defaults (pipeline as listed above, all `tools` true, empty `cgc_keyword_map`, empty `bypass.typo_patterns`) and announce that defaults are being used. Offer to write a starter `flow.yaml` once the user confirms it's wanted.

If `.codex/flow.local.yaml` exists, overlay it on top of `flow.yaml` via deep merge (per-key override; nested keys merged, arrays replaced, not concatenated). Announce when local overrides change a pipeline step, tool flag, or step model/dispatch (e.g., "`steps.qa.model: gpt-5.5` from local overrides — qa will run on `gpt-5.5` instead of the default `gpt-5.2`").

If a key referenced later in this skill is missing from both files, apply the documented default for that key and note in the announcement that the default fired.

## Step 2 — Determine change context

**ClickUp handoff:** If `clickupSourced` is true (set by Step 0), use the change name produced by the "Change-name derivation" subsection of Step 0 as the lookup key throughout this step — not the raw request string. The rest of Step 2's logic is unchanged.

Decide whether this invocation is **resuming** or **new**.

**Resuming** if:
- The current branch already has an OpenSpec change folder at `openspec/changes/<name>/` matching the user's request, **and**
- That folder contains `.flow-state.json`.

**New** otherwise.

If resuming:
1. Read `openspec/changes/<name>/.flow-state.json`.
2. Run `openspec status --change <name> --json` immediately.
3. If status disagrees with state (e.g., status says `apply` is done but state says `currentPhase: apply`), update `.flow-state.json` to match disk reality before continuing. Always trust `openspec status` over the state file.
4. Announce: "Resuming `<name>` from phase `<next-pending-phase>`."

If new:
1. Derive a kebab-case change name from the request (e.g., "fix the hero copy" → `fix-hero-copy`).
2. Do not create the change folder yet — that happens at the `propose` step, after the user confirms the shape.

## Step 3 — Check for bypass paths

Before announcing the standard pipeline, decide whether to offer a bypass.

**ClickUp-sourced runs skip the typo bypass entirely.** If `clickupSourced` is true (set by Step 0), proceed directly past the "Typo bypass" subsection to "Multi-capability split." ClickUp-attached changes are tracked work and always deserve a `proposal.md` and archive entry referencing the source ticket — the small overhead of one auto-generated proposal is worth the audit trail.

### Typo bypass

Offer to skip OpenSpec entirely if **any** of:
- Request matches a phrase in `flow.yaml.bypass.typo_patterns`.
- Request length is under ~80 characters **and** contains words like `typo`, `copy`, `wording`, `tweak`, `rename`.
- Request explicitly names one file and proposes a one-line edit.

If offering, ask the user directly:

> "This looks like a one-line edit. Skip OpenSpec and edit directly? You'll lose the audit trail (no `proposal.md` / `archive/<date>`), but commit history still records the change."

Options: A) Yes, edit directly. B) No, run the full pipeline.

If A: skip to direct edit. Do not create a change folder, do not call /opsx. The user makes the edit and commits normally.

If B: continue to step 4.

### Multi-capability split

Offer to split into multiple changes if **any** of:
- Request references two or more existing `openspec/specs/<capability>/` folders.
- Request describes multiple distinct concerns ("rebuild positioning AND add a new lead magnet AND fix the scanner").

If detected, propose a split as an ordered list of changes, e.g.:

> "This looks like multiple capabilities. Proposed split:
> 1. `rebuild-positioning` — touches `marketing-hero`, `marketing-copy`
> 2. `add-finance-lead-magnet` — new capability
> 3. `fix-scanner-loader` — touches `vibe-code-scanner`
>
> Run each through `/flow` separately, in this order?"

Options: A) Accept split. B) Treat as one change anyway.

If A: stop. Do not create any change folder. Tell the user to invoke `/flow <first-name>` when ready.

If B: continue to step 4.

## Step 4 — Determine tool availability + resolve model/dispatch

For each pipeline step in `flow.yaml.pipeline`, decide whether to include it in the announced shape. A step is **included** when:

1. It is listed in `pipeline:`, AND
2. The corresponding `tools.*` flag is true (default true if unset), AND
3. The file-existence check succeeds.

File-existence checks:

| Step | Check |
|---|---|
| `brainstorming` | `~/.agents/skills/office-hours/SKILL.md` exists |
| `cgc` | `~/.agents/skills/code-context-analysis/SKILL.md` exists |
| `propose` | `.agents/skills/source-command-opsx-propose/SKILL.md` exists |
| `apply` | `.agents/skills/source-command-opsx-apply/SKILL.md` exists |
| `archive` | `.agents/skills/source-command-opsx-archive/SKILL.md` exists |
| `plan_eng_review` | `~/.agents/skills/plan-eng-review/SKILL.md` exists |
| `plan_design_review` | `~/.agents/skills/plan-design-review/SKILL.md` exists |
| `qa` | `~/.agents/skills/qa/SKILL.md` exists |
| `review` | `~/.agents/skills/review/SKILL.md` exists |
| `ship` | `~/.agents/skills/ship/SKILL.md` exists |

A step that fails any check is labeled:
- `SKIPPED-not-installed` if the file/command is missing
- `SKIPPED-by-config` if `tools.<name>: false` in config

For each INCLUDED step, also resolve its **model** (`gpt-5.2` | `gpt-5.4` | `gpt-5.5`) and **dispatch mode** (`subagent` | `main`) from `flow.yaml.steps.<step-name>`. If a step has no entry in `steps:`, default to `model: gpt-5.4, dispatch: main` and surface a warning in the announcement. These two attributes drive Step 8's execution behavior.

## Step 5 — Announce the planned shape

Print the plan as a numbered list. Each step labeled with one of:

- `INCLUDED` — will run by default
- `SKIPPED-by-config` — present in pipeline but disabled via `tools.*`
- `SKIPPED-not-installed` — present in pipeline but tool missing
- `OPTIONAL-not-default` — not in `pipeline:` but available; user can force inline

Each INCLUDED step also shows its `(model, dispatch)` resolved from `flow.yaml.steps`. Format: `(<model>, <dispatch>)` where `dispatch` is `subagent` or `main`. This is what tells the operator how expensive the run will be and which steps will pollute the main conversation context.

Example announcement:

```
Plan for `fix-hero-copy`:
  1. brainstorming       INCLUDED  (gpt-5.4, subagent)       office-hours
  2. cgc                 INCLUDED  (gpt-5.2, subagent)       scope: src/app/(client)/dashboard/, rule: keyword-map:dashboard
  3. propose             INCLUDED  (gpt-5.4, subagent)       source-command-opsx-propose
  4. plan_eng_review     INCLUDED  (gpt-5.2, subagent)       plan-eng-review
  5. plan_design_review  INCLUDED  (gpt-5.2, subagent)       plan-design-review
  6. apply               INCLUDED  (gpt-5.5, main)           source-command-opsx-apply
  7. qa                  INCLUDED  (gpt-5.2, subagent)       qa
  8. review              INCLUDED  (gpt-5.2, subagent)       review
  9. ship                INCLUDED  (gpt-5.2, subagent)       ship
 10. archive             INCLUDED  (gpt-5.2, main)           source-command-opsx-archive
```

If resuming, prefix each completed step with `✓ DONE` and start execution at the first non-DONE INCLUDED step.

## Step 6 — Confirm or modify

Ask the user directly:

> Proceed with this shape, modify it, or abort?

Options:
- A) Proceed
- B) Modify (then accept modifications via free-form chat)
- C) Abort

Modifications accept these forms:
- `skip <step>` — flip an INCLUDED step to SKIPPED-by-user
- `add <step>` — flip an OPTIONAL or SKIPPED-by-config step to INCLUDED
- `scope cgc to <paths>` — override the cgc scope inference
- `rename to <new-name>` — change the kebab-case name before propose creates the folder
- `model <step> <gpt-5.2|gpt-5.4|gpt-5.5>` — override the resolved model for one step (e.g., `model qa gpt-5.5` to escalate a tricky test loop)
- `dispatch <step> <subagent|main>` — override the resolved dispatch mode for one step (e.g., `dispatch cgc main` to keep the analysis in main context for follow-up questions)

After applying modifications, re-print the updated shape and re-ask for confirmation.

Record the agreed shape into `agreedOptionalSteps` in `.flow-state.json` (the file is created when `propose` runs — until then, the agreed shape lives in conversation context).

## Step 7 — Resolve CGC scope (only if `cgc` is INCLUDED)

Use the 3-step heuristic:

1. **Explicit paths.** If the user's request contains file paths, route paths, or directory paths, use those as the scope. Announce: `cgc scope: <paths> (rule: explicit-paths)`.
2. **Keyword map.** Otherwise scan the request for any keyword present in `flow.yaml.cgc_keyword_map`. First match wins. Announce: `cgc scope: <mapped paths> (rule: keyword-map:<keyword>)`.
3. **Fallback.** If neither yields a scope, announce: `cgc scope: <repo root> (rule: fallback)` and ask the user to confirm or replace before running.

User can override inline with `scope cgc to <paths>` at the confirmation gate (step 6) or after the scope is announced.

## Step 8 — Execute the pipeline

For each INCLUDED step in announced order:

1. Announce: `→ Step <N>: <name> (running, <model>, <dispatch>)`.
2. Read the underlying file (see file-existence table above) — needed for both dispatch modes (the file path goes into the subagent prompt, or is followed inline).
3. **Dispatch.** Behavior diverges based on the resolved `dispatch` mode:
   - **`main`** — Execute the underlying skill's instructions inline in this conversation. The /flow skill is the active agent. State (decisions, intermediate reasoning) accumulates in the main conversation. Used for steps that mutate code/state and need the full context to follow up (`apply`, `archive`).
   - **`subagent`** — Dispatch via `spawn_agent` with `model: <resolved-model>` and a self-contained prompt that (a) names the underlying skill file to follow, (b) lists the artifact paths the subagent must read (`clickup-context.md`, `proposal.md`, `design.md`, `tasks.md` — whichever exist in the change folder), (c) names the change folder and current phase, (d) specifies the verdict format the subagent must return (see "Subagent contract" below). The subagent runs in isolated context and returns a single structured message. /flow consumes that message; the subagent's verbose intermediate reasoning never enters the main conversation.
4. On success, update `.flow-state.json`: bump `currentPhase` to the next step, refresh `lastUpdated` (ISO 8601 UTC), append the completed step to `completedGates`. **If `clickupSourced` is true and this is the `propose` step**, also (a) write `openspec/changes/<change-name>/clickup-context.md` from the canonical request format (see Step 0) with a YAML frontmatter header (see "ClickUp artifact" subsection below), and (b) include the three ClickUp keys (`clickupSourced`, `clickupTaskId`, `clickupTaskUrl`) when writing `.flow-state.json` for this and all subsequent phase bumps.
5. Before writing `.flow-state.json`, re-read it from disk. If `lastUpdated` or `currentPhase` differs from what was loaded at step 2 of this skill, pause and surface to the user: "Another session may be running on this change. Reload and continue, or abort?" Proceed only on confirmation.
6. On failure (delegated skill returns BLOCKED / NEEDS_CONTEXT / error, OR subagent returns an error verdict), surface the failure to the user verbatim, leave state unchanged, and pause. Do not auto-retry. Do not auto-fall back from subagent to main — the operator decides whether to re-dispatch with a different model/mode via the announcement-gate modifications.

### Subagent contract

Every step dispatched as `subagent` follows the same contract.

**Prompt template** (the /flow skill builds this and passes it to `spawn_agent`):

```
You are executing the `<step-name>` step of the /flow pipeline.

**Change:** <change-name>
**Phase:** <current-phase>
**Underlying skill:** <absolute path to the skill file from Step 4's table>

**Artifacts to read** (only those that exist for the current phase):
- openspec/changes/<change-name>/clickup-context.md  (read first if present — it's the source ticket)
- openspec/changes/<change-name>/proposal.md
- openspec/changes/<change-name>/design.md
- openspec/changes/<change-name>/tasks.md
- openspec/changes/<change-name>/.flow-state.json

**Your job:**
1. Read the underlying skill file and follow its instructions exactly.
2. Read the listed artifacts (skip ones that don't exist).
3. Execute the step.
4. Return a single structured message in the verdict format below.

**Verdict format:**

## Status
APPROVED | NEEDS_FOLLOW_UP | BLOCKED

## Summary
2-4 sentences describing what you did and what the operator most needs to know.

## Open questions for the operator
(Only if status is NEEDS_FOLLOW_UP. Empty otherwise.)
- Question 1
- Question 2

## Artifacts written or modified
- path/to/file (created | updated | unchanged)

## Recommended next action
One sentence. Usually "Proceed to the next pipeline step" — but if status is NEEDS_FOLLOW_UP or BLOCKED, name what should happen instead.

Do not include your intermediate reasoning, file dumps, or analysis steps in the verdict — those stay in your context and die when this dispatch ends.
```

**What /flow does with the verdict:**

- `APPROVED` → mark step complete, advance to next phase.
- `NEEDS_FOLLOW_UP` → present the open questions to the operator by asking directly. Operator answers. /flow re-dispatches the same step as a fresh subagent with the answers appended to the prompt under "**Operator follow-ups:**". Repeat until APPROVED, BLOCKED, or operator aborts. Max 3 follow-up rounds before auto-escalating to "Abort or proceed without resolution?"
- `BLOCKED` → surface the BLOCKED verdict to the operator verbatim. Do not advance. Operator decides whether to re-dispatch (possibly with `model <step> gpt-5.5` to escalate), skip the step, or abort.

### Interactive steps (brainstorming, plan reviews) in subagent mode

Steps like `brainstorming`, `plan_eng_review`, and `plan_design_review` are interactive by nature — the underlying skills ask the operator clarifying questions. Subagent dispatch can't ask the operator directly (subagents return a single message), so the contract handles this via the `NEEDS_FOLLOW_UP` status:

- The subagent does its own reading/analysis, identifies the open questions, and returns them as a batch in the verdict.
- /flow asks the operator each question in sequence.
- /flow re-dispatches the subagent with the answers in "Operator follow-ups."
- Loop until the subagent returns APPROVED.

This means an interactive subagent step takes 2-4 round-trips instead of one. The cost trade-off vs. running these in `main` mode is real: subagent isolation keeps the verbose discovery work out of the main context, at the cost of more orchestration. Override per-invocation with `dispatch <step> main` at the announcement gate if you'd rather have the conversation directly.

### Step-specific prompt additions

Some steps need extra responsibilities layered on top of the standard subagent contract. /flow appends a step-specific addendum to the standard prompt template before dispatching. Today there is one such addendum:

#### `review` — requirements verification

The `review` step's job today (per the underlying `gstack:review` skill) is structural diff review: SQL safety, LLM trust boundary violations, conditional side effects, etc. /flow extends it with an explicit **requirements-verification responsibility**: confirm the diff actually implements what was originally requested, including any decisions resolved during brainstorming and the plan reviews.

The addendum (appended after "Your job:" in the standard prompt template):

```
**Additional responsibility — requirements verification:**

Before producing the standard structural-review verdict, also verify the implementation against the original ask. Read in this order:

1. `openspec/changes/<change-name>/clickup-context.md` (if it exists — this is the frozen ticket as fetched at propose time, including the original description, custom fields, comments, and operator notes)
2. `openspec/changes/<change-name>/proposal.md` (the refined ask after brainstorming and propose; resolved decisions from brainstorming follow-up rounds are encoded here)
3. `openspec/changes/<change-name>/design.md` (architecture decisions, including those locked in by plan_eng_review)
4. `openspec/changes/<change-name>/tasks.md` (the implementation contract; what we said we'd do)
5. `git diff <base-branch>..HEAD` for the change branch (what we actually did)

For each requirement, acceptance criterion, and explicit task in the artifacts above, classify the implementation as one of:

- `SATISFIED` — the diff clearly delivers this
- `PARTIAL` — partially delivered; specify what's missing
- `MISSED` — required but absent from the diff
- `OUT_OF_SCOPE` — explicitly deferred, or beyond the change's stated scope

Include a "## Requirements verification" section in the verdict with:

- A bullet per requirement with its classification and one-sentence rationale
- The base branch you diffed against (so the operator can verify you compared the right scope)

Drift outcomes:

- All requirements `SATISFIED` (and standard structural review passes) → status `APPROVED`
- One or more `PARTIAL` or `MISSED` items, **and** they are recoverable in scope → status `NEEDS_FOLLOW_UP` with specific drift items as questions ("`<item>` is MISSED — should this be added before ship, or deferred to a follow-up change?")
- A core requirement is `MISSED` and recovery would expand scope substantially → status `BLOCKED` with the specific gap and a recommendation (e.g., re-open `propose` to amend tasks.md, or split into a follow-up change)

If `clickup-context.md` is absent (non-ClickUp-sourced flow), use `proposal.md` as the source-of-truth for the original ask. Do not fail just because there's no ClickUp artifact.
```

This is layered on at /flow's dispatch time, not embedded in the underlying `gstack:review` skill — that skill stays unchanged and reusable. Other steps that need similar layered responsibilities in the future would get their own subsection here.

### State file schema

`.flow-state.json` shape (non-ClickUp run):

```json
{
  "changeName": "fix-hero-copy",
  "currentPhase": "apply",
  "agreedOptionalSteps": ["cgc", "plan_eng_review"],
  "skippedSteps": ["plan_design_review"],
  "completedGates": ["brainstorming", "cgc", "propose", "plan_eng_review"],
  "lastUpdated": "2026-05-12T14:23:01Z"
}
```

For ClickUp-sourced runs (`clickupSourced` true), three additional top-level keys are written:

```json
{
  "changeName": "add-user-authentication-86a1zk2x4",
  "currentPhase": "apply",
  "agreedOptionalSteps": ["cgc", "plan_eng_review"],
  "skippedSteps": ["plan_design_review"],
  "completedGates": ["brainstorming", "cgc", "propose"],
  "lastUpdated": "2026-05-12T14:23:01Z",
  "clickupSourced": true,
  "clickupTaskId": "86a1zk2x4",
  "clickupTaskUrl": "https://app.clickup.com/t/86a1zk2x4"
}
```

When `clickupSourced` is false (or absent — treat absence as false), the three additional keys are omitted entirely. Existing non-ClickUp `/flow` runs produce identical state files to before this change.

The collision-handling logic in Step 0's "Change-name derivation" uses `clickupTaskId` from this extended schema to distinguish "resume same ClickUp-sourced change" from "name collision with unrelated change."

The file is **committed to git**. It lives at `openspec/changes/<change-name>/.flow-state.json` alongside the OpenSpec artifacts.

### ClickUp artifact

When `clickupSourced` is true, after the `propose` step creates the change folder, write `openspec/changes/<change-name>/clickup-context.md` containing:

```
---
clickup_task_id: <id>
clickup_task_url: <url>
clickup_custom_id: <custom_id>           # omit this line entirely if custom_id is empty
clickup_status: <status name>
fetched_at: <ISO 8601 UTC timestamp from Step 0.6>
---

<canonical request format string from Step 0>
```

Section omission rules from the Canonical Request Format subsection apply identically — never emit empty section headers.

The artifact is committed to git as part of the change folder and survives into `openspec/changes/archive/<date>-<name>/` when the change is archived.

**Refresh policy:** Written once at `propose` time. Not re-fetched within a single flow run, even if the underlying ClickUp task changes mid-run. To pick up new ClickUp content, the operator re-invokes `/flow <same-url>`; the resume path detects the existing folder and prompts (see Failure modes & recovery → Resume behavior for ClickUp-sourced flows).

### Reconciliation rule

On every invocation, before announcing anything, run `openspec status --change <name> --json`. If `applyRequires` indicates artifacts the state file thinks are incomplete (or vice versa), trust the openspec output and rewrite `.flow-state.json` to match. The state file is advisory; OpenSpec is authoritative for artifact existence.

### ClickUp wrap-up (hard rule, runs after `archive` for ClickUp-sourced runs)

When `clickupSourced` is true, after the `archive` step's commits land locally and **before** announcing the push gate, run the ClickUp wrap-up:

1. **Set the task status to `review`** via `clickup_update_task(task_id=<clickupTaskId>, status='review', workspace_id=<configured>)`. The exact status string is project-specific; for the `Robust Devs Website` list (id `901803060043`, workspace `36289718`) the verified value is `review` (literal — note that `in review` is rejected by the API on this list). If the API rejects the status, surface the error verbatim, do not retry with a guessed value, and ask the operator for the correct status name — then update this skill and the memory.
2. **Post a short summary comment** via `clickup_create_task_comment(task_id=<clickupTaskId>, comment_text=<2-4 lines>, workspace_id=<configured>, notify_all=false)`. Format:
   ```
   ✅ Local /flow complete on <branch> (commit <SHA>). <one-line outcome>. Awaiting feature-complete push for MR + staging.
   ```
   Keep the comment concise. Do NOT include the full /flow announcement, the pipeline shape, or marketing-style coverage lists — that's the long-form comment that goes out after the push (when there's a remote URL to reference).
3. **Don't double-post:** if a long comment was already posted earlier in the same session for the same task (e.g., a back-link comment from a previous run), still set the status, but skip the short summary comment to avoid noise.

This step is **not** gated on push. The whole point is to surface local progress to the ClickUp board immediately so the human reviewer sees the task move out of `cycle` before the operator pushes.

### Ship-step push gate (hard rule)

**`/flow` commits but never pushes or opens MRs/PRs on its own.** This overrides any auto-push behavior in the underlying gstack `ship` skill or comparable tools.

When the `ship` step runs:

1. Stage the change folder and any deliverable files **explicitly by path** (not `git add -A`).
2. Create a single commit with a conventional-commit-style message that references the change name and (if `clickupSourced`) the ClickUp task ID.
3. **STOP.** Print the commit SHA and a one-line summary of what was committed.
4. Do NOT run `git push`, `gh pr create`, `glab mr create`, or any equivalent. Do NOT call MCP tools that post to remote ticketing systems (ClickUp comments, GitHub issues, GitLab MRs) on the assumption that "ship" implies push.
5. Treat the `archive` step as fair game even without push — it's a local OpenSpec-folder move and a local spec sync. Commit the archive as a second commit on the same branch and stop again.

Why: the operator pushes as **complete features**, not per-task. A feature branch may accumulate multiple `/flow` commits across many sessions before the operator decides it's ready to push. Auto-push pollutes the eventual MR with intermediate commits.

How to surface the gate (Step 9 substitutes):

```
✓ Committed:   <SHA>  <conventional-commit message subject>
✓ Archived:    openspec/changes/archive/<date>-<name>/
✓ Branch:      <branch-name>  (NOT pushed)

Ready to push when the feature is complete. To push now, ask explicitly:
  /flow push   (or just: "push it")
```

The optional follow-up "post the audit URL to the ClickUp ticket" / "create the MR" / "request review" actions are **also** gated on the same push confirmation — comments that reference a remote URL can't be posted until the push is real.

## Step 9 — Final acknowledgment

When the last INCLUDED step (typically `archive`) succeeds **locally**:

- Print: `✓ All /flow steps complete locally for <change-name>.`
- Show the path to the archived change folder (`openspec/changes/archive/<date>-<name>/`).
- Show the local commit SHAs added in this run (one for ship, one for archive — possibly more).
- Print the **push gate** reminder (see "Ship-step push gate"): the branch is NOT pushed; push happens when the operator says so, as a complete feature.
- If `clickupSourced` is true, note that the ClickUp comment back-link is also gated on push and will be posted after the operator authorizes the push.

If the user paused mid-pipeline, print the resume hint:

> `Paused at <phase>. Resume with: /flow <request>` (the skill will detect the state file and pick up).

---

## Failure modes & recovery

**Concurrent invocations.** Two terminals running `/flow` on the same change. Concurrent-access guard (step 8.5) catches this. Resolution: one session aborts, other continues. State file's `lastUpdated` is the source of truth.

**State file out of sync with disk.** Reconciliation rule (step 8 reconciliation) handles this. State is rewritten to match `openspec status` before any other work.

**Underlying tool fails or is unavailable mid-pipeline.** Surface, pause, do not auto-retry. Let the user fix the underlying issue and re-invoke `/flow` to resume.

**Subagent dispatch fails or returns malformed verdict.** A subagent's verdict is malformed if it lacks the `## Status` line or has a status outside `APPROVED | NEEDS_FOLLOW_UP | BLOCKED`. Surface the raw subagent message to the operator verbatim, leave state unchanged, do not auto-retry. Operator decides whether to re-dispatch (possibly with a stronger model via `model <step> gpt-5.5`) or fall back to main-context execution via `dispatch <step> main`.

**Subagent NEEDS_FOLLOW_UP loop exceeds 3 rounds.** Ask the user: *"This step has gone 3 rounds of follow-ups without converging. Abort, switch to main-context execution, or escalate the model to `gpt-5.5`?"* Operator decides.

**User says "this should have been a different shape" mid-flight.** Two options offered: (a) finish the announced shape and amend, (b) abort cleanly (don't archive partial state) and restart with a new shape.

**Bypassed typo turns out to be larger.** No state file exists yet. User re-invokes `/flow <new-request>` and the skill walks the full pipeline as a fresh change. Original edit is referenced in the new change's proposal.md if relevant.

**ClickUp fetch fails or MCP tool unavailable.** Step 0 hard-fails with a clear message — see Step 0.2, 0.3, 0.4 for the four conditions and exact messages. No partial state is left behind. Operator addresses the underlying cause (enable config flag, connect MCP server, fix task access) and re-invokes.

**Resume behavior for ClickUp-sourced flows.** When `/flow <url>` is invoked on a URL whose derived change name already has a folder:

1. Re-fetch task name + custom_id from ClickUp to confirm the URL still resolves to the same change name. If the title was renamed in ClickUp such that the derivation would now produce a different folder name, surface a warning that includes both names so the operator can decide whether to abort and rename:
   > *"ClickUp title now derives to `<new-derived-name>`, but folder remains `<existing-folder-name>`. Continuing with the existing folder. To rename, abort and use the announcement-gate `rename to <name>` modification on the next invocation."*
2. If `clickup-context.md` exists in the folder, prompt:
   > *"`clickup-context.md` exists (fetched `<timestamp>`). Refresh from ClickUp (overwrites the file), keep as-is, or abort?"*
3. If the artifact is missing (rare — folder exists but no artifact), write it now from the fresh fetch without prompting.

## Portability notes

This skill contains no project-specific values. All such values come from `.codex/flow.yaml`. To use this skill in a different project:

1. Copy `.codex/skills/flow.md` to the new repo.
2. Copy `.codex/flow.yaml` and edit `project`, `deploy`, and `cgc_keyword_map` for the new context.
3. Add `.codex/flow.local.yaml` to the new repo's `.gitignore`.
4. Run `/flow` on any change to verify the pipeline shape announces correctly.

**ClickUp integration.** To use ClickUp ingestion in a different project, ensure the ClickUp MCP server is connected in that workspace and set `integrations.clickup.enabled: true` in `.codex/flow.yaml` (the reserved block defaults to `false` for portability — operators opt in per repo). When the integration is disabled or the MCP tool is missing, ClickUp URLs in `/flow` requests cause a hard failure rather than silent fallback.
