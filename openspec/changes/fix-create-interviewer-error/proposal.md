# fix-create-interviewer-error

## The Ask

Fix three compounding bugs that cause `/api/create-interviewer` to silently fail with
`{"error":"Failed to create interviewers"}` and leave the UI stuck in an infinite
loading state on `/dashboard/interviewers`.

## Why

The `Create two Default Interviewers` flow is completely broken for new users:
1. The API route swallows the real error (no argument to `logger.error`), making server-side diagnosis impossible.
2. `interviewers.service.ts` constructs a `createClientComponentClient()` at module load time. When the module is imported inside an API route (server environment), that browser-only client has no cookie context, causing Supabase RLS to reject the insert with an auth error — the most likely root cause of the 500.
3. The button component has no error handling: on any rejection `setIsLoading(false)` is never called, leaving the spinner running forever. Additionally, on success it calls `InterviewerService.getAllInterviewers()` directly (bypassing context), so the new interviewers never appear without a page reload.

## Scope

Three files change; no new dependencies, no schema changes.

| File | Change type |
|------|-------------|
| `src/services/interviewers.service.ts` | Refactor to accept an optional Supabase client parameter |
| `src/app/api/create-interviewer/route.ts` | Pass server-safe client; log the real error |
| `src/components/dashboard/interviewer/createInterviewerButton.tsx` | try/catch/finally + sonner toast + context refresh |

The `InterviewerContext` already exposes `fetchInterviewers` internally; the proposal adds it to the context value shape so the button can call it.

## Acceptance Criteria

- [ ] Clicking "Create two Default Interviewers" completes without infinite spinner whether the call succeeds or fails.
- [ ] On success the interviewer list refreshes automatically without a page reload.
- [ ] On failure a `sonner` toast displays a human-readable error message.
- [ ] The server logs contain the actual error object (Retell SDK error or Supabase error), not just the string `"Error creating interviewers:"`.
- [ ] In non-production environments the API response includes a `details` field with the error message.
- [ ] `tsc --noEmit` passes with no new type errors.
- [ ] `next lint` passes with no new warnings.
- [ ] Manual end-to-end: trigger the create flow in dev, confirm both interviewers appear in the list.
- [ ] Manual error path: disable the Retell API key, trigger the flow, confirm the spinner stops and a toast appears.

## Follow-ups (out of scope for this change)

- `src/app/api/register-call/route.ts` imports `InterviewerService.getInterviewer` and calls it from a server route with no client argument — same latent pattern as the bug being fixed here. Once the service signature accepts an optional client (Task 1), this route still works via the fallback path, but it should be cleaned up in a follow-up change.
- RLS is not enabled on the `interviewer` table in the current schema. If the team wants the route to enforce per-user access, RLS + policies need to be added as a separate change.
