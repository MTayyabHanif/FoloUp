# Design: fix-context-fetch-failures

## Architecture Decision 1 — Which Supabase client API

**Decision:** Use `createClient(url, key)` from `@supabase/supabase-js` directly.

**Rationale:**

The codebase already resolved this question once in the prior /flow run for `src/app/api/create-interviewer/route.ts`. That route handler was failing for the same reason (auth-helpers wrapper + Turbopack) and was fixed by switching to `createClient`. It has been running cleanly in production since.

`@supabase/ssr` was considered but rejected:
- It requires cookie/header plumbing for session propagation, which is only meaningful when RLS is active.
- The codebase does not use RLS today, so the only correct security posture either way is the anon key. Introducing `@supabase/ssr` would add complexity with zero security benefit.
- This keeps the diff minimal and reviewable — one search-and-replace pattern across five files.

## Architecture Decision 2 — Module-level vs factory function

**Decision:** Prefer module-level `const supabase = createClient(...)` for the four files that currently use a module-level const. Retain the per-call `client ?? createClient(...)` fallback pattern in `interviewers.service.ts`.

**Rationale for module-level:**

The Turbopack failure is caused by `createClientComponentClient()`'s construction-time side effects inside `@supabase/auth-helpers-shared`: it instantiates a `BrowserCookieAuthStorageAdapter` (with `jose` imports and cookie plumbing) and raises a hard error if the env vars are empty at call time. Plain `createClient` from `@supabase/supabase-js` performs no such initialization — it just stores the URL/key on a lightweight client object — so it is immune to that initialization path entirely. Module-level construction is safe because `NEXT_PUBLIC_*` vars are statically inlined into the bundle at build time by Next.js before the module executes, so the `!` non-null assertion is a literal string at runtime.

```ts
// Correct pattern for these service files
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

A factory function (`getSupabase()`) would also work but adds indirection without benefit for these files. If eng review prefers it, it can be applied uniformly — it is a mechanical change either way.

**Rationale for retaining `interviewers.service.ts` per-call pattern:**

`interviewers.service.ts` has an `optional client?: SupabaseClient` parameter introduced in the previous change to let route handlers (like `create-interviewer`) pass an explicit authenticated client. That injection point is still used by `src/app/api/create-interviewer/route.ts` and must be preserved. The fallback simply swaps `createClientComponentClient()` → `createClient(url, key)`.

## Architecture Decision 3 — Remove auth-helpers-nextjs from package.json

**Decision:** Yes, remove it — as a final task, after all five service files no longer import it.

**Rationale:** The package is unmaintained against Next.js 16. Leaving it installed is a silent footgun: any developer who sees it in `node_modules` might re-introduce it as a reference. Removing it after the import sweep makes re-introduction a compile error rather than a runtime surprise. The removal is a single `package.json` edit + lockfile update and carries no risk.

## Data Flow — No Change

All five services remain client-component services called from React context providers. The Supabase client they use changes from a broken wrapper to a working plain client. Request routing, error handling, and return types are all unchanged.

```
Context provider
  └─ service function
       └─ supabase.from("table").select(...)   ← same query shape
            └─ fetch("https://<project>.supabase.co/rest/v1/...")   ← now correct
```

## Files Touched

```
src/services/interviews.service.ts       (import + 1 module-level const)
src/services/clients.service.ts          (import + 1 module-level const)
src/services/interviewers.service.ts     (import + 3 function-level fallbacks)
src/services/responses.service.ts        (import + 1 module-level const)
src/services/feedback.service.ts         (import + 1 module-level const)
package.json                             (remove auth-helpers-nextjs)
```
