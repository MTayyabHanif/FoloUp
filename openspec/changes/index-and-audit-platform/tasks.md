# Tasks — index-and-audit-platform

All tasks produce markdown only. No code edits. Output path: `openspec/changes/index-and-audit-platform/artifacts/`.

## Task group A: COMPONENT-INVENTORY.md

- [ ] **A1** — Read `cgc` manifest from this proposal; transcribe the component table verbatim into §1 Component inventory table with columns: Path · Export · UI library origin · ~Lines · Used by (top 3) · MATURITY · States · Flags
- [ ] **A1b** — For each component row, populate the **States** column with a short tag list (e.g., `hover:✓ focus:✓ disabled:✓ loading:✗ error:✗`) recording which interactive states the implementation actually handles. Components missing `focus` become implicit accessibility flags (cross-reference into ADS-GAP-ANALYSIS Appendix C). For components with named variants (e.g., `Button` primary/ghost/destructive), record variant set in Notes/Flags column.
- [ ] **A2** — For every component flagged `partial`, write a per-component subsection: What's built, what's missing, hypothesis on intended completion
- [ ] **A3** — For every component flagged `orphan-ui`, write a per-component subsection: Full path, what the UI does, why it's unwired (best guess), suggested disposition (delete / wire up / leave alone)
- [ ] **A4** — For every `mixed-library-collision` flagged component, document the collision precisely: which library, which import line, which fix path is cleanest for change #2
- [ ] **A5** — Add `src/actions/parse-pdf.ts` and any other `src/actions/*` files (server actions used by components) as their own rows
- [ ] **A5b** — Add `src/lib/*.ts(x)` files (constants, enums, logger, compose, utils) as §4 Utility/lib layer table — columns: Path · Export · Purpose · Used by (top 3). Include `src/components/dashboard/interviewer/avatars.ts` (`.ts` not `.tsx` — common glob miss).
- [ ] **A5c** — Add `src/lib/prompts/*.ts` files as §5 AI prompt library table — columns: Path · Exported prompt fn/const · Consumed by (which API route or service) · LLM call type (chat-completion / structured). Change #2 + #3 both need this map.
- [ ] **A5d** — Add `src/types/*.ts` files as §6 Domain types table — columns: Path · Exported type/interface · Notes (which have `any` fields). Critical input for change #2 (will be touched during service-layer hardening).
- [ ] **A6** — Add `src/contexts/*` files as a §2 Context layer table — these are React contexts (not visual components) but inventory-relevant
- [ ] **A7** — Add `src/services/*` files as a §3 Service layer table — service-level inventory matters for change #2 (replace `any`-typed payloads) and change #3 (error surfaces)
- [ ] **A8** — Appendix A: Dead imports — exhaustive list of installed-but-unused packages from `cgc` manifest (framer-motion, @mui/material, @tanstack/react-query usage gap, 8 dead shadcn files)
- [ ] **A9** — Appendix B: Code smells — `any` types in service/type files, eslint-disable bypasses, lowercase-exported components (questionCard, createInterviewerCard, interviewerCard, providers), naming violations
- [ ] **A10** — QA self-check (deterministic):
  - Run `find src/components src/contexts src/services src/actions src/lib src/types -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l` and record output as N_files
  - Count inventory table rows across §1–§6: N_rows
  - Require N_rows ≥ N_files (every file represented at least once; some files may appear in multiple sections, e.g., `src/lib/prompts/*.ts` in §5 AND §4 footnote)
  - Run `cut -d'|' -f2 <inventory-table>` then verify each path with `test -f <path>` — fail if any cited path doesn't resolve to an actual file

## Task group B: JOURNEY-MAP.md

- [ ] **B1** — §1 Route table — transcribe `cgc` manifest's route inventory into a single markdown table: URL · File · Auth gate (with CONFLICTED flag) · Side effects · Linked components · Purpose
- [ ] **B2** — §2 Middleware analysis — quote the full `src/middleware.ts` content; annotate the `/interview(.*)` double-claim line by line; show that `isProtectedRoute` is declared but never called; conclude with the precise auth-bypass user impact
- [ ] **B3** — §3 Mermaid sequence diagram — Recruiter happy path (Clerk sign-in → dashboard render → org plan check → click "Create interview" → DetailsPopup → OpenAI generates questions → save → SharePopup → copy link)
- [ ] **B4** — §4 Mermaid sequence diagram — Candidate happy path (open `/call/[interviewId]` → InterviewService.getInterviewById → register-call API → Retell webcall → live transcript → end → save response → recruiter views in `/interviews/[interviewId]` → get-call API → analytics → display)
- [ ] **B5** — §5 Named missing surfaces — no root `/` page, no error.tsx, no not-found.tsx, no loading.tsx; `createInterviewerCard.tsx` UI not wired to any route; document each with proposed route + suggested change # to address
- [ ] **B6** — §6 API route catalog — every `route.ts` with: HTTP method · Path · Side effects · Current auth status · Required for which flow · Known issues (webhook bug, etc.)
- [ ] **B7** — QA self-check: count `page.tsx` + `route.ts` + `layout.tsx` + `error.tsx` + `not-found.tsx` + `loading.tsx` files in `src/app/**` via `find src/app -type f \( -name 'page.tsx' -o -name 'route.ts' -o -name 'layout.tsx' -o -name 'error.tsx' -o -name 'not-found.tsx' -o -name 'loading.tsx' \) | wc -l`; confirm every one appears in §1 (routes) or §6 (API). Missing files (e.g., no root `layout.tsx` or `error.tsx`) become §5 Named missing surfaces entries with `find` exit code 0 used as proof of absence.

## Task group C: BROKEN-FEATURES.md

- [ ] **C1** — §1 Confirmed broken header — define what "confirmed" means in this audit context (operator-named OR static-evidence-with-high-certainty)
- [ ] **C2** — §1.1 P0 — Middleware auth bypass on `/interviews/[interviewId]` — file:line citations from `src/middleware.ts`, exact bypass mechanism, user impact (interview detail + responses publicly readable), recommended fix scope (change #3)
- [ ] **C3** — §1.2 P0 — Response webhook unreachable (Clerk 401 because not in `isPublicRoute`) — citation to `src/middleware.ts:7-12` and `src/app/api/response-webhook/route.ts`, user impact (post-call analytics never trigger from webhook), fix scope (change #3 or smaller follow-up)
- [ ] **C4** — §1.3 P0 — Response webhook `axios.post('/api/get-call', ...)` relative URL — citation `src/app/api/response-webhook/route.ts:34`, why it fails (no base URL in server context), fix path
- [ ] **C5** — §2 Suspected broken header — define what "suspected" means (static evidence but no runtime verification this audit)
- [ ] **C6** — §2.1 HIGH — `themeColor`/`iconColor` initial-state save-skip bug — `src/app/(client)/interviews/[interviewId]/page.tsx:70-71,97-98,242` — describe the equality-skip + initial-mount logic
- [ ] **C7** — §2.2 HIGH — Silent service errors — quote `console.log(error); return []` pattern from `src/services/interviews.service.ts:12` and 2-3 other examples; user impact (failures invisible to user, candidate UIs may render empty without explanation)
- [ ] **C8** — §2.3 MEDIUM — Hardcoded `https://folo-up.co/` external link in candidate UI — 3 file:line citations
- [ ] **C9** — §2.4 MEDIUM — `(client)/layout.tsx` `"use client"` + `metadata` export contradiction
- [ ] **C10** — §2.5 LOW — `dangerouslyAllowBrowser: true` on server-side OpenAI clients (misuse, not a runtime break)
- [ ] **C11** — §2.6 LOW — `interviewCard.tsx` per-card axios.post('/api/get-call') on mount — N+1 API call pattern on dashboard render
- [ ] **C12** — Cross-reference table: For each entry, name which subsequent change (#2 or #3) is expected to address it, or "smaller follow-up"

## Task group D: ADS-GAP-ANALYSIS.md

- [ ] **D1** — §1 Baseline tokens — extract from `tailwind.config.ts`: color references (all are CSS vars), borderRadius variables, no fontFamily/spacing customization; cite line numbers
- [ ] **D2** — §1 Baseline tokens — extract from `src/app/globals.css`: full HSL palette for light + dark; note that dark mode is defined but `NextThemesProvider` forces `defaultTheme="light"` with no toggle UI
- [ ] **D3** — §1 Baseline tokens — hardcoded color survey: grep `indigo-600|#4F46E5` across `src/`, report count and top file paths; document this as the de-facto brand token that has no CSS-variable representation
- [ ] **D3b** — §1 Baseline tokens — **Brand-color mapping decision for change #2 (BINDING recommendation)**. Document the three possible strategies for migrating `#4F46E5`:
  - **(a) Custom brand-color override** — define a custom ADS brand token (`--ds-brand-bold = #4F46E5`) so existing visual identity is preserved verbatim
  - **(b) Map to nearest ADS blue** — use `color.background.brand.bold` (~`#0C66E4`) and accept the visual shift
  - **(c) Full ADS palette adoption** — drop FoloUp brand color entirely; use Atlassian's blue across the board
  - **Recommendation:** (a) — preserve brand identity while migrating to ADS structure. This is the audit's binding call for change #2; change #2 may override only with explicit operator approval and a rationale in its own proposal.md.
- [ ] **D4** — §1 Baseline tokens — typography/spacing/elevation defaults from Tailwind base (since no overrides exist); document that all values are Tailwind defaults. **Also explicitly note** that opacity and z-index use Tailwind defaults with no custom overrides; flag that ADS z-index/elevation layers are NOT equivalent (different mental model) — change #2 must verify modal/popover stacking when introducing ADS elevation tokens.
- [ ] **D4b** — §1 Baseline tokens — **Motion capture & ADS mapping**. Document current motion state:
  - `tailwind.config.ts` accordion keyframes (`accordion-down`, `accordion-up`, both 0.2s ease-out) — the only custom motion in the codebase
  - `tailwindcss-animate` plugin active (provides Radix-component animations)
  - `framer-motion` installed (~300 KB) but ZERO imports across `src/` — dead dependency
  - Map to ADS motion token categories: `motion.duration.fast/medium/slow`, `motion.easing.incoming/outgoing/standard`
  - Recommendation for change #2: keep `tailwindcss-animate` (compatible with Radix), drop `framer-motion`, replace accordion keyframes with ADS motion-token consumers.
- [ ] **D5** — §2 Atlassian DS target tokens — pull current Atlassian DS token names from public docs (https://atlassian.design/components/tokens); list color, typography, spacing, elevation, border-radius categories with token names and sample values; include fetch date in section header
- [ ] **D6** — §3 Token mapping table — row per current token → ADS target token → migration touch (rename / value-change / no-equivalent / no-touch); flag any "no-equivalent" rows as candidates for custom tokens
- [ ] **D7** — §3 Component blueprint table — for each component family, **list candidate Radix primitives (one or more)** + the ADS tokens each would consume; migration complexity (trivial / moderate / rewrite); change #2 sequencing hint. The audit surfaces candidates only — change #2 makes the architectural call. (Scope discipline: aligns with design.md AD-4 and the "Non-goals" explicit statement.)
  - **Variant granularity rule:** For components with 3+ named variants (e.g., `Button` primary/secondary/ghost/destructive), produce one sub-row per variant in the blueprint table. For components with 1-2 simple variants, list inline in Notes column. Goal: change #2's token assignment table is at the right granularity to drive migration without re-audit.
- [ ] **D8** — §3 Library consolidation — for `@nextui-org/progress`, `@nextui-org/react.CircularProgress`, `@mui/x-charts.PieChart`: name the proposed replacement strategy (Radix primitive, custom build, alternative chart lib); flag dependency removal candidates (`@mui/material`, `framer-motion`, dead shadcn ui/*, `react-color` if ChromePicker is replaced)
- [ ] **D9** — Appendix C: Smells with ADS-migration impact — `dangerouslyAllowBrowser`, `metadata` in client component, hardcoded URLs — items that change #2 should address while refactoring. **Add explicit scope statement:** "Accessibility audit (WCAG AA contrast, ARIA coverage, keyboard navigation, screen-reader compatibility) is **OUT OF SCOPE** for this audit. Change #2's QA checklist MUST include: (1) WCAG AA contrast verification for the recommended brand-color token D3b option (a) against light + dark backgrounds; (2) ARIA attribute coverage audit on every non-Radix interactive surface (custom `Modal` component, ChromePicker integration, etc.); (3) keyboard navigation paths for the candidate interview flow."
- [ ] **D10** — Header on each section: "Source: cgc manifest, fetched `<date>` | Audit version: 1.0"

## Task group E: Cross-cutting

- [ ] **E1** — Create `openspec/changes/index-and-audit-platform/artifacts/` directory
- [ ] **E2** — Add an `INDEX.md` inside `artifacts/` that links to all four deliverables with one-paragraph summaries
- [ ] **E3** — Each artifact's top line: "Audit: index-and-audit-platform · Generated: `<ISO date>` · Read-only · Driving changes #2 (`adopt-atlassian-design-system`) and #3 (`redesign-journey-and-components`)"
- [ ] **E4** — Cross-link: COMPONENT-INVENTORY rows that appear in BROKEN-FEATURES get a `→ see BROKEN-FEATURES §X` note; vice versa
- [ ] **E5** — Cross-link: JOURNEY-MAP routes with broken auth get a `→ see BROKEN-FEATURES §1.1` note
- [ ] **E6** — All artifacts use ATX-style headers (`#`, `##`, `###`), GitHub-flavored Markdown tables, fenced code blocks with language hints

## Definition of done

1. Four files exist under `openspec/changes/index-and-audit-platform/artifacts/`:
   - `COMPONENT-INVENTORY.md`
   - `JOURNEY-MAP.md`
   - `BROKEN-FEATURES.md`
   - `ADS-GAP-ANALYSIS.md`
2. `INDEX.md` exists linking to all four
3. `git diff` since change start shows ONLY files under `openspec/changes/index-and-audit-platform/` (no source edits)
4. QA self-checks (A10, B7) confirm exhaustive coverage
5. Every BROKEN-FEATURES entry has a file:line citation grep can resolve
6. Every ADS-GAP-ANALYSIS §3 row has at least one candidate Radix primitive listed (audit surfaces options; change #2 decides)
