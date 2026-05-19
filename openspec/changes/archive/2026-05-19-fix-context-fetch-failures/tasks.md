# Tasks: fix-context-fetch-failures

## Implementation

- [x] **Task 1** — `src/services/interviews.service.ts`: replace the 1 module-level `createClientComponentClient()` call and its import with `import { createClient } from "@supabase/supabase-js"` and `const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`. The 7 functions in the file (`getAllInterviews`, `getInterviewById`, `updateInterview`, `deleteInterview`, `getAllRespondents`, `createInterview`, `deactivateInterviewsByOrgId`) already reference the module-level `supabase` const and need no further change.

- [x] **Task 2** — `src/services/clients.service.ts`: replace the 1 module-level `createClientComponentClient()` call and its import with `import { createClient } from "@supabase/supabase-js"` and the plain `const supabase = createClient(...)`. The 3 functions in the file (`updateOrganization`, `getClientById`, `getOrganizationById`) already reference the module-level `supabase` const and need no further change.

- [x] **Task 3** — `src/services/interviewers.service.ts`: replace the `createClientComponentClient` import with `import { createClient } from "@supabase/supabase-js"`, then replace all 3 function-level fallback expressions (`client ?? createClientComponentClient()`) with `client ?? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)` — one occurrence in each of `getAllInterviewers`, `createInterviewer`, and `getInterviewer`. Keep the `SupabaseClient` import from `@supabase/supabase-js` and the `client?: SupabaseClient` parameter on all three functions.

- [x] **Task 4** — `src/services/responses.service.ts`: replace the 1 module-level `createClientComponentClient()` call and its import with `import { createClient } from "@supabase/supabase-js"` and the plain `const supabase = createClient(...)`. The 8 functions in the file (`createResponse`, `saveResponse`, `getAllResponses`, `getResponseCountByOrganizationId`, `getAllEmailAddressesForInterview`, `getResponseByCallId`, `deleteResponse`, `updateResponse`) already reference the module-level `supabase` const and need no further change.

- [x] **Task 5** — `src/services/feedback.service.ts`: replace the 1 module-level `createClientComponentClient()` call and its import with `import { createClient } from "@supabase/supabase-js"` and the plain `const supabase = createClient(...)`. The 1 function in the file (`submitFeedback`) already references the module-level `supabase` const and needs no further change.

- [x] **Task 6** — `package.json`: remove `@supabase/auth-helpers-nextjs` from dependencies and run `pnpm install` (or `npm install`) to update the lockfile. Confirm with `grep -r "auth-helpers-nextjs" src/` returning no results before removing.

## Verification

- [x] **Task 7** — Run `npx tsc --noEmit` and confirm zero new type errors.

- [x] **Task 8** — Run `npx eslint src/services/` and confirm no new lint violations.

- [x] **Task 9** — Run `grep -r "auth-helpers-nextjs" src/` and confirm no matches.

- [ ] **Task 10** — Start the dev server (`npm run dev` / `pnpm dev`) and open `/dashboard` in the browser. Confirm: no `TypeError: Failed to fetch` in the browser console, and the Network tab shows Supabase queries going to `https://<project>.supabase.co/rest/v1/...`.

- [ ] **Task 11** — Navigate to `/dashboard/interviewers`. Confirm the interviewers list loads without fetch errors.

- [ ] **Task 12** — Navigate to `/dashboard/interviews`. Confirm the interviews list loads without fetch errors.

- [ ] **Task 13** — Navigate to a response detail page for an existing interview (e.g. `/dashboard/interviews/<id>` with `responses.service.ts`-driven panels visible). Confirm response data loads without fetch errors. Covers the `responses.service.ts` and `feedback.service.ts` paths that were proactively patched but not exercised by Tasks 10–12.
