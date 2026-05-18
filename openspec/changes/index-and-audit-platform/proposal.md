# Proposal — index-and-audit-platform

## Why

FoloUp is undergoing a full UX redesign onto the Atlassian Design System. Before any component is rewritten or any user journey is redrawn, we need a complete, evidence-backed inventory of what's actually in the codebase today. The redesign work has been deliberately split into three sequential changes; this is the first.

| # | Change | Status | Output |
|---|---|---|---|
| 1 | **`index-and-audit-platform`** | **this proposal** | 4 read-only audit artifacts |
| 2 | `adopt-atlassian-design-system` | queued | token migration + Radix/Tailwind primitives consuming `@atlaskit/tokens` |
| 3 | `redesign-journey-and-components` | queued | per-route redesign + journey rework + bug fixes |

Without the audit, change #2 will rebuild the wrong primitives and change #3 will miss broken features. The audit is the input contract for both.

## What

Produce four markdown artifacts under `openspec/changes/index-and-audit-platform/artifacts/`:

1. **`COMPONENT-INVENTORY.md`** — every component file, UI library origin, usage count, MATURITY flag (stable / partial / dead-import / orphan-ui), and `interviewer/` subtree probe.
2. **`JOURNEY-MAP.md`** — every route, auth gate, side effects, plus Mermaid happy-path diagrams for (a) recruiter creates → shares interview and (b) candidate completes interview → recruiter reviews.
3. **`BROKEN-FEATURES.md`** — two sections: §1 Confirmed broken, §2 Suspected (static evidence). Each with file:line, evidence snippet, suspected impact, fix path.
4. **`ADS-GAP-ANALYSIS.md`** — three sections: §1 Baseline tokens (current state), §2 Atlassian DS target tokens, §3 Mapping & component blueprint. The originally proposed DESIGN-TOKEN-AUDIT is folded into §1.

## Scope boundaries (hard)

- **Read-only.** No code edits during this change. Token migration and component rewrites are deferred to change #2.
- **No journey rework.** Route additions and middleware fixes are deferred to change #3.
- **No performance profiling, no runtime testing, no browser automation.**
- **No speculative architecture beyond what `ADS-GAP-ANALYSIS §3` requires.**

## Decisions locked at brainstorming

- **ADS strategy:** `@atlaskit/tokens` for design tokens + Radix/Tailwind for component implementation. The gap analysis maps to this target, not to full `@atlaskit/*` component installs.
- **Broken-features bar:** Confirmed + static-evidence suspected. Code smells go into appendices inside `COMPONENT-INVENTORY` or `ADS-GAP-ANALYSIS`, not BROKEN-FEATURES.
- **Journey scope (for change #3):** Visual + auth + route structure. The middleware `/interview(.*)` double-claim and the missing root landing page are in scope for change #3, documented as findings here.
- **Interviewer feature:** Marked PARTIAL — full UI built but `createInterviewerCard.tsx` is unwired ("orphan UI"). Change #2/#3 decides fate.

## Seed findings already established (subset — full list in `BROKEN-FEATURES.md`)

1. `src/middleware.ts` — `/interview(.*)` in both `isPublicRoute` and `isProtectedRoute`; `isProtectedRoute` is dead code; `/interviews/[interviewId]` is publicly accessible (**P0 auth bypass**).
2. `src/app/api/response-webhook/route.ts` — webhook handler not in `isPublicRoute`; Clerk will 401 every Retell callback. Relative URL `/api/get-call` also broken in server context.
3. `src/app/(client)/interviews/[interviewId]/page.tsx` — `themeColor`/`iconColor` ChromePicker has subtle initial-state bug; `apply` button conditional fires only when colors differ, but initial load sets them equal.
4. 40+ `console.error`-only error paths with no user feedback (interviews silently fail).
5. `framer-motion` installed (~300 KB) but zero imports.
6. `@mui/material` installed but never imported (`@mui/x-charts` only used for one PieChart in `summaryInfo.tsx`).
7. `@tanstack/react-query` provider wraps the app but zero `useQuery`/`useMutation` calls exist.
8. 8 shadcn `ui/*` files are dead (carousel, context-menu, form, separator, toggle, toaster, toast, use-toast) — app uses `sonner` for toasts.
9. `createInterviewerCard.tsx` (~223 lines) fully built but never imported into any route.
10. Brand color `#4F46E5` hardcoded in ~40+ class strings instead of being a token.
11. `dangerouslyAllowBrowser: true` set on OpenAI clients in server-only route handlers (meaningless flag in that context).
12. `(client)/layout.tsx` is `"use client"` but exports `metadata` (silently ignored by Next.js App Router).
13. `pdfjs-dist` peer with `pdf-parse` for resume PDF parsing — needs leaf-level inventory.

## Success criteria

- Change #2 author can derive a complete token-migration script and component-swap checklist from `ADS-GAP-ANALYSIS §3` alone, with no further codebase spelunking.
- Change #3 author can read `JOURNEY-MAP.md` + `BROKEN-FEATURES.md` and plan the per-route redesign work without re-auditing.
- A new contributor reading `COMPONENT-INVENTORY.md` can answer "what does X do?" for any component in the repo without grepping.
- Every component file under `src/components/` and every route under `src/app/` appears in the inventory (QA verifies this).
- Every seed finding is reproducible from its file:line citation.

## Out of scope (explicit non-goals)

- Implementing Atlassian DS tokens — change #2
- Rewriting any component to use Atlassian DS — change #2
- Fixing the middleware auth bypass — change #3
- Adding a root landing page — change #3
- Removing dead dependencies — change #2 (during token/library consolidation)
- Reworking the candidate interview journey — change #3
- Database schema changes — out of scope across all three changes (no DB work planned)
