# COMPONENT-INVENTORY.md

> Audit: index-and-audit-platform · Source: cgc manifest, fetched 2026-05-18 · Read-only · Audit version: 1.0

Every file under `src/components/`, `src/contexts/`, `src/services/`, `src/actions/`, `src/lib/`, `src/types/`. The MATURITY column captures whether a surface is **stable** (production-grade), **partial** (built but unfinished), **orphan-ui** (fully built but unused), or **dead-import** (installed/exported but zero consumers).

States legend (interactive-state coverage): `hover` · `focus` · `disabled` · `loading` · `error`. `✓` implemented, `✗` missing, `—` not applicable (non-interactive).

---

## §1 Component layer

### §1.1 Visual / interactive components

| Path | Export | UI library | ~Lines | Used by (top 3) | MATURITY | States | Flags |
|---|---|---|---|---|---|---|---|
| `src/components/call/index.tsx` | `Call` (default) | shadcn/Radix + lucide | 696 | `(user)/call/[id]/page.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | mixed: retell-client-js-sdk, axios, AlertDialog. → see BROKEN-FEATURES §2.2 (console.error on call start failure) |
| `src/components/call/callInfo.tsx` | `CallInfo` (default) | shadcn + **@nextui-org/react** + **@radix-ui direct** | 445 | `(client)/interviews/[id]/page.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | **mixed-library-collision**: imports `CircularProgress` from `@nextui-org/react`; also imports `ScrollArea` directly from `@radix-ui/react-scroll-area` bypassing `src/components/ui/scroll-area.tsx`. → see ADS-GAP §3 |
| `src/components/call/feedbackForm.tsx` | `FeedbackForm` (named) | shadcn | 64 | `call/index.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | clean |
| `src/components/call/tabSwitchPrevention.tsx` | `TabSwitchWarning`, `useTabSwitchPrevention` | shadcn AlertDialog | 64 | `call/index.tsx` | stable | hover:✓ focus:✓ disabled:— loading:— error:— | clean; warns on tab switch during interview |
| `src/components/dashboard/Modal.tsx` | `Modal` (default) | custom (no UI lib) + lucide X | 40 | `interviewCard`, `createInterviewCard`, `sharePopup`, `details`, `interviewerCard` | stable | hover:✓ focus:✗ disabled:— loading:— error:— | **non-Radix custom modal** — bypasses shadcn AlertDialog; accessibility gap (focus trap, escape key handling) → see ADS-GAP §3 + Appendix C |
| `src/components/dashboard/interview/createInterviewCard.tsx` | `CreateInterviewCard` (default) | shadcn Card | 42 | `dashboard/page.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | clean |
| `src/components/dashboard/interview/createInterviewModal.tsx` | `CreateInterviewModal` (default) | orchestrator (no UI lib) | 86 | `createInterviewCard.tsx` | stable | — — — loading:✓ error:✗ | uses custom Modal; orchestrates DetailsPopup → QuestionsPopup |
| `src/components/dashboard/interview/create-popup/details.tsx` | `DetailsPopup` (default) | shadcn (Textarea, Button, Switch, Card) | 359 | `createInterviewModal.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | `axios.post('/api/generate-interview-questions')` call; eslint-disable hooks. → see ADS-GAP Appendix B |
| `src/components/dashboard/interview/create-popup/questions.tsx` | `QuestionsPopup` (default) | shadcn (ScrollArea, Button) | 191 | `createInterviewModal.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | `axios.post('/api/create-interview')`; Clerk useOrganization |
| `src/components/dashboard/interview/create-popup/questionCard.tsx` | `questionCard` (default, lowercase) | shadcn (Card, Button, Tooltip) | 140 | `create-popup/questions.tsx`, `editInterview.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | **naming smell**: lowercase exported function name (React convention violation) |
| `src/components/dashboard/interview/dataTable.tsx` | `DataTable` (default), `TableData` (type) | shadcn Table + @tanstack/react-table | 261 | `summaryInfo.tsx` | stable | hover:✓ focus:✓ disabled:— loading:— error:— | clean; sortable table for responses |
| `src/components/dashboard/interview/editInterview.tsx` | `EditInterview` (default) | shadcn (ScrollArea, Button, Switch, AlertDialog, CardTitle) | 384 | `(client)/interviews/[id]/page.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | inline edit form for an existing interview; delete + update |
| `src/components/dashboard/interview/fileUpload.tsx` | `FileUpload` (default) | custom + react-dropzone + lucide | 103 | `create-popup/details.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | eslint-disable `react-hooks/rules-of-hooks` (hook called in non-component function due to lowercase name). PDF parse via `src/actions/parse-pdf.ts`. |
| `src/components/dashboard/interview/interviewCard.tsx` | `InterviewCard` (default) | shadcn Card | 174 | `dashboard/page.tsx` | stable | hover:✓ focus:✓ disabled:— loading:✓ error:✗ | **side-effectful render**: `axios.post('/api/get-call')` on mount for every unanalyzed response — N+1 API call pattern. → see BROKEN-FEATURES §2.6 |
| `src/components/dashboard/interview/questionAnswerCard.tsx` | `QuestionAnswerCard` (default) | shadcn CardTitle | 30 | `callInfo.tsx` | stable | — — — — — | non-interactive display card |
| `src/components/dashboard/interview/sharePopup.tsx` | `SharePopup` (default) | shadcn (Tabs, Button) + custom Modal | 176 | `(client)/interviews/[id]/page.tsx` | stable | hover:✓ focus:✓ disabled:— loading:— error:— | uses custom Modal (focus-trap gap); generates shareable interview links |
| `src/components/dashboard/interview/summaryInfo.tsx` | `SummaryInfo` (default) | **@mui/x-charts** PieChart + shadcn (Tooltip, ScrollArea) | 355 | `(client)/interviews/[id]/page.tsx` | stable | hover:✓ focus:✓ disabled:— loading:✓ error:✗ | **mixed-library-collision**: MUI PieChart inside shadcn page. Two `PieChart` instances. → see ADS-GAP §3 (PieChart replacement candidates) |
| `src/components/dashboard/interviewer/createInterviewerButton.tsx` | `CreateInterviewerButton` (default) | shadcn Card + lucide | 45 | `dashboard/interviewers/page.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | **only rendered when 0 interviewers exist** — calls `/api/create-interviewer` to bootstrap defaults (Lisa + Bob) |
| `src/components/dashboard/interviewer/createInterviewerCard.tsx` | `createInterviewerCard` (default, lowercase) | shadcn (Card, Slider, Button, ScrollArea, CardTitle) | 223 | **none** | **orphan-ui** | hover:✓ focus:✓ disabled:✓ loading:✓ error:✗ | Full custom-interviewer creation UI built but never imported anywhere; whole-file `eslint-disable react-hooks/rules-of-hooks`. → see Appendix B + JOURNEY-MAP §5 |
| `src/components/dashboard/interviewer/interviewerCard.tsx` | `interviewerCard` (default, lowercase) | shadcn Card + custom Modal | 50 | `dashboard/interviewers/page.tsx` | stable | hover:✓ focus:✓ disabled:— loading:— error:— | eslint-disable hooks; lowercase export; opens InterviewerDetailsModal |
| `src/components/dashboard/interviewer/interviewerDetailsModal.tsx` | `InterviewerDetailsModal` (default) | shadcn (Slider, CardTitle) + react-audio-player | 103 | `interviewerCard.tsx`, `create-popup/details.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | clean; displays interviewer audio sample + slider params |
| `src/components/loaders/loader-with-logo/loaderWithLogo.tsx` | `LoaderWithLogo` (default) | CSS module + next/image | 22 | `createInterviewModal.tsx` | stable | — — — loading:✓ — | clean; full-screen branded loader |
| `src/components/loaders/loader-with-text/loaderWithText.tsx` | `LoaderWithText` (default) | **@nextui-org/progress** CircularProgress | 23 | `(user)/call/page.tsx`, `callInfo.tsx`, `(client)/interviews/[id]/page.tsx` | partial | — — — loading:✓ — | NextUI only for spinner — trivially replaceable with Radix custom or pure CSS. → see ADS-GAP §3 |
| `src/components/loaders/mini-loader/miniLoader.tsx` | `MiniLoader` (default) | CSS module | 11 | `call/index.tsx`, `interviewCard.tsx` | stable | — — — loading:✓ — | inline mini-spinner |
| `src/components/navbar.tsx` | `Navbar` (default) | Clerk OrganizationSwitcher/UserButton + lucide | 39 | `(client)/layout.tsx` | stable | hover:✓ focus:✓ disabled:— loading:— error:— | org-required by usage (requires active Clerk org) |
| `src/components/providers.tsx` | `providers` (default, lowercase) | next-themes + @tanstack/react-query + custom contexts | 32 | both layouts | stable | — — — — — | **NextThemesProvider forces `defaultTheme="light"`** with no toggle UI. QueryClient wraps app but no useQuery calls exist anywhere (dead provider). → see Appendix A. Lowercase export naming smell. |
| `src/components/sideMenu.tsx` | `SideMenu` (default) | lucide | 44 | `(client)/layout.tsx` | stable | hover:✓ focus:✓ disabled:— loading:— error:— | clean; left nav for dashboard |

### §1.2 Primitive (shadcn/ui) layer

| Path | Export | UI library | ~Lines | Used by | MATURITY | States | Flags |
|---|---|---|---|---|---|---|---|
| `src/components/ui/alert-dialog.tsx` | AlertDialog + family | shadcn/Radix `react-alert-dialog` | ~80 | 4 files | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | clean |
| `src/components/ui/avatar.tsx` | Avatar + family | shadcn/Radix | ~30 | `callInfo.tsx` | stable | — — — — — | clean |
| `src/components/ui/button.tsx` | Button + buttonVariants | shadcn/Radix Slot | ~50 | 13+ files | stable | hover:✓ focus:✓ disabled:✓ loading:✗ error:— | variants: default, destructive, outline, secondary, ghost, link |
| `src/components/ui/card.tsx` | Card + family | shadcn | ~60 | 10+ files | stable | — — — — — | non-interactive container |
| `src/components/ui/carousel.tsx` | Carousel + family | shadcn/Radix-icons + embla | 262 | **none** | **dead-import** | — — — — — | installed never used. → see Appendix A |
| `src/components/ui/context-menu.tsx` | ContextMenu + family | shadcn/Radix | 204 | **none** | **dead-import** | — — — — — | → Appendix A |
| `src/components/ui/form.tsx` | Form + family | shadcn/Radix + react-hook-form | 175 | **none** | **dead-import** | — — — — — | → Appendix A |
| `src/components/ui/label.tsx` | Label | shadcn/Radix | ~20 | only `form.tsx` (which is dead) | **dead-import** | — — — — — | → Appendix A |
| `src/components/ui/scroll-area.tsx` | ScrollArea, ScrollBar | shadcn/Radix | ~40 | 5 files | stable | — — — — — | also bypassed by `callInfo.tsx` direct Radix import → cleanup target |
| `src/components/ui/select.tsx` | Select + family | shadcn/Radix | 164 | `(client)/interviews/[id]/page.tsx`, `callInfo.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | clean |
| `src/components/ui/separator.tsx` | Separator | shadcn/Radix | ~20 | **none** | **dead-import** | — — — — — | → Appendix A |
| `src/components/ui/skeleton.tsx` | Skeleton | shadcn | ~10 | `callInfo.tsx` | stable | — — — loading:✓ — | clean |
| `src/components/ui/slider.tsx` | Slider | shadcn/Radix | ~25 | `interviewerDetailsModal.tsx`, `createInterviewerCard.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | clean |
| `src/components/ui/switch.tsx` | Switch | shadcn/Radix | ~25 | 3 files | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | clean |
| `src/components/ui/table.tsx` | Table + family | shadcn | ~60 | `dataTable.tsx` | stable | hover:✓ focus:— disabled:— loading:— error:— | row focus not implemented |
| `src/components/ui/tabs.tsx` | Tabs + family | shadcn/Radix | ~50 | `sharePopup.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:— error:— | clean |
| `src/components/ui/textarea.tsx` | Textarea | shadcn | ~20 | `feedbackForm.tsx`, `details.tsx` | stable | hover:✓ focus:✓ disabled:✓ loading:— error:✗ | no error state styling |
| `src/components/ui/toast.tsx` | Toast + family | shadcn/Radix toast | ~100 | **none** | **dead-import** | — — — — — | app uses `sonner` instead. → Appendix A |
| `src/components/ui/toaster.tsx` | Toaster | shadcn use-toast | ~20 | **none** | **dead-import** | — — — — — | → Appendix A |
| `src/components/ui/toggle.tsx` | Toggle | shadcn/Radix | ~30 | **none** | **dead-import** | — — — — — | → Appendix A |
| `src/components/ui/tooltip.tsx` | Tooltip + family | shadcn/Radix | ~40 | 4 files | stable | hover:✓ focus:✓ disabled:— loading:— error:— | clean |
| `src/components/ui/use-toast.ts` | useToast, toast | shadcn | 194 | only `toaster.tsx` (dead) | **dead-import** | — — — — — | → Appendix A |

### §1.3 Server-action layer

| Path | Export | Library | ~Lines | Used by | MATURITY | Flags |
|---|---|---|---|---|---|---|
| `src/actions/parse-pdf.ts` | `parsePdf` (server action) | `pdf-parse` + `pdfjs-dist` | ~30 | `fileUpload.tsx` | stable | parses uploaded resume PDFs for OpenAI question generation |

---

## §2 Context layer (`src/contexts/`)

| Path | Export | Hook | Used by | Notes |
|---|---|---|---|---|
| `src/contexts/clients.context.tsx` | `ClientProvider`, `useClient` | `useClient()` | `providers.tsx` | upserts user + organization on mount via `ClientService` |
| `src/contexts/interviewers.context.tsx` | `InterviewerProvider`, `useInterviewers` | `useInterviewers()` | `providers.tsx` | reads all interviewers for the org on mount |
| `src/contexts/interviews.context.tsx` | `InterviewProvider`, `useInterviews` | `useInterviews()` | `providers.tsx` | reads all interviews for org+user; exposes `getInterviewById` |
| `src/contexts/responses.context.tsx` | `ResponseProvider`, `useResponses` | `useResponses()` | `providers.tsx` | response-list context (largely unused — only seeded; consumers go direct to `ResponseService`) |

**Note:** All four contexts use `eslint-disable react-hooks/exhaustive-deps` to bypass dep-array warnings. Refactor candidate for change #2.

---

## §3 Service layer (`src/services/`)

| Path | Exports | Backend | Notes |
|---|---|---|---|
| `src/services/analytics.service.ts` | `generateInterviewAnalytics`, `OpenAI` client setup | OpenAI gpt-4o | `dangerouslyAllowBrowser: true` (misuse — server-only). → see BROKEN-FEATURES §2.5 |
| `src/services/clients.service.ts` | `getClientById`, `getOrganizationById`, `updateOrganization` | Supabase `user`, `organization` | `payload: any` — type erasure → see Appendix B |
| `src/services/feedback.service.ts` | `submitFeedback` | Supabase `feedback` | clean |
| `src/services/interviewers.service.ts` | `getInterviewer`, `getAllInterviewers`, `createInterviewer` | Supabase `interviewer` | `payload: any` |
| `src/services/interviews.service.ts` | `getInterviewById`, `getAllInterviews`, `updateInterview`, `deleteInterview`, `deactivateInterviewsByOrgId` | Supabase `interview` | `payload: any` (2 sites); `console.log(error); return []` silent swallow → see BROKEN-FEATURES §2.2 |
| `src/services/responses.service.ts` | `createResponse`, `saveResponse`, `getAllResponses`, `getResponseByCallId`, `deleteResponse`, `updateResponse`, `getResponseCountByOrganizationId`, `getAllEmails` | Supabase `response` | `payload: any` (3 sites); `console.log(error); return []` silent swallow → see BROKEN-FEATURES §2.2 |

---

## §4 Utility/lib layer (`src/lib/` excluding prompts)

| Path | Export | Purpose | Used by (top 3) |
|---|---|---|---|
| `src/lib/compose.tsx` | `compose<T>(...providers)` | Compose React context providers into a single wrapper | `providers.tsx` |
| `src/lib/constants.ts` | `INTERVIEWERS` (Lisa, Bob — defaults), `RETELL_AGENT_GENERAL_PROMPT` template | Static config for default interviewers + Retell LLM prompt | `api/create-interviewer/route.ts`, `lib/prompts/*` |
| `src/lib/enum.tsx` | `OrganizationPlan`, `CandidateStatus`, etc. | TypeScript enums for DB columns | services, components |
| `src/lib/logger.ts` | `logger` (configured pino instance) | Server-side structured logging | API routes (sparingly — most still use `console.error`) |
| `src/lib/utils.ts` | `cn(...inputs)` (clsx + tailwind-merge wrapper) | Tailwind class merger | every component file (~25+) |
| `src/components/dashboard/interviewer/avatars.ts` | `avatars` (array) | Static asset paths for default interviewer avatars | `createInterviewerCard.tsx` (orphan) | **lives under `src/components/` not `src/lib/` but listed here for `.ts` file glob completeness** |

---

## §5 AI prompt library (`src/lib/prompts/`)

| Path | Exported function/const | Consumed by | LLM call type |
|---|---|---|---|
| `src/lib/prompts/analytics.ts` | `SYSTEM_PROMPT`, `getInterviewAnalyticsPrompt(interview, transcript)` | `services/analytics.service.ts` → called from `api/get-call/route.ts` | chat-completion (gpt-4o, structured JSON output) |
| `src/lib/prompts/communication-analysis.ts` | `SYSTEM_PROMPT`, `getCommunicationAnalysisPrompt(transcript)` | `api/analyze-communication/route.ts` | chat-completion (gpt-4o, structured JSON output) |
| `src/lib/prompts/generate-insights.ts` | `SYSTEM_PROMPT`, `getInsightsPrompt(interview, responses)` | `api/generate-insights/route.ts` | chat-completion (gpt-4o, structured JSON output) |
| `src/lib/prompts/generate-questions.ts` | `SYSTEM_PROMPT`, `generateQuestionsPrompt(objective, context)` | `api/generate-interview-questions/route.ts` | chat-completion (gpt-4o, structured JSON output) |

**Change #2 + #3 impact:** No UI implications, but the migration cannot break these contracts. Prompt content stable for change #2. Change #3 may add new prompts if "Conversational Helper" or onboarding-AI features are introduced.

---

## §6 Domain types (`src/types/`)

| Path | Exported type/interface | Notes |
|---|---|---|
| `src/types/database.types.ts` | `Database` (generated Supabase types) | clean — auto-generated |
| `src/types/interview.ts` | `Interview`, `Question` | `details: any` field — type erasure for Retell call object |
| `src/types/interviewer.ts` | `Interviewer` | clean |
| `src/types/organization.ts` | `Organization` | clean |
| `src/types/response.ts` | `Response` | `details: any` AND `analytics: any` — double type erasure |
| `src/types/user.ts` | `User` | clean |

Two `any` fields are change #2's targets when service-layer hardening is in scope.

---

## Appendix A — Dead imports

Installed packages and exported components with zero consumers across `src/`:

| Item | Type | Bundle impact | Status | Recommended disposition |
|---|---|---|---|---|
| `framer-motion` | npm package | ~300 KB ungzipped | 0 imports | Remove during change #2 |
| `@mui/material` | npm package | ~500 KB ungzipped | 0 imports | Remove during change #2 |
| `@mui/x-charts` | npm package | ~250 KB | 1 import (PieChart in `summaryInfo.tsx`) | Keep IF PieChart kept; else remove |
| `@nextui-org/react` | npm package | ~200 KB | 1 import (CircularProgress in `callInfo.tsx`) | Remove during change #2 after Radix replacement |
| `@nextui-org/progress` | npm package | ~80 KB | 1 import (`loaderWithText.tsx`) | Remove during change #2 |
| `@tanstack/react-query` | npm package + QueryClientProvider in `providers.tsx` | ~30 KB | 0 `useQuery`/`useMutation` calls | Remove provider OR adopt — decide change #2/#3 |
| `react-color` | npm package | ~150 KB | 1 import (ChromePicker in `(client)/interviews/[id]/page.tsx`) | Remove if theme-color UI replaced with Radix popover + ADS palette |
| `src/components/ui/carousel.tsx` | shadcn primitive | ~7 KB src | 0 consumers | Delete during change #2 |
| `src/components/ui/context-menu.tsx` | shadcn primitive | ~6 KB src | 0 consumers | Delete |
| `src/components/ui/form.tsx` | shadcn primitive | ~5 KB src | 0 consumers | Delete |
| `src/components/ui/label.tsx` | shadcn primitive | <1 KB src | only by dead `form.tsx` | Delete with form |
| `src/components/ui/separator.tsx` | shadcn primitive | <1 KB src | 0 consumers | Delete |
| `src/components/ui/toggle.tsx` | shadcn primitive | <1 KB src | 0 consumers | Delete |
| `src/components/ui/toast.tsx` | shadcn primitive | ~3 KB src | 0 consumers (app uses `sonner`) | Delete |
| `src/components/ui/toaster.tsx` | shadcn primitive | <1 KB src | 0 consumers | Delete |
| `src/components/ui/use-toast.ts` | shadcn hook | ~6 KB src | only by dead `toaster.tsx` | Delete with toaster |
| `src/components/dashboard/interviewer/createInterviewerCard.tsx` | orphan UI | ~7 KB src | 0 consumers | **DECISION REQUIRED (change #3)**: wire up to enable custom-interviewer feature, or delete |

**Estimated total bundle savings from package removals alone:** ~1.5 MB ungzipped (significant — current bundle is bloated).

---

## Appendix B — Code smells

### B.1 `any` type erasure

| Location | Field | Recommendation |
|---|---|---|
| `src/services/interviews.service.ts:36,79` | `payload: any` on `updateInterview` | Type as `Partial<Interview>` |
| `src/services/responses.service.ts:5,20,113` | `payload: any` on create/save/update | Type as `Partial<Response>` |
| `src/services/clients.service.ts:5` | `payload: any` on `updateOrganization` | Type as `Partial<Organization>` |
| `src/services/interviewers.service.ts:28` | `payload: any` on `createInterviewer` | Type as `Omit<Interviewer, 'id' \| 'created_at'>` |
| `src/types/response.ts:8,13` | `details: any; analytics: any` | Define narrow types from Retell SDK + OpenAI response schema |
| `src/types/interview.ts:32` | `details: any` | Same |
| `src/app/api/response-webhook/route.ts:24` | `call: any` | Type as `Retell.Call` from `retell-sdk` |
| `src/components/call/index.tsx:238` | `handleColorChange` parameter `color: any` | Type as `ColorResult` from `react-color` (or remove if migrating away from react-color) |

### B.2 eslint-disable hooks bypasses

| Location | Pattern | Why |
|---|---|---|
| `src/components/dashboard/interviewer/interviewerCard.tsx:13` | `// eslint-disable react-hooks/rules-of-hooks` | Lowercase function name `interviewerCard` fails React component detection |
| `src/components/dashboard/interview/fileUpload.tsx:26` | same | Lowercase doesn't apply but `useDropzone` called outside component boundary |
| `src/components/dashboard/interviewer/createInterviewerCard.tsx:1` | `/* eslint-disable react-hooks/rules-of-hooks */` whole file | Lowercase function name |
| `src/contexts/*.tsx` (all 4) | `// eslint-disable react-hooks/exhaustive-deps` | dep array warnings suppressed; refactor candidate |
| `src/app/(client)/interviews/[interviewId]/page.tsx` | same | dep array suppressed in 2 useEffects |
| `src/app/(client)/dashboard/page.tsx` | same | dep array suppressed |

### B.3 Lowercase-exported components (React convention violation)

- `src/components/dashboard/interview/create-popup/questionCard.tsx` — `questionCard` (should be `QuestionCard`)
- `src/components/dashboard/interviewer/createInterviewerCard.tsx` — `createInterviewerCard` (and the file is orphan-ui)
- `src/components/dashboard/interviewer/interviewerCard.tsx` — `interviewerCard` (should be `InterviewerCard`)
- `src/components/providers.tsx` — `providers` (should be `Providers`)

**Impact:** React DevTools shows these as lowercase entries, React rules-of-hooks linter fails (triggering the eslint disables in B.2). Rename during change #2.

### B.4 Console-only error handling

40+ locations across services and components use `console.error` or `console.log` as the only error path. Full list deferred to BROKEN-FEATURES §2.2. Pattern is structural — fix via a shared error-toast helper in change #2 or #3.

### B.5 Server-side `dangerouslyAllowBrowser: true` (OpenAI client misconfiguration)

- `src/app/api/analyze-communication/route.ts:27`
- `src/app/api/generate-insights/route.ts:28`
- `src/app/api/generate-interview-questions/route.ts:17`
- `src/services/analytics.service.ts:37`

This flag is a no-op in a Node.js / Edge runtime (it only suppresses a browser warning). Misleading; remove in change #2.

---

## §A.10 QA self-check

Coverage verification commands (used by Step 7 qa):

```sh
# Total source files in inventoried directories
find src/components src/contexts src/services src/actions src/lib src/types \
    -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l
# Expected: 76 (50 components + 4 contexts + 6 services + 1 action + 9 lib (incl. prompts) + 6 types)
# Verified 2026-05-19: 76 ✓

# Path resolution check: every Path column citation in this file must resolve to an actual file
grep -oE 'src/[a-zA-Z0-9/_.-]+\.(ts|tsx)' COMPONENT-INVENTORY.md | sort -u | \
    while read p; do test -f "/Users/tayyab/Projects/foloup/$p" || echo "MISSING: $p"; done
# Expected output: empty (no missing paths)
```
