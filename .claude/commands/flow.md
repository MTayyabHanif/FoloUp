---
name: flow
description: Walk a change request through a consistent OpenSpec-backed pipeline (brainstorming → cgc → propose → reviews → apply → qa → review → ship → archive). Each step is dispatched with a per-step model (Sonnet for read-only analysis, Opus for design/code, Haiku for mechanical) and dispatch mode (subagent for isolation, main for context-needing steps). Announces the planned shape (with model + dispatch per step) and waits for confirmation before doing anything.
category: Workflow
tags: [workflow, openspec, orchestrator, subagent]
---

Walk the user's change request through the `/flow` orchestrator pipeline.

**Input**: The argument after `/flow` is a free-form description of the change ("fix the hero copy", "add a webhook for X", "rebuild positioning"). May be empty.

**Steps**

1. **Read the skill definition** at `.claude/skills/flow.md` and follow it exactly. That file contains the full orchestrator logic — configuration loading, bypass detection, pipeline announcement, confirmation gate, scope resolution, execution, and state management.

2. **If no input was provided**, use the AskUserQuestion tool to ask:
   > "What change do you want to work through? Describe the bug, feature, or refactor in plain English."
   Then proceed with that description as the request.

3. **Do not skip the announcement gate.** Even for trivial-looking requests, the skill must print the planned shape and wait for user confirmation before executing any pipeline step.

**Guardrails**

- Never classify the request into a "track" or skip the announcement — `/flow` runs the same shape every time, only depth varies.
- Never auto-retry a failed delegated step (including a subagent that returned BLOCKED or a malformed verdict). Surface the failure verbatim and pause.
- Never auto-fall back from `dispatch: subagent` to `dispatch: main` when a subagent fails. The operator decides via the announcement-gate `dispatch <step> main` modification.
- If `.claude/flow.yaml` is absent, use built-in defaults (full pipeline; all subagent steps Sonnet; main steps Opus for `apply` / Haiku for `archive`) and announce that defaults are being used.
- The skill file is authoritative. If anything in this command file conflicts with `.claude/skills/flow.md`, the skill wins.
