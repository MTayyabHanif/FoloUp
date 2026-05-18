# Proposal — redesign-journey-and-components

## Why

Change #3 of 3 in FoloUp's redesign initiative. Closes out the audit's deferred items:

| # | Change | Status |
|---|---|---|
| 1 | `index-and-audit-platform` | ✓ Archived |
| 2 | `adopt-atlassian-design-system` | ✓ Archived (commits fd183bd…678254b) |
| 3 | **`redesign-journey-and-components`** | **this proposal** |

Fixes the P0 broken features identified by the audit (auth bypass, webhook unreachable, webhook URL bug), establishes error-handling infrastructure the design system can't provide on its own, consolidates the routing/layout structure, fixes the themeColor save-skip bug, adopts react-query, deletes orphan UI, and adds the missing root landing surface.

## What — 5 waves, each one revertible commit

| Wave | Scope | Closes |
|---|---|---|
| 1 — Auth + webhook P0 | `middleware.ts` (remove `/interview` from public, add webhook), `response-webhook/route.ts` (in-process call + `req.text()` signature fix) | BROKEN-FEATURES §1.1, §1.2, §1.3 |
| 2 — Error infrastructure | `src/lib/toast-error.ts`, root `error.tsx` + `not-found.tsx` + group `loading.tsx`, refactor 40+ service `console.error` sites to re-throw | §2.2 silent failures + named missing surfaces |
| 3 — Layout consolidation + dark mode toggle | Root `src/app/layout.tsx` (server + single ClerkProvider + metadata), strip both group layouts to children, dark-mode toggle button in Navbar | §2.4 metadata bug + audit decision |
| 4 — themeColor + react-query + orphan delete | Single-state themeColor + save toast, react-query adoption for interviews+interviewers, delete `CreateInterviewerCard.tsx` | §2.1 + audit deferrals |
| 5 — Smart redirect at `/` + final QA | `src/app/page.tsx` redirect (signed-in → /dashboard, else → /sign-in), final QA pass | §5 named missing surfaces |

## Binding decisions (from brainstorm — see design.md AD-1 through AD-7)

1. Landing = smart server-side redirect at `/` (signed-in → `/dashboard`, else → `/sign-in`)
2. react-query adopted for `interviews` + `interviewers` only (the data-fetching contexts); responses/clients stay as plain contexts
3. `CreateInterviewerCard.tsx` deleted (zero callers; needs backend that doesn't exist)
4. `toastError(err, fallback)` API — 2-param helper; services re-throw, UI callers toast
5. Root `error.tsx` + a `(user)/error.tsx` for candidate flow (different UX); root `not-found.tsx`; loading skeletons on dashboard + interview detail
6. Services re-throw on DB errors (no `Result<T>`, no silent `return []`)
7. Webhook handler now calls `generateInterviewAnalytics` + `ResponseService` directly (no HTTP roundtrip)

## Out of scope

- No new features beyond what the audit named
- No additional design tokens (Wave 2 uses the change #2 tokens as-is)
- No accessibility deep audit (deferred per audit Appendix C; spot-checks via Radix-built-in only)
- No mobile-specific surface work
- No marketing landing page (Wave 5 = redirect only; full marketing is its own product surface)

## Success criteria

- `yarn build` green at every wave commit boundary
- Auth bypass closed: unauthenticated GET on `/interviews/<id>` redirects to sign-in
- Retell webhook returns 200 for valid signature on `/api/response-webhook`
- `grep -rn "console\.error" src/services/` = 0
- No layouts export `metadata` from a `"use client"` file
- `src/app/page.tsx` exists and redirects correctly
- Dark mode toggle visible in Navbar; theme persists across refresh
- `useInterviewsQuery` / `useInterviewersQuery` hooks exist; old context-based consumers updated
- `CreateInterviewerCard.tsx` removed; build still green
