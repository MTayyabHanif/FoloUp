# Design — redesign-journey-and-components

## Architecture decisions

### AD-1: Smart server-side redirect at `/`
`src/app/page.tsx` is a server component calling Clerk's `auth()` helper. Redirects: signed-in → `/dashboard`, signed-out → `/sign-in`. Avoids a full marketing page (out of scope) and avoids making `/sign-in` the naked root (bad SEO and future-marketing-flexibility).

### AD-2: react-query adopted for fetching contexts only
`interviews` and `interviewers` contexts use `useEffect`-based fetching today — high-traffic, cache-friendly. Migrating both to `useInterviewsQuery`/`useInterviewersQuery` unlocks proper loading/error states and cache invalidation. `responses` (mutation-only) and `clients` (single user record, low traffic) stay as plain contexts — migrating them buys nothing.

Wave 4 also moves `QueryClient` instantiation inside `Providers` via `useState(() => new QueryClient())` (Next.js App Router SSR safety).

### AD-3: Webhook handler uses in-process service calls
The audit flagged `axios.post("/api/get-call", ...)` from inside a server handler — relative URLs don't resolve. Replacement: call `generateInterviewAnalytics` and `ResponseService.saveResponse` directly. Eliminates the broken URL, the network roundtrip, and one Clerk-auth crossing per analysis event.

### AD-4: Retell signature uses `req.text()` raw body, not `JSON.stringify(req.body)`
In Next.js App Router route handlers, `req.body` is a `ReadableStream`, not the parsed JSON. `JSON.stringify(req.body)` produces `"{}"` or `"undefined"` depending on internal state — the HMAC will never match. Fix: `await req.text()` to get raw body, verify signature against that, then `JSON.parse` for the typed data.

### AD-5: Services re-throw, UI catches and toasts
Services (interviews, responses, interviewers, clients) currently swallow errors with `console.log; return []`. The `[]` fallback masks failures as "no data" and makes silent UX failures pervasive.

New pattern:
- Services let DB errors propagate (`if (error) throw new Error(...)`).
- UI callers wrap in `try/catch`, call `toastError(err, fallback)`.
- Services do NOT toast themselves — they run server-side too (route handlers); only client-side callers should reach for sonner.

The one exception: `ResponseService.createResponse` in the candidate flow returns `null` on failure (not throw), because a failed response insert shouldn't crash the active call. Caller shows visible error + retry.

### AD-6: Layout consolidation
- New `src/app/layout.tsx` (server component, exports `metadata`, renders `<html><body>` with single `ClerkProvider`)
- `src/app/(client)/layout.tsx` becomes a `"use client"` child: only Providers + Navbar + SideMenu + sonner Toaster (NO `<html>`/`<body>`, NO ClerkProvider, NO metadata)
- `src/app/(user)/layout.tsx` becomes a server child: only Providers + sonner Toaster (NO `<html>`/`<body>`, NO ClerkProvider, NO metadata)

Fixes BROKEN-FEATURES §2.4 (`"use client"` + `metadata` silent drop). Removes the dual-ClerkProvider divergence risk.

### AD-7: Dark mode toggle in Navbar
`Providers` already wires `NextThemesProvider`. The toggle is a `Sun/Moon` button in `Navbar` using `useTheme()` to flip `light`/`dark`. No system-preference detection added in this wave — keep deterministic. `defaultTheme` stays `light` (changing default mid-cycle would surprise existing users).

### AD-8: Single `error.tsx` at root + `(user)/error.tsx` for candidate UX
Root catches all unhandled errors with branded fallback + "Back to dashboard" CTA. `(user)/error.tsx` catches candidate-flow errors with a different CTA (no dashboard link — they're not employees). Both consume brand tokens; no design churn.

### AD-9: Loading skeletons on the two heavy routes only
`(client)/dashboard/loading.tsx` and `(client)/interviews/[interviewId]/loading.tsx`. These are the slowest data-fetch surfaces. Not adding `loading.tsx` for `(user)/call/[interviewId]` — the candidate flow has its own `LoaderWithText` already.

## Risks

| Risk | Mitigation |
|---|---|
| Layout consolidation breaks Clerk org context | Single ClerkProvider at root wraps both groups; manually test sign-in→dashboard flow before Wave 3 commit |
| Removing `/interview(.*)` from `isPublicRoute` blocks legitimate `/interviews/<id>` link sharing | The recruiter view at `/interviews/<id>` SHOULD require auth — that's the audit's whole point. Candidate link is `/call/<id>` (still public). |
| react-query SSR hydration mismatch | `QueryClient` moved inside provider via `useState(() => …)` — standard Next App Router pattern |
| `req.text()` consumes the body, can't re-parse | Read raw text into a local `rawBody` variable; parse with `JSON.parse(rawBody)` after signature verify |
| themeColor save toast might be too noisy | Only toast on successful change-of-value; not on initial render or repeated clicks of the same swatch |
| `NEXT_PUBLIC_LIVE_URL` missing https:// scheme (flagged by brainstorm) | Wave 1 webhook fix bypasses this entirely; other callers still affected — flagged in commit, not fixed in this change |

## Non-goals

- Visual redesign of any surface (change #2 covered that)
- Mobile-optimized layouts
- Full marketing landing page
- Accessibility deep audit
- Test infrastructure (Playwright/Storybook) — not added in this change
