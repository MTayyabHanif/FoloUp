---
name: "source-command-flow"
description: "Walk a change request through a consistent OpenSpec-backed pipeline (brainstorming → cgc → propose → reviews → apply → qa → review → ship → archive). Each step is dispatched with a per-step Codex model and dispatch mode (subagent for isolation, main for context-needing steps). Announces the planned shape (with model + dispatch per step) and waits for confirmation before doing anything."
---

# source-command-flow

Use this skill when the user asks to run the migrated source command `flow`.

## Command Template

Walk the user's change request through the `/flow` orchestrator pipeline.

**Input**: The argument after `/flow` is a free-form description of the change ("fix the hero copy", "add a webhook for X", "rebuild positioning"). May be empty.

**Steps**

1. **Read the skill definition** at `.codex/skills/flow.md` and follow it exactly. That file contains the full orchestrator logic — configuration loading, bypass detection, pipeline announcement, confirmation gate, scope resolution, execution, and state management.

2. **If no input was provided**, ask:
   > "What change do you want to work through? Describe the bug, feature, or refactor in plain English."
   Then proceed with that description as the request.

3. **Do not skip the announcement gate.** Even for trivial-looking requests, the skill must print the planned shape and wait for user confirmation before executing any pipeline step.

**Guardrails**

- Never classify the request into a "track" or skip the announcement — `/flow` runs the same shape every time, only depth varies.
- Never auto-retry a failed delegated step (including a subagent that returned BLOCKED or a malformed verdict). Surface the failure verbatim and pause.
- Never auto-fall back from `dispatch: subagent` to `dispatch: main` when a subagent fails. The operator decides via the announcement-gate `dispatch <step> main` modification.
- If `.codex/flow.yaml` is absent, use built-in defaults (full pipeline; `brainstorming`/`propose` on `gpt-5.4`; `cgc`/reviews/`qa`/`ship`/`archive` on `gpt-5.2`; `apply` on `gpt-5.5`) and announce that defaults are being used.
- The skill file is authoritative. If anything in this command file conflicts with `.codex/skills/flow.md`, the skill wins.
