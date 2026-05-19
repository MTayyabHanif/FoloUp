# Proposal — relayout-with-page-shell

## Why

Operator feedback after change #2 + #3: "current flow/layout is old, not up to the mark, not modern, looks broken, things going out of cards/modals/pages."

Change #2 swapped tokens (color, shadow, motion, radius). Change #3 fixed broken features and added missing surfaces. **Neither touched composition.** Every route still uses one-off `flex`/`grid` arrangements, arbitrary padding, no shared page-shell pattern, and content escapes its containers because nothing constrains widths or truncates text.

This change is a layout-and-composition pass — visual fidelity priority, ADS composition patterns (PageHeader / Sidebar / Drawer / EmptyState / Banner / Field), one wave per route on a shared shell.

## What

Wave 0 — shared shell primitives, then 6 per-route waves, all consuming the same shell.

| Wave | Scope |
|---|---|
| 0 | `<PageShell>`, `<PageHeader>`, `<Section>`, `<EmptyState>`, `<Banner>`, `<Drawer>` primitives + container width tokens |
| 1 | `/interviews/[interviewId]` — worst-offender (share + edit + theme + responses + analytics all on one screen) |
| 2 | `/dashboard` — interview list grid |
| 3 | `/dashboard/interviewers` — interviewer roster grid |
| 4 | `/call/[interviewId]` — candidate interview experience (696-line `Call` component) |
| 5 | `/sign-in` + `/sign-up` — auth pages on shell |
| 6 | Modals + popovers width-constrained (`sharePopup`, `createInterviewModal`, theme-color swatch, candidate Dialog content) |
| 7 | QA, review, ship, archive |

## Scope boundaries (hard)

- **No journey/IA changes** — routes stay where they are. No new pages, no merges, no splits. Per operator answer.
- **No new design tokens** — use the change #2 token system as-is. Compose, don't recolor.
- **No new features.** A button that does X today still does X. The button just lives in a properly composed page now.
- **No mobile-first overhaul** — desktop-correct first; mobile breakpoints are best-effort.

## Binding decisions

1. **Reference:** Atlassian Design System composition patterns. PageHeader stamp, single content column with optional Drawer, generous spacing (`space.300`+ between sections), max-width 1280px content area.
2. **Priority:** Visual fidelity. Generous whitespace, hero treatments where content warrants, proper text truncation, no overflow.
3. **Density target:** Recruiter dashboards = card grid 3-col @ ≥1024px, 2-col @ ≥768px, 1-col mobile. Interview detail = single column with side-by-side analytics blocks. Candidate flow stays focused (no chrome).
4. **Container widths:**
   - `max-w-7xl` (1280px) for content shells
   - `max-w-2xl` (672px) for forms and dialogs
   - `max-w-md` (448px) for narrow modals (color picker, simple confirms)
5. **Text overflow:** Every label/title/description gets `truncate` or `line-clamp-N`. No exceptions.

## Success criteria

- All 7 routes rebuilt on the `<PageShell>` primitive
- No content overflows its container at desktop ≥1024px or tablet ≥768px
- Modals/popovers have explicit `max-w-*` constraints; content scrolls inside, not the modal
- Every page has a consistent header (title + description + actions)
- Empty states are branded (no naked "No data" text)
- `yarn build` green at every wave

## Out of scope

- Mobile-perfect responsive (best-effort tier-2 priority)
- Animation choreography beyond what Radix + tailwindcss-animate provide
- Per-component refactors not driven by composition (e.g., the `Call` component's call lifecycle logic stays untouched in Wave 4 — only its visual scaffolding changes)
- Marketing landing page (still just a redirect)
- New IA / route map (covered by audit + change #3)
