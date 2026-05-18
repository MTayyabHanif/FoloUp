# Tasks — redesign-journey-and-components

5 waves, each commits independently and must `yarn build` green.

## Wave 1 — Auth + webhook P0 fixes

- [ ] **W1.1** `src/middleware.ts`: remove `/interview(.*)` from `isPublicRoute`; add `/api/response-webhook(.*)` to `isPublicRoute`; delete unused `isProtectedRoute` declaration entirely
- [ ] **W1.2** `src/app/api/response-webhook/route.ts`:
  - Read raw body via `await req.text()` BEFORE signature verify
  - Verify signature against rawBody string (not `JSON.stringify(req.body)`)
  - `JSON.parse(rawBody)` for typed payload after verify
  - Replace `axios.post("/api/get-call", ...)` with direct calls to `generateInterviewAnalytics` + `ResponseService.saveResponse`
  - Remove `axios` import; type `call` precisely
- [ ] **W1.3** Verify: `yarn build` green; commit message notes that auth bypass + webhook are now functional

## Wave 2 — Error infrastructure

- [ ] **W2.1** Create `src/lib/toast-error.ts`: `toastError(err, fallback)` + `toastSuccess(message)` helpers using sonner
- [ ] **W2.2** Create `src/app/error.tsx` (root) — branded fallback with retry + "Back to dashboard" CTA
- [ ] **W2.3** Create `src/app/(user)/error.tsx` — candidate-appropriate fallback (no dashboard link)
- [ ] **W2.4** Create `src/app/not-found.tsx` — branded 404
- [ ] **W2.5** Create `src/app/(client)/dashboard/loading.tsx` — Skeleton-based loading state
- [ ] **W2.6** Create `src/app/(client)/interviews/[interviewId]/loading.tsx` — Skeleton-based loading state
- [ ] **W2.7** Refactor `src/services/interviews.service.ts`: re-throw instead of `console.log; return []` (~3 sites)
- [ ] **W2.8** Refactor `src/services/responses.service.ts`: re-throw on errors (~6 sites); EXCEPT `createResponse` which returns `null` on failure (candidate flow)
- [ ] **W2.9** Refactor `src/services/interviewers.service.ts`: re-throw
- [ ] **W2.10** Refactor `src/services/clients.service.ts`: re-throw
- [ ] **W2.11** Refactor `src/services/feedback.service.ts`: re-throw
- [ ] **W2.12** Refactor `src/services/analytics.service.ts`: re-throw
- [ ] **W2.13** Update all UI callers in `dashboard/page.tsx`, `interviews/[interviewId]/page.tsx`, `call/index.tsx`, `editInterview.tsx`, `details.tsx`, `questions.tsx`, etc. — wrap service calls in `try/catch` + `toastError`
- [ ] **W2.14** Verify: `grep -rn "console\.error\|console\.log(error)" src/services/` = 0; `yarn build` green

## Wave 3 — Layout consolidation + dark mode toggle

- [ ] **W3.1** Create `src/app/layout.tsx` (server component):
  - `<html lang="en">`, `<body>`
  - Single `<ClerkProvider>` wraps children
  - Export `metadata` with FoloUp title/description
  - Import the global CSS
- [ ] **W3.2** Strip `src/app/(client)/layout.tsx` to a child layout:
  - Remove `<html>`, `<body>`, `<ClerkProvider>`, `metadata` export
  - Keep `"use client"`, Providers, Navbar, SideMenu, sonner Toaster
- [ ] **W3.3** Strip `src/app/(user)/layout.tsx` similarly (server component; just Providers + Toaster)
- [ ] **W3.4** Add dark-mode toggle to `src/components/navbar.tsx`:
  - `Sun`/`Moon` lucide icon button
  - Uses `useTheme()` from next-themes
  - Toggles `light`/`dark`
- [ ] **W3.5** Verify: dev server walkthrough — sign-in→dashboard, theme persists, Navbar OrgSwitcher works; `yarn build` green

## Wave 4 — themeColor + react-query + orphan delete

- [ ] **W4.1** `src/app/(client)/interviews/[interviewId]/page.tsx`: single `themeColor` state (delete `iconColor`); `handleColorChange` saves on every committed value change; show `toastSuccess("Theme color updated")` on success
- [ ] **W4.2** Move `QueryClient` instantiation inside `Providers`: `const [queryClient] = useState(() => new QueryClient())`
- [ ] **W4.3** Create `src/hooks/useInterviewsQuery.ts`: react-query hook (queryKey scoped by userId + orgId; enabled when both present)
- [ ] **W4.4** Create `src/hooks/useInterviewersQuery.ts`: react-query hook (queryKey scoped by userId)
- [ ] **W4.5** Update consumers of `useInterviews()`:
  - `src/app/(client)/dashboard/page.tsx`
  - `src/app/(client)/interviews/[interviewId]/page.tsx`
  - `src/components/dashboard/interview/summaryInfo.tsx` (if it calls `useInterviews`)
  - `src/components/dashboard/interview/editInterview.tsx`
  - `src/components/dashboard/interview/create-popup/details.tsx`
  - `src/components/dashboard/interview/create-popup/questions.tsx`
- [ ] **W4.6** Update consumers of `useInterviewers()`:
  - `src/app/(client)/dashboard/interviewers/page.tsx`
- [ ] **W4.7** Optionally remove `InterviewProvider` + `InterviewerProvider` from `Providers` tree (or leave as thin wrappers around the hooks — decide based on caller density)
- [ ] **W4.8** `git rm src/components/dashboard/interviewer/CreateInterviewerCard.tsx`
- [ ] **W4.9** Verify: `yarn build` green; `grep -rln "useInterviews\\b\\|useInterviewers\\b" src/` shows only the new hook files (and any context callers replaced)

## Wave 5 — Smart redirect + final QA

- [ ] **W5.1** Create `src/app/page.tsx` (server component): use Clerk `auth()`; redirect to `/dashboard` if signed-in, else `/sign-in`
- [ ] **W5.2** Remove the `next.config.js` redirect from `/` → `/dashboard` (now handled by `page.tsx`)
- [ ] **W5.3** Final QA:
  - `yarn build` green
  - `yarn tsc --noEmit` clean
  - `grep -rn "console\.error\|console\.log(error)" src/services/` = 0
  - `grep -rn "indigo-" src/` = 0
  - Auth verify: hit `/interviews/<id>` unauthenticated → redirects to `/sign-in`
  - Dark mode toggle works and persists
- [ ] **W5.4** Commit message records that all 3 changes' deferred items are now resolved

## Definition of done (whole change)

1. 5 commits in order: W1, W2, W3, W4, W5 (any commit independently revertible)
2. `yarn build` green at each commit
3. All audit-flagged P0 broken features functionally resolved
4. Root layout consolidated; metadata exports work
5. Dark mode toggle visible and functional
6. react-query in place for interviews + interviewers
7. Orphan `CreateInterviewerCard.tsx` deleted
8. `src/app/page.tsx` exists with smart redirect
9. Audit Appendix C accessibility deferral honored (no a11y deep audit; only Radix-built-in semantics inherited)
