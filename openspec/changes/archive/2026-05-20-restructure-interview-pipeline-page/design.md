# Design — restructure-interview-pipeline-page

## Goals

1. One source of truth for the "no candidate selected" overview — eliminate the page-level hero card duplication.
2. Make scanning, filtering, sorting, and opening sessions a one-second operation, not a multi-step scroll-and-click.
3. Preserve every URL contract and callback so external links, the dashboard deep-links, and the delete flow keep working.
4. Reuse existing primitives — no new dependencies, no new top-level routes.

## Non-goals

- Changing the data shape, services, or API routes.
- Changing the candidate-side call experience.
- Touching `EditInterview` internals (only its invocation point moves).
- Introducing a drawer or modal-based detail panel. The two-column workspace stays — that is what makes navigation between sessions fast.
- Building new components in `src/components/ui/`. All new layout lives in route-local `_components/`.

## Layout — before and after

### Before (today)

```
PageHeader  [Share] [Preview] [Marker] [Edit] [Active toggle]
HeroCard    health badge + objective + interviewer + 4 KPI tiles
┌ aside 320px ─────────┐ ┌ main ───────────────────────────────┐
│ Section: Pipeline    │ │ if call selected: <CallInfo>        │
│   <Select stage>     │ │ else if edit:     <EditInterview>   │
│   grouped rail       │ │ else:             <SummaryInfo>     │
│   (Live/Review/...)  │ │   - same health badge + title       │
│   each row: name,    │ │   - same 4 KPI tiles                │
│   summary, score,    │ │   - ranked list (top 4)             │
│   indicators         │ │   - pipeline health block           │
│                      │ │   - <DataTable> (sortable, opens     │
│                      │ │     in new tab — inconsistent)      │
└──────────────────────┘ └─────────────────────────────────────┘
```

### After

```
PageHeader  [Share] [Edit] [Active toggle] [⋯ overflow: Preview, Marker]
┌ Sessions panel ~420px ──────┐ ┌ main ───────────────────────────────┐
│ Sticky toolbar:             │ │ if call selected: <CallInfo>        │
│   [search input............]│ │ else if edit:     <EditInterview>   │
│   Chip row: All · Live ·    │ │ else:             <SummaryInfo>     │
│     Review · Potential ·    │ │   - compact header (no duplicate    │
│     Selected · Interrupted ·│ │     hero — page already shows it)   │
│     Closed · Abandoned      │ │   - 4 KPI tiles                     │
│   [Sort: Recency ▾] [☐ Unread] │ │   - top signals list (3, link to     │
│                             │ │     candidate via ?call=)           │
│ Dense list:                 │ │   - pipeline health block           │
│   ─ if sort=Stage: groups   │ │   - "open in Sessions panel" hint    │
│     (Live, Review, ...)      │ │     replaces the embedded DataTable │
│   ─ otherwise: flat list,   │ │                                     │
│     stage shown inline      │ │                                     │
│   row: name · stage pill ·  │ │                                     │
│   score · recency · unread/ │ │                                     │
│   live indicator            │ │                                     │
└─────────────────────────────┘ └─────────────────────────────────────┘
```

## File structure

```
src/app/(client)/interviews/[interviewId]/
  page.tsx                          # orchestration only — fetch, state, route to subviews
  _components/
    sessions-panel.tsx              # filter/sort/search + list rendering
    sessions-toolbar.tsx            # search + chips + sort + unread toggle
    session-row.tsx                 # dense row used in both grouped and flat modes
    header-actions.tsx              # Share + Edit + Active + overflow menu
```

Route-local `_components/` is the existing convention in this repo (see other archived changes).

## State + data flow

The page already owns the right state: `responses`, `interview`, `railFilter`, `searchParams.call`. Three new pieces of state move into `<SessionsPanel>`:

- `query: string` — name search input (lowercased, exact substring match against `displayName`).
- `sortKey: "recency" | "score" | "name" | "stage"` — defaults to `"recency"`.
- `unreadOnly: boolean` — defaults to `false`.

Filter, sort, and grouping happen inside `<SessionsPanel>` via `useMemo` over `workflow.stageGroups` flattened to `workflow.responses` and re-grouped on demand. The page does not need to know about query/sort/unreadOnly; `railFilter` continues to live in the page only so that header KPIs and `SummaryInfo` could conceivably react to it in the future (today they do not).

Selection still flows through `router.push(...?call=<callId>)`. Same-shape callback for `handleResponseClick`. `handleDeleteResponse` and `handleCandidateStatusChange` are unchanged. `EditInterview` and `CallInfo` are unchanged.

### Sort and grouping rules

- `sortKey === "stage"` → render groups in `WORKFLOW_STAGE_ORDER`. Each group is `WorkflowStage`'s candidates, internally sorted by the existing `scoreCandidate` composite descending. This matches today's behavior and is what stage filtering implicitly asks for.
- `sortKey !== "stage"` → render one flat list across all visible (`railFilter` + `unreadOnly` + `query`) candidates, sorted by the chosen field:
  - `recency`: `createdAt` descending.
  - `score`: `score ?? -1` descending (Pending candidates fall to the bottom).
  - `name`: `displayName.localeCompare(other)` ascending.
- Stage chips and the `unreadOnly` toggle apply regardless of sort mode. Search applies regardless of sort mode.

### Search input

- Plain controlled `<input>` (no debounce — list is in-memory, lengths are small).
- Lowercased substring match on `candidate.displayName`. If the displayName is the email (anonymous candidate), the email matches.

### Unread toggle

- Mirrors today's "Unopened" badge logic: `!candidate.isViewed && candidate.status !== "ongoing"` qualifies as unread.

### Stage chips

- Render as a single horizontally-scrolling row of `<button>`-style chips.
- "All" chip + one chip per stage that has at least one candidate. Empty stages are hidden (existing rail already does this).
- Selecting a chip sets `railFilter`. The current `<Select>` is removed.

### Sticky toolbar

- The toolbar (`search` + `chips` + `sort` + `unread`) is `sticky top-0` inside the panel's scroll container so it stays visible while scrolling the rows.

## Header actions

- Primary row: `Share`, `Edit`, `Active toggle`. Three buttons + one switch — half of today's count.
- Overflow: a `…` menu (using the existing `DropdownMenu` from `src/components/ui/dropdown-menu.tsx` if present, else a small `Modal`-driven popover) with `Preview` and `Marker`.
- The Marker (color-picker) modal is unchanged; only its trigger relocates. The Share popup is unchanged.

## SummaryInfo reconciliation

`SummaryInfo` keeps its role as the no-selection right-column overview. Three edits:

1. Drop the duplicated identity dot + health badge + title + description block (lines ~70–104). The page has already rendered the identity in `PageHeader`; this card now opens with the role-setup tile and the four KPI metrics.
2. Drop the `DataTable` block (lines ~237–280) entirely. It duplicates the Sessions panel and ships an inconsistent "open in new tab" behavior. The "Strongest current signal" call-out at the bottom remains — it adds a directional next action and is not redundant.
3. The ranked-candidates list keeps `onOpenCandidate` and continues using the same `?call=` flow as the Sessions panel.

This deletion removes `dataTable.tsx` from the `SummaryInfo` import graph. Since `DataTable` is used nowhere else (verified by grep during cgc), the file can be deleted as part of this change.

## URL contract — preserved

- `?call=<callId>` → selects a candidate. Same flow.
- `?edit=true` → opens `EditInterview`. Same flow.
- Dashboard deep-links from `src/app/(client)/dashboard/page.tsx` continue to work.
- `CallInfo`'s "Back to workspace" still calls `router.push(/interviews/<id>)` — unchanged.

## Accessibility

- Search input has a visible label or `aria-label="Search candidates"`.
- Stage chips use `role="group"` wrapping and each chip uses `aria-pressed` to communicate selection. They are real `<button>` elements (the rail's existing pattern).
- Sort `<Select>` keeps Radix `Select` semantics already in use.
- "Unread only" `<Switch>` keeps Radix `Switch` semantics.
- Sticky toolbar must not obscure the list at small viewport heights — verify focus scrolls the list under the toolbar, not above it (Radix handles this when the scroll container is the toolbar's parent).

## Performance

- All filters/sorts are `useMemo`'d over the responses array. Even with a few hundred candidates this is microseconds.
- No new network calls. No new server work.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Recruiters rely on the DataTable's "open in new tab" affordance | Provide the same affordance: middle-click and cmd-click on the new session rows open in a new tab because the row is a real anchor under the hood (`<Link href="?call=..." />`). |
| Header overflow on tablet widths | Edit and Active toggle wrap to a second row at <768px; overflow menu collapses Share into it too. |
| `EditInterview` still expects to render inline | Unchanged — `?edit=true` still routes to it. |
| Sticky toolbar overlaps with scroll bars on Firefox | Use the existing `ScrollArea` Radix wrapper which masks browser-native scrollbar artifacts. |
| Duplication regresses if `SummaryInfo` changes underneath | The page no longer renders a hero card; if `SummaryInfo` adds one back later, the duplication is in one place and easy to spot. |

## What we are deliberately not doing

- Not introducing a server-side filter/sort API. Client-side is fine at current data volumes.
- Not adding multi-select / batch status actions. Useful but out of scope; queue for a follow-up change.
- Not introducing a command-K palette. Same reason.
- Not changing `CallInfo`'s back-navigation contract. It still does its own lookup; this change does not require fixing that.
- Not adding date-range filtering. Recency sort covers the common case and the data doesn't span enough time on most jobs to warrant a real date filter yet.
