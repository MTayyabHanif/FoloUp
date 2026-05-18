# Design — index-and-audit-platform

## Architecture decisions

### AD-1: Read-only change, markdown-only artifacts
The audit produces only markdown files under `openspec/changes/index-and-audit-platform/artifacts/`. No source code is modified, no dependencies added or removed, no git refactors. This is enforced at `qa` time by checking `git diff` only shows files under that artifact path (plus the standard OpenSpec metadata files).

### AD-2: Four deliverables, not five
The originally proposed DESIGN-TOKEN-AUDIT.md is folded into `ADS-GAP-ANALYSIS.md §1 Baseline tokens`. Rationale: the current token surface is a single shadcn-default CSS-variable block plus hardcoded `indigo-600` references. There is not enough material to justify a standalone artifact.

### AD-3: BROKEN-FEATURES has two confidence tiers
- §1 **Confirmed broken** — operator-named or runtime-evidenced failures. Includes items reproducible from static evidence with high certainty (e.g., `axios.post("/api/get-call", ...)` from inside a server-side route handler — provably broken).
- §2 **Suspected (static evidence)** — items where static analysis flags a likely failure mode but runtime verification wasn't performed.

Code smells (any-types, eslint disables, unused imports) explicitly do NOT go in BROKEN-FEATURES. They go in `COMPONENT-INVENTORY` appendices or `ADS-GAP-ANALYSIS` appendices where contextually relevant.

### AD-4: ADS strategy is `@atlaskit/tokens` + Radix/Tailwind, not full `@atlaskit/*`
The gap analysis maps current primitives to **Radix-buildable equivalents that consume `@atlaskit/tokens` values**. We do NOT install `@atlaskit/button`, `@atlaskit/textfield`, etc. Rationale: lighter bundle, full styling control, keeps the existing Radix surface area, avoids `@emotion`-heavy peer dependencies that the rest of the stack doesn't need.

### AD-5: Manifest is the audit's source of truth
The `cgc` step produced a single index manifest (route table, component table, library census, token state, side-effect map, seed findings, DB schema, open questions). All four artifacts are derived from this manifest. The manifest itself is not a deliverable — its content is sliced across the four artifacts based on audience (change #2 author vs change #3 author vs new contributor).

### AD-6: Mermaid for happy-path flows; tables for everything else
JOURNEY-MAP uses Mermaid sequence diagrams for the two main happy paths. Everything else (route table, component table, token table, mapping table) is markdown tables. Rationale: Mermaid is the right tool for sequenced user journeys; markdown tables are grep-able and diffable for inventories.

### AD-7: Artifacts live under `openspec/changes/index-and-audit-platform/artifacts/`, not the repo root
Keeping artifacts inside the change folder means: (a) they archive cleanly with the rest of the change; (b) future contributors can find them via the OpenSpec convention; (c) no repo-root pollution. After archive, they live at `openspec/changes/archive/<date>-index-and-audit-platform/artifacts/`.

## Audit methodology (for the `apply` step)

### Inputs
1. The `cgc` index manifest (returned in the cgc step's verdict — captured in this proposal's seed findings and tasks.md)
2. The repo file tree under `src/`, `supabase_schema.sql`, `tailwind.config.ts`, `components.json`, `package.json`
3. Public Atlassian Design System token documentation (URL: https://atlassian.design/components/tokens) — for the target-token column of ADS-GAP-ANALYSIS §2

### Methodology per artifact

**COMPONENT-INVENTORY.md**
- One row per file in `src/components/`, `src/components/ui/`, `src/components/call/`, `src/components/dashboard/`, `src/components/loaders/`
- Plus `src/actions/parse-pdf.ts` and other `src/actions/` files (server actions are component-adjacent)
- Columns: Path · Export · UI library · Lines · Used by (top 3) · MATURITY · Notes
- Followed by per-component sections for any component flagged `partial`, `orphan-ui`, or `mixed-library-collision`
- Appendix A: Dead imports (8 shadcn files + framer-motion + @mui/material + @tanstack/react-query usage absence)
- Appendix B: Code smells (any-types, eslint-disables, naming violations) grouped by file

**JOURNEY-MAP.md**
- §1: Route table — every route in `src/app/`, with Auth gate / Side effects / Linked components
- §2: Middleware analysis — annotated diff of `src/middleware.ts` showing the conflict
- §3: Mermaid sequence diagram — Recruiter happy path (sign-in → dashboard → create interview → share link)
- §4: Mermaid sequence diagram — Candidate happy path (open link → start call → complete → recruiter reviews)
- §5: Named missing surfaces (no root landing page, no interviewer creation route wired, no error/not-found pages)
- §6: API route catalog — every `route.ts` with side effects + current auth status

**BROKEN-FEATURES.md**
- §1 Confirmed broken (P0 first, then descending)
  - P0: middleware auth bypass on `/interviews/[interviewId]`
  - P0: response-webhook handler unreachable (Clerk 401)
  - P0: response-webhook handler `axios.post('/api/get-call', ...)` relative URL broken in server context
- §2 Suspected broken (HIGH/MEDIUM/LOW)
  - HIGH: `themeColor`/`iconColor` initial-equality save-skip bug
  - HIGH: silent service errors (40+ console.error returns)
  - MEDIUM: hardcoded `https://folo-up.co/` links in candidate UI
  - MEDIUM: `(client)/layout.tsx` `"use client"` + `metadata` export silently dropped
  - LOW: `dangerouslyAllowBrowser: true` on server-only OpenAI clients
- Each entry: file:line · evidence snippet (≤3 lines) · suspected user impact · recommended fix path · which change addresses (#2 or #3 or smaller follow-up)

**ADS-GAP-ANALYSIS.md**
- §1 Baseline tokens: extracted from `tailwind.config.ts` + `globals.css` + components.json + hardcoded brand color survey
- §2 Atlassian DS target tokens: mapped from public ADS docs — color, typography, spacing, elevation, border-radius
- §3 Mapping & component blueprint:
  - Token mapping table (current name → ADS token name → migration touch)
  - Component blueprint table (current component → recommended Radix primitive + ADS token consumers → migration complexity)
  - Library consolidation table (`@nextui-org/*` and `@mui/x-charts` swap targets)

## Verification

The `qa` step verifies:
1. Every file under `src/components/**` appears in `COMPONENT-INVENTORY.md` (grep + count)
2. Every route file (`page.tsx`, `route.ts`, `layout.tsx`) in `src/app/**` appears in `JOURNEY-MAP.md`
3. Every seed finding from the manifest appears in `BROKEN-FEATURES.md` with a file:line citation that grep can resolve
4. `git diff` since change start shows ONLY files under `openspec/changes/index-and-audit-platform/`
5. All four artifact files are non-empty and have the expected section headers

The `review` step (with requirements-verification addendum) verifies the four success-criteria items from `proposal.md` are met.

## Risks

| Risk | Mitigation |
|---|---|
| Audit goes stale before changes #2/#3 start | Each artifact has a "Fetched on `<date>`" header; reviewers re-verify on consumption |
| Atlassian DS docs change between audit and change #2 | `ADS-GAP-ANALYSIS §2` includes the public docs URL + cached values + fetch date — change #2 re-verifies before token install |
| Cgc manifest missed a component (false negative) | qa step's exhaustive grep over `src/components/**` catches missing rows |
| Operator disagrees with a SUSPECTED finding | Each suspected entry includes the evidence snippet so operator can self-verify and reclassify without re-audit |
| Mixed-UI-library claims aren't reproducible | Every "imports X from Y" claim must cite the source file's import line |

## Non-goals (re-stated for design clarity)

- We are **not** producing a redesign or a migration plan. Those are changes #2 and #3.
- We are **not** picking which Radix primitive replaces NextUI's `CircularProgress` — `ADS-GAP-ANALYSIS §3` *names* candidates, but the call is made in change #2.
- We are **not** verifying every "suspected" finding via runtime testing — that's why they're tagged SUSPECTED.
