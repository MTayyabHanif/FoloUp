# Tasks — fix-create-interviewer-error

## Implementation

- [x] 1. `src/services/interviewers.service.ts` — Remove module-level `const supabase = createClientComponentClient()`. Add optional `client?: SupabaseClient` parameter to `getAllInterviewers`, `createInterviewer`, and `getInterviewer`; each function creates its own `createClientComponentClient()` fallback when `client` is not supplied.

- [x] 2. `src/contexts/interviewers.context.tsx` — Add `fetchInterviewers: () => Promise<void>` to the `InterviewerContextProps` interface and include `fetchInterviewers` in the `<InterviewerContext.Provider>` value object. Also update the `React.createContext<InterviewerContextProps>({...})` default value object to include `fetchInterviewers: async () => {}` so the default matches the interface (otherwise TypeScript will reject the default object).

- [x] 3. `src/app/api/create-interviewer/route.ts` — Construct a server-safe Supabase client at the top of the `GET` handler and pass `supabase` as the second argument to both `InterviewerService.createInterviewer(...)` calls. Fix the logger call to `logger.error("Error creating interviewers:", error)`. Update the catch block to return `details` when `NODE_ENV !== "production"`. (Implementation note: used `createClient` from `@supabase/supabase-js` instead of the originally-planned `createRouteHandlerClient` — see design.md §2 for the runtime-incompatibility rationale.)

- [x] 4. `src/components/dashboard/interviewer/createInterviewerButton.tsx` — Add `import { useInterviewers } from "@/contexts/interviewers.context"` and `import { toast } from "sonner"`. The component does not currently call `useInterviewers()`, so first call `const { fetchInterviewers } = useInterviewers()` at the top of the component, then wrap `axios.get(...)` in try/catch/finally: `setIsLoading(false)` moves to `finally`; on success call `fetchInterviewers()` and `toast.success("Interviewers created successfully")`; on catch call `toast.error(message)` with the error text extracted from the Axios response or a fallback string. Remove the bare `InterviewerService.getAllInterviewers()` call.

## Verification

- [x] 5. Run `npx tsc --noEmit` from the project root — expect zero new type errors. (passed clean)

- [x] 6. Run `npx eslint` on the 4 changed files — expect zero new warnings or errors. (Note: `next lint` is deprecated in Next.js 16; ran ESLint directly. Passed clean.)

- [~] 7. Manual happy path: start dev server, navigate to `/dashboard/interviewers`, click "Create two Default Interviewers", confirm spinner disappears, confirm both interviewers appear in the list without a page reload, confirm success toast appears. (BLOCKED in local QA: dev env's Supabase reachability yielded `fetch failed`; structural fix is verified by curl probe — operator must repeat on a properly-configured env.)

- [x] 8. Manual error path (verified via curl probe of `/api/create-interviewer` against running dev server): API returned a structured 500 JSON body with the `details` field surfacing the real underlying error message (`createInterviewer existence check failed: TypeError: fetch failed`), confirming (a) the logger receives the error object, (b) the dev-only `details` channel is functioning, and (c) the route handler no longer crashes at module load. Frontend behavior under this error path is verified by static review: try/catch/finally guarantees `setIsLoading(false)`, sonner `toast.error()` displays the message extracted from `err.response.data.error`.

- [ ] 9. (Original intent: restore valid `RETELL_API_KEY`.) N/A — task 8 was not done by tampering with the Retell key; it was verified via a curl probe that intentionally exercises the error path via the existing env configuration.
