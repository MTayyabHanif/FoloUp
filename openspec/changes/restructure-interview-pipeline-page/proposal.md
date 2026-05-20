# Proposal — restructure-interview-pipeline-page

## Why

The `/interviews/[interviewId]` page is the recruiter's main session-review surface and it has become visually cluttered. The current layout renders, in this order, a five-button header strip, a large tinted hero card with health badge + objective + interviewer box + four KPI tiles, a 320-pixel pipeline aside with a single dropdown filter, and a right column that — when no candidate is selected — re-renders the same health badge, the same objective, the same four metric tiles, plus a ranked-candidates list, a pipeline-health block, and a full sortable candidate `DataTable`. Two surfaces show the same information; the candidate table opens in a new tab while the rail opens inline; sorting and filtering live only as a single dropdown and three sortable table columns far below; there is no name search, no "unread only" toggle, no one-click stage filter; and the recruiter must scroll past the hero card every time before reaching the session list. Navigating between sessions, filtering them, and scanning who is worth opening next is harder than it should be.

## What Changes

- Remove the page-level hero card and let `SummaryInfo` own the "no candidate selected" overview on its own.
- Slim the header action strip so the active toggle, share, and edit remain primary and Marker plus Preview fold into a single overflow menu.
- Replace the pipeline `<aside>` with a wider Sessions panel that pairs a sticky filter/sort/search toolbar with a dense list of session rows.
- Replace the single stage `<Select>` with one-click stage filter chips, add a name search input, add an "Unread only" toggle, and add a sort control with Recency, Score, Name, and Stage options.
- Flatten the stage-grouped rendering into a single list when the sort is not "Stage" and surface the active session's stage inline on each row.
- Tighten the session row to one dense card per response that exposes name, stage, score, recency, unread, and live indicators without truncating useful context.
- Reconcile `SummaryInfo` so it stops duplicating the page-level header and drops the embedded `DataTable` block in favor of pointing recruiters back to the new Sessions panel.
- Align `dataTable.tsx`'s external-link affordance with the same `?call=` in-page navigation the new Sessions panel uses, so the two surfaces stop disagreeing on what "open candidate" means.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `recruiter-hiring-workspace`: refine the interview-detail behavior to make session navigation, filtering, and sorting first-class, and to remove the duplicated overview surface that currently sits above the pipeline.

## Impact

- Affected code: `src/app/(client)/interviews/[interviewId]/page.tsx`, `src/components/dashboard/interview/summaryInfo.tsx`, `src/components/dashboard/interview/dataTable.tsx`, plus one new `_components/` directory under the page route for the extracted session panel pieces.
- Data and APIs: no schema, route, or service-layer changes. The change reuses `buildHiringWorkflowSummary`, `ResponseService`, `InterviewService`, the existing `WorkflowStage` enum, and the existing `?call=` URL parameter for selection.
- Dependencies and systems: no new packages. Existing primitives in `src/components/ui/` (Input, Select, Switch, Button, ScrollArea, Section, EmptyState, Tooltip) cover every new control. Existing modals (color picker, share) remain — only their triggers move.
- Risks: the page is the recruiter's main hiring surface; the redesign must preserve every URL contract (`?call=<callId>`, `?edit=true`) and every existing callback (`onDeleteResponse`, `onCandidateStatusChange`) so dashboard deep-links and the in-place delete flow keep working. Header overflow on small screens needs care because actions get denser. The `DataTable` `window.open(..., "_blank")` change is a behavior shift recruiters may notice.
