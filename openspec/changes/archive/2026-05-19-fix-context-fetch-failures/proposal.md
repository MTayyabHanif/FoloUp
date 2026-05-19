# Proposal: fix-context-fetch-failures

## The Ask

Replace all uses of `createClientComponentClient()` from the deprecated `@supabase/auth-helpers-nextjs` package across five service files with the plain `createClient(url, key)` API from `@supabase/supabase-js`.

## The Problem

Four `TypeError: Failed to fetch` errors are thrown from React context providers on every page load in the current Next.js 16 / Turbopack environment:

1. `getAllInterviews` (interviews.service.ts:22) ← `fetchInterviews` (interviews.context.tsx:39)
2. `getClientById` (clients.service.ts:31) ← `fetchClient` (clients.context.tsx:30)
3. `getOrganizationById` (clients.service.ts:78) ← `fetchOrganization` (clients.context.tsx:45)
4. `getAllInterviewers` (interviewers.service.ts:14) ← `fetchInterviewers` (interviewers.context.tsx:38)

### Root Cause

`@supabase/auth-helpers-nextjs@^0.8.7` is unmaintained and incompatible with Next.js 16 + Turbopack. Three of the five service files call `createClientComponentClient()` at module level. In Turbopack's client-bundle build, `process.env.NEXT_PUBLIC_*` variables are not yet resolved at module-init time when routed through the auth-helpers wrapper, producing a Supabase client initialised with an empty URL. Every subsequent query issues a `fetch` against the page origin (e.g. `fetch("/rest/v1/interviews")`) rather than the Supabase API host, which fails with `TypeError: Failed to fetch`.

The two remaining service files (`responses.service.ts`, `feedback.service.ts`) use the same module-level pattern and will fail identically once their code paths are exercised.

## Scope

Five service files require changes:

| File | Current pattern | Change |
|---|---|---|
| `src/services/interviews.service.ts` | 1 module-level call | Replace import + const |
| `src/services/clients.service.ts` | 1 module-level call | Replace import + const |
| `src/services/interviewers.service.ts` | 3 function-level fallback calls | Replace import + all 3 fallbacks |
| `src/services/responses.service.ts` | 1 module-level call | Replace import + const |
| `src/services/feedback.service.ts` | 1 module-level call | Replace import + const |

One optional cleanup task: remove `@supabase/auth-helpers-nextjs` from `package.json` once no imports remain (prevents re-introduction of the broken wrapper).

## Acceptance Criteria

1. `tsc --noEmit` passes with zero new type errors after changes.
2. `eslint src/services/` reports no new lint violations.
3. `grep -r "auth-helpers-nextjs" src/` returns no matches after all five files are patched.
4. Development server starts without `TypeError: Failed to fetch` errors in the browser console on:
   - `/dashboard` (triggers `fetchClient` and `fetchOrganization` from clients.context)
   - `/dashboard/interviewers` (triggers `fetchInterviewers` from interviewers.context)
   - `/dashboard/interviews` (triggers `fetchInterviews` from interviews.context)
5. Network tab confirms queries go to `https://<project>.supabase.co/rest/v1/...`, not `/rest/v1/...`.
6. (Optional) `package.json` no longer lists `@supabase/auth-helpers-nextjs` as a dependency.

## Non-Goals

- No auth model changes. The app does not use RLS today; the anon key is appropriate.
- No migration to `@supabase/ssr`. That is a separate decision tracked independently.
- No changes to context files, hooks, or UI components.
