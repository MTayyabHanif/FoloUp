# Proposal — adopt-atlassian-design-system

## Why

Change #2 of 3 in FoloUp's full UX redesign onto the Atlassian Design System. The audit (change #1, archived at `openspec/changes/archive/2026-05-19-index-and-audit-platform/`) produced a complete migration script. This change executes it.

| # | Change | Status |
|---|---|---|
| 1 | `index-and-audit-platform` | ✓ Archived (commits 144b2b9, 3e76df4) |
| 2 | **`adopt-atlassian-design-system`** | **this proposal** |
| 3 | `redesign-journey-and-components` | queued |

Today's UI is built on 4 overlapping libraries (NextUI, MUI, Radix/shadcn, custom Modal), 8 dead shadcn primitives, ~1.5 MB of unused npm packages, and a hardcoded `#4F46E5` brand color in 22 files with no token representation. This change consolidates the component layer onto Radix + `@atlaskit/tokens`, preserving FoloUp's visual identity while creating the foundation that change #3 redesigns against.

## What

Migrate FoloUp's UI to Atlassian Design System **tokens + Radix primitives** (not full `@atlaskit/*` packages) across 4 waves. No new features. No journey reflow. No broken-feature fixes (those go to change #3).

### Wave breakdown

| Wave | Commits | Touches | Sessions |
|---|---|---|---|
| 1 — Tokens | 1 | `tailwind.config.ts`, `globals.css`, `package.json` (add `@atlaskit/tokens`), `.env.example` | 1 |
| 2 — Primitives | 1 | All `src/components/ui/*` (MIGRATE 11, build 7 new, DELETE 0 here — only in wave 4); add 6 Radix packages | 1–2 |
| 3 — Composites + color sweep + smell cleanup | 1 | All composites (`call/*`, `dashboard/*`, `loaders/*`, `navbar.tsx`, `providers.tsx`, `sideMenu.tsx`); 22 brand-color files sweep; `Modal.tsx` → Radix Dialog; MUI PieChart → pure-SVG donut; NextUI Progress → Radix; ChromePicker → Radix Popover swatches; rename lowercase components; remove `dangerouslyAllowBrowser`; add `NEXT_PUBLIC_MARKETING_URL` env var | 2–3 |
| 4 — Cleanup | 1 | `yarn remove` 6 packages (`@nextui-org/*`, `@mui/*`, `@emotion/*`, `framer-motion`, `react-color`, `@types/react-color`); delete 9 dead shadcn ui files | 1 |

Each wave ends with a single commit. The full set ships locally; no push (per `/flow` push gate).

### Deliverables (production code, not docs this time)

1. **Token system foundation** — `@atlaskit/tokens` installed; `--ds-brand-*`, `--ds-motion-*`, `--ds-shadow-*` CSS variables defined in `globals.css`; Tailwind `brand` color key wired in `tailwind.config.ts`.
2. **Component primitive library** — 11 migrated shadcn primitives + 7 new Radix-based primitives (`Input`, `Dialog`, `Popover`, `DropdownMenu`, `RadioGroup`, `Checkbox`, `Accordion`, `Progress` — Progress reuses already-installed `@radix-ui/react-progress`).
3. **Consumer site migration** — all 22 brand-color files swept; custom `Modal.tsx` replaced with Radix Dialog wrapper; MUI PieChart replaced; NextUI CircularProgress replaced; ChromePicker replaced.
4. **Cleanup** — 6 npm packages removed (~1.48 MB ungzipped saved); 9 dead shadcn files deleted; lowercase exports renamed; `dangerouslyAllowBrowser` flag removed; `NEXT_PUBLIC_MARKETING_URL` env var added.

## Scope boundaries (hard)

- **No broken-feature fixes** — middleware auth bypass, webhook bugs, themeColor save logic, console-only errors → change #3.
- **No journey or route changes** — no new routes, no root layout consolidation, no landing page → change #3.
- **No dark-mode toggle UI** — CSS remains defined; runtime toggle deferred to change #3.
- **No `@tanstack/react-query` adoption** — keep current provider; adopt/remove decision deferred to change #3.
- **No service-layer rewrites** — `any` types only fixed where touched (e.g., ChromePicker's `color: any` becomes `string`); broader hardening goes to change #3.
- **No accessibility audit** beyond contrast spot-check on brand color (per audit Appendix C.7).

## Binding decisions from audit (do NOT relitigate)

1. Brand color strategy: option (a) custom override `--ds-brand-bold = #4F46E5`
2. ADS implementation: tokens via `@atlaskit/tokens` + Radix/Tailwind components (NO `@atlaskit/button`, etc.)
3. Motion: keep `tailwindcss-animate`, drop `framer-motion`
4. PieChart replacement: pure-SVG donut (operator decision during this change's brainstorming)
5. ChromePicker replacement: Radix Popover + curated 8-swatch palette

## Success criteria

- All 4 waves committed locally; `yarn build` succeeds at each wave boundary.
- Visual identity preserved: every existing brand-bold use renders the same `#4F46E5` (just via token now).
- Zero imports remain of `@nextui-org/*`, `@mui/material`, `@mui/x-charts`, `framer-motion`, `react-color`.
- Bundle analyzer confirms ≥1.3 MB ungzipped reduction.
- No new TypeScript errors. No new ESLint errors. Existing eslint-disables not removed unless their underlying smell is fixed (e.g., lowercase-export renames remove their associated `react-hooks/rules-of-hooks` disables).
- `grep -rn "indigo-" src/` returns 0 hits (except DB-state defaults `useState<string>("#4F46E5")` which are NOT class strings).
- `grep -rn "dangerouslyAllowBrowser" src/` returns 0 hits.
- WCAG AA contrast spot-check: `--ds-brand-bold` (light mode) on `--background` passes for ≥18pt text; documented in commit message if it fails for small text and a `--ds-brand-bolder` is suggested.

## Out of scope (explicit non-goals — repeated for emphasis)

- Auth bypass fix (BROKEN-FEATURES §1.1)
- Webhook fixes (§1.2, §1.3)
- themeColor save bug (§2.1)
- Console-error → toast helper (§2.2 — large refactor)
- Hardcoded URL replacement is IN scope only for the 3 sites identified by the audit (`call/[interviewId]/page.tsx` × 2, `call/index.tsx` × 1) — broader URL-config rework goes to change #3
- Dark mode toggle UI
- New routes (root, error, not-found, loading pages)
- `createInterviewerCard.tsx` wire-up or delete (orphan UI decision)
- React Query adoption
- Service-layer `any` type cleanup (except where touched in this wave)
