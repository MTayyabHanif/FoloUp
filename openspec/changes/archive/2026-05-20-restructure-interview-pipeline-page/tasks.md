# Tasks — restructure-interview-pipeline-page

## 1. Extract reusable sub-components under the route

- [ ] 1.1 Create `src/app/(client)/interviews/[interviewId]/_components/` and move the inline `OverviewCard` helper out of `page.tsx` (slated for deletion, not relocation — confirm in 4.x).
- [ ] 1.2 Create `_components/session-row.tsx` rendering one dense candidate row (name + summary, score badge, stage pill, recency, unread/live indicators) and selection styling. Accept `candidate`, `isSelected`, `onSelect`, and an optional `stageVisible` flag for flat-mode rendering.
- [ ] 1.3 Create `_components/sessions-toolbar.tsx` with a controlled search input, a horizontally scrollable chip row for `WorkflowStage` filtering, a `Sort by` `Select` (Recency, Score, Name, Stage), and an "Unread only" `Switch`. Toolbar is `sticky top-0` inside its scroll container.
- [ ] 1.4 Create `_components/sessions-panel.tsx` that composes the toolbar plus the list. Own `query`, `sortKey`, `unreadOnly` state. Accept `workflow`, `selectedCallId`, `railFilter`, `onRailFilterChange`, `onSelectCandidate` props. Memoize the filtered/sorted candidate list and either render grouped (`sortKey === "stage"`) or flat using `<SessionRow>`. Show the existing compact `EmptyState` when the filtered list is empty.
- [ ] 1.5 Create `_components/header-actions.tsx` with `Share`, `Edit`, `Active toggle` as the primary row and a `…` menu (use `DropdownMenu` if present in `src/components/ui/`, otherwise inline a small Radix popover) hosting `Preview` and `Marker`. Accept all the same callbacks the page currently passes.

## 2. Restructure `page.tsx`

- [ ] 2.1 Delete the inline `OverviewCard` helper and the entire page-level hero card block (the `<div className="rounded-[28px] border ... bg-[#f6f8ef] p-6 text-[#0a1d08]">` that contains the health badge, identity dot, objective, interviewer box, and four KPI tiles).
- [ ] 2.2 Replace the inline `headerActions` JSX with `<HeaderActions ... />`.
- [ ] 2.3 Replace the inline `<aside>` + `<Section>` + rail JSX with `<SessionsPanel ... />`. Keep the outer two-column grid (`xl:grid-cols-[420px_minmax(0,1fr)]` — widen from `320px`).
- [ ] 2.4 Keep the main column's `selectedCallId / isEditMode / default` switch and its three render targets (`CallInfo`, `EditInterview`, `SummaryInfo`) exactly as today.
- [ ] 2.5 Confirm the page is now ≤ ~350 lines and contains no JSX deeper than three levels in any one block.

## 3. Reconcile `SummaryInfo`

- [ ] 3.1 Remove the duplicated identity-dot + health-badge + title + description block at the top of `summaryInfo.tsx` (kept by `PageHeader` now). The card opens with the role-setup tile and the four `SummaryMetric` KPIs.
- [ ] 3.2 Remove the entire "Candidate table" block (the section header through the `<DataTable>` `<ScrollArea>` wrapper and the closing `Strongest current signal` panel that lives inside it). Re-add only the "Strongest current signal" call-out as a standalone block at the bottom of `SummaryInfo` — it is still useful and is not redundant with the Sessions panel.
- [ ] 3.3 Drop the now-unused imports (`DataTable`, `ScrollArea`, `convertSecondstoMMSS` if no longer referenced, `TimerReset` if no longer referenced, `TableData` type if no longer referenced). Run a lint pass to remove dead imports.
- [ ] 3.4 Delete `src/components/dashboard/interview/dataTable.tsx` after confirming no other file imports it (`grep -r "from .*dataTable" src/`). Update or remove `src/types/dataTable.type.ts` if it exists and is no longer referenced.

## 4. Wire and polish

- [ ] 4.1 Verify `?call=<callId>` deep-links from `src/app/(client)/dashboard/page.tsx` still open candidates in the new layout — no `dataTable` `window.open` regressions because that path is deleted entirely.
- [ ] 4.2 Verify `<SessionsPanel>` rows support cmd-click / middle-click to open in a new tab. Implement the row as a `<Link href="...?call=<id>">` so native browser modifiers work, with `onClick` calling `handleResponseClick` for the unread side-effect on plain clicks only.
- [ ] 4.3 Verify the sticky toolbar does not visually overlap with rows during scroll — toolbar uses an opaque background (`bg-[#fbfdf6]`) and a bottom border.
- [ ] 4.4 Verify the page renders correctly at `xl` (≥1280px), `lg` (1024–1279px), and `md` (768–1023px). Below `xl`, the two-column grid collapses to a single column; the Sessions panel comes first, the main column comes second. On `md`, the header actions wrap to a second row.
- [ ] 4.5 Verify keyboard behavior: tab order goes through toolbar controls, then into the list; a row's `Enter` selects the candidate; chip group uses left/right arrow keys when focused.

## 5. Verification

- [ ] 5.1 Run `bun run lint` (or the project's equivalent) and resolve any new findings introduced by this change.
- [ ] 5.2 Run `bun run typecheck` (or the project's equivalent) and resolve any new type errors.
- [ ] 5.3 Manually exercise the page on a real interview with at least one of each stage (live, review, potential, selected, interrupted, not_selected, abandoned) and confirm filter chips, sort options, search, unread toggle, and selection all behave as designed.
- [ ] 5.4 Manually exercise the empty interview state (no candidates) and confirm `SummaryInfo` shows its "ready for candidates" empty state and the Sessions panel shows its compact empty state.
- [ ] 5.5 Manually exercise `?call=<callId>` deep-links from the dashboard and confirm the candidate opens inside the new workspace.

## 6. Documentation

- [ ] 6.1 Update the `recruiter-hiring-workspace` spec delta under `specs/recruiter-hiring-workspace/spec.md` with the modified requirements (see this change's `specs/` folder).
- [ ] 6.2 Commit the change in two logical chunks if it gets large: (a) extraction + page restructure, (b) `SummaryInfo` reconciliation + `dataTable.tsx` delete. Otherwise one commit is fine.
