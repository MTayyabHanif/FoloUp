# Audit Index — `index-and-audit-platform`

> Audit: index-and-audit-platform · Generated: 2026-05-18 · Read-only · Driving changes #2 (`adopt-atlassian-design-system`) and #3 (`redesign-journey-and-components`)

Four read-only artifacts that completely inventory FoloUp's frontend surface as of 2026-05-18. Use this index to navigate.

## Deliverables

| # | File | What's inside | Read this when |
|---|---|---|---|
| 1 | [`COMPONENT-INVENTORY.md`](./COMPONENT-INVENTORY.md) | Every file under `src/components/`, `src/contexts/`, `src/services/`, `src/actions/`, `src/lib/`, `src/types/` — with UI library origin, interactive states, usage, maturity | You're authoring change #2 and need to know what to migrate |
| 2 | [`JOURNEY-MAP.md`](./JOURNEY-MAP.md) | Every route in `src/app/`, current auth gates (with conflict flags), side effects, plus Mermaid happy-path diagrams and missing-surface findings | You're authoring change #3 and need to plan per-route redesign + journey rework |
| 3 | [`BROKEN-FEATURES.md`](./BROKEN-FEATURES.md) | §1 Confirmed broken (P0) · §2 Suspected (HIGH/MEDIUM/LOW) — each with file:line, evidence, impact, fix path | You need to triage or you're picking a bug to fix |
| 4 | [`ADS-GAP-ANALYSIS.md`](./ADS-GAP-ANALYSIS.md) | §1 Baseline tokens · §2 Atlassian DS target tokens · §3 Mapping & component blueprint | You're authoring change #2 — this is your migration script source |

## How the artifacts cross-link

- COMPONENT-INVENTORY rows that appear as BROKEN-FEATURES entries carry `→ see BROKEN-FEATURES §X` notes.
- JOURNEY-MAP routes with auth issues carry `→ see BROKEN-FEATURES §1.1` notes.
- ADS-GAP-ANALYSIS §3 component blueprint rows cite COMPONENT-INVENTORY for source path/state.

## Audit scope (re-stated)

- **Read-only** — no source edits. Verified by `git diff` containing only files under this folder.
- **Static evidence only** — no runtime testing, no browser automation. Suspected items are tagged.
- **Frontend + API surface** — DB schema is summarized but not audited at column-level (no DB work planned across changes #2/#3).
- **Accessibility audit deferred to change #2's QA** (see ADS-GAP-ANALYSIS Appendix C scope statement).

## Coverage manifest

| Source area | File count (verified) | Audit section |
|---|---|---|
| `src/components/**` | 50 (incl. ui/, call/, dashboard/, loaders/, top-level) | COMPONENT-INVENTORY §1 |
| `src/contexts/**` | 4 | COMPONENT-INVENTORY §2 |
| `src/services/**` | 6 | COMPONENT-INVENTORY §3 |
| `src/actions/**` | 1 | COMPONENT-INVENTORY §1.3 (server-action rows) |
| `src/lib/**` (excl. prompts) | 5 | COMPONENT-INVENTORY §4 |
| `src/lib/prompts/**` | 4 | COMPONENT-INVENTORY §5 |
| `src/types/**` | 6 | COMPONENT-INVENTORY §6 |
| `src/app/**` page/layout/route.ts | 16 | JOURNEY-MAP §1 + §6 |
| `src/middleware.ts` | 1 | JOURNEY-MAP §2 |
| **Total** | **93** source files inventoried | — |

**Coverage verification (run 2026-05-19):** `find src/components src/contexts src/services src/actions src/lib src/types -type f \( -name '*.ts' -o -name '*.tsx' \)` returns 76 files; every file is referenced by basename in COMPONENT-INVENTORY.md. `find src/app -type f \( -name 'page.tsx' -o -name 'route.ts' -o -name 'layout.tsx' \)` returns 16 files; every file is referenced in JOURNEY-MAP.md.

## Decisions made by this audit (binding for change #2)

1. **Brand color migration strategy:** Option (a) — Custom ADS brand-token override preserving `#4F46E5`. See ADS-GAP-ANALYSIS §3 D3b.
2. **Dead deps to remove during change #2:** `framer-motion`, `@mui/material` (kept `@mui/x-charts` only if PieChart replaced; otherwise also removed), `@nextui-org/react`, `@nextui-org/progress`, 8 dead shadcn ui/* files, `react-color` (if ChromePicker replaced).
3. **Component layer target:** Radix primitives + Tailwind utilities consuming `@atlaskit/tokens` values. NO full `@atlaskit/*` component installs.
4. **Motion stack target:** Keep `tailwindcss-animate`, drop `framer-motion`, migrate accordion keyframes to ADS motion-token consumers.
5. **Dark mode:** Currently disabled at runtime (NextThemesProvider forces light). Change #2 decision pending — recommend enable with ADS dark-mode token set since the CSS is already written.

## Decisions deferred to change #3 (NOT this audit's call)

1. Auth bypass fix on `/interviews/[interviewId]` (BROKEN-FEATURES §1.1)
2. Response webhook fixes (BROKEN-FEATURES §1.2, §1.3)
3. Root landing page addition or redirect strategy
4. Whether to wire up or delete `createInterviewerCard.tsx` orphan UI
5. Whether to consolidate `(client)/layout.tsx` + `(user)/layout.tsx` into a single root layout
