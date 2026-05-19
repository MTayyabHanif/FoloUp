# Design — fix-create-interviewer-error

## 1. Service Layer Refactor — Parameter Injection

**Decision:** accept an optional `supabase` client parameter on each function rather than splitting into separate server/client modules.

**Rationale:**
- All five service files (`interviewers`, `interviews`, `clients`, `responses`, `feedback`) share the same `createClientComponentClient()` module-level pattern. Parameter injection fixes the immediate bug in one file without forcing a codebase-wide split right now.
- Query logic stays in one place; callers simply pass the right client.
- Less diff surface than a split-module approach, easier to review and revert.

**Pattern:**

```ts
// Before
const supabase = createClientComponentClient();   // module-level, browser-only

const createInterviewer = async (payload) => { ... }

// After
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

const createInterviewer = async (
  payload: ...,
  client?: SupabaseClient,
) => {
  const supabase = client ?? createClientComponentClient();
  ...
}
```

The module-level `const supabase` is removed. Each function creates its own fallback client when no argument is provided. Existing client-side callers (context, components) continue to work with zero changes because the parameter is optional.

## 2. Server-Safe Supabase Client in the Route

**Decision (revised during QA):** use `createClient(url, anonKey)` from `@supabase/supabase-js` directly, not the auth-helpers `createRouteHandlerClient`.

**Original plan:** `createRouteHandlerClient({ cookies })` from `@supabase/auth-helpers-nextjs`.

**Why it was changed:** the original plan crashed at runtime on Next.js 16 with `TypeError: nextCookies.get is not a function`. The `@supabase/auth-helpers-nextjs@^0.8.7` package was written for Next.js 13's synchronous `cookies()` API; Next.js 14+ made `cookies()` return a Promise, breaking the synchronous `.get()` access inside the helper. The package is deprecated in favor of `@supabase/ssr`, which would be a larger dependency add for a bug fix.

**Why `createClient` from supabase-js works here:**
- The `interviewer` table has no RLS policies (confirmed via `supabase_schema.sql`), so the route does not need an authenticated user session to insert.
- The two interviewers being created (`Lisa`, `Bob`) are system defaults, not user-scoped data.
- `@supabase/supabase-js@^2.48.1` is already in the dependency graph — no new package needed.
- This sidesteps the cookies API mismatch entirely.

**Usage in the route:**

```ts
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
  // pass supabase to InterviewerService calls
}
```

If a future change adds RLS to the `interviewer` table, this route will need to be revisited — at that point migrate to `@supabase/ssr` and the `createServerClient` pattern.

## 3. Error Response Shape

Keep the existing production shape (`{ error: "Failed to create interviewers" }`) unchanged so clients don't break. Add a `details` field gated on `NODE_ENV`:

```ts
return NextResponse.json(
  {
    error: "Failed to create interviewers",
    ...(process.env.NODE_ENV !== "production" && {
      details: error instanceof Error ? error.message : String(error),
    }),
  },
  { status: 500 },
);
```

Also fix the logger call: `logger.error("Error creating interviewers:", error)`.

## 4. Error UX on the Frontend — Sonner

**Library in use:** `sonner` — confirmed via grep across all component files. Import: `import { toast } from "sonner"`.

No new library to install. The `<Toaster />` component is already present in the app shell (standard sonner setup).

**Pattern for the button:**

```ts
const createInterviewers = async () => {
  setIsLoading(true);
  try {
    await axios.get("/api/create-interviewer");
    fetchInterviewers();           // context refresh (see §5)
    toast.success("Interviewers created successfully");
  } catch (err) {
    const message =
      axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Failed to create interviewers";
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};
```

## 5. Context Refresh — fetchInterviewers

**Current state:** `InterviewerContext` (`src/contexts/interviewers.context.tsx`) defines `fetchInterviewers` as a local async function inside `InterviewerProvider` but does **not** expose it in the context value or in the `InterviewerContextProps` interface. `createInterviewer` in the context calls `fetchInterviewers()` fire-and-forget, but `createInterviewerButton.tsx` bypasses the context entirely (calls `InterviewerService.getAllInterviewers()` directly).

**Design:**
1. Add `fetchInterviewers: () => Promise<void>` to the `InterviewerContextProps` interface.
2. Include `fetchInterviewers` in the `<InterviewerContext.Provider value={...}>` spread.
3. Update `createInterviewerButton.tsx` to call `fetchInterviewers` from `useInterviewers()` on success instead of the bare service call.
4. The `React.createContext<InterviewerContextProps>({...})` default value must also receive a `fetchInterviewers: async () => {}` no-op alongside the interface change, or TypeScript will reject the default object.

This is a one-line addition to the interface and one additional property in the provider value — minimal churn, correct data flow.

## 6. Observability note — RLS is not enabled

The `interviewer` table in `supabase_schema.sql` has no `ENABLE ROW LEVEL SECURITY` directive and no policies. That means an unauthenticated Supabase client should still be able to insert (anon-key writes are permitted by default for tables without RLS).

This weakens the "browser client in a server route" diagnosis as the *active* failure mode — the `createClientComponentClient` call is still a latent bug (it will throw or misbehave in some Next.js server environments), but the actual 500 today is more likely upstream at the Retell SDK step (`retellClient.llm.create`, `retellClient.agent.create`). The proposed fix is still correct and ships both improvements:

- Logger fix immediately exposes the real error after deploy — required regardless of root cause.
- Server-safe client removes a latent crash even if it isn't the active one.

The team should observe the next failure after deploy (server logs + dev `details` field) before concluding the Retell flow is the persistent cause.
