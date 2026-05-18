# BROKEN-FEATURES.md

> Audit: index-and-audit-platform · Source: cgc manifest, fetched 2026-05-19 · Read-only · Audit version: 1.0

Two confidence tiers. **§1 Confirmed** = operator-named OR static evidence with high certainty (broken at runtime, reproducible from code-reading). **§2 Suspected** = static evidence flags a likely failure but runtime verification wasn't done in this audit.

Code smells (any-types, eslint disables, unused imports) are NOT here. They live in `COMPONENT-INVENTORY.md` Appendix B and `ADS-GAP-ANALYSIS.md` Appendix C where they belong.

---

## §1 Confirmed broken

### §1.1 [P0] Auth bypass — `/interviews/[interviewId]` publicly accessible

| Field | Detail |
|---|---|
| File | `src/middleware.ts` |
| Lines | 3–13 (`isPublicRoute`), 15–18 (`isProtectedRoute`), 20–24 (function body) |
| Evidence | ```isPublicRoute = createRouteMatcher([..., "/interview(.*)", ...])```<br/>```isProtectedRoute = createRouteMatcher([..., "/interview(.*)"])```<br/>```clerkMiddleware(async (auth, req) => { if (!isPublicRoute(req)) { await auth.protect(); } })``` |
| Mechanism | `/interview(.*)` claimed by both matchers. Middleware function only consults `isPublicRoute`, so any path matching `/interview` is treated as public. `isProtectedRoute` declaration is dead code. |
| User impact | The recruiter's interview detail page at `/interviews/[interviewId]` — which displays candidate responses, transcripts, AI analytics, theme settings, and contains delete/edit controls — is **accessible without authentication** to anyone who has or guesses an interview ID. `nanoid` IDs are guessable in bulk via brute force; even without guessing, IDs leak via shared candidate links (the candidate sees the share URL `/call/[interviewId]` which is the same UUID base). |
| Severity rationale | **P0** — production security issue, candidate data exposed, no authentication required. |
| Recommended fix | Remove `/interview(.*)` from `isPublicRoute` (only `/call(.*)` should be public for the candidate flow). Delete the unused `isProtectedRoute` declaration. Verify the recruiter UI still works for authenticated sessions and the candidate UI at `/call/[interviewId]` remains public. |
| Addressed by | **Change #3** |
| Cross-ref | → JOURNEY-MAP §1, §2 finding 1+2 |

### §1.2 [P0] Response webhook unreachable — Clerk 401s every Retell callback

| Field | Detail |
|---|---|
| File | `src/middleware.ts` + `src/app/api/response-webhook/route.ts` |
| Lines | `middleware.ts` 3–13 (matcher list omits `/api/response-webhook`); `response-webhook/route.ts` entire file |
| Evidence | `/api/response-webhook` is NOT listed in `isPublicRoute`. Therefore `auth.protect()` runs on every request. Retell does not send Clerk session cookies, so every webhook callback returns 401 before the route handler executes. The handler's own `Retell.verify(signature, body, key)` signature-check logic exists but never runs. |
| User impact | The intended automation — Retell fires this endpoint when a call ends, which would trigger OpenAI analytics and update the response row — never fires. As a result, response analytics ONLY trigger when a recruiter manually opens `/interviews/[interviewId]` (which loops `axios.post('/api/get-call')` per unanalyzed response). Recruiters see "Pending analysis" indefinitely if they don't open the page. |
| Severity rationale | **P0** — core feature (automatic analytics) silently broken. |
| Recommended fix | Add `/api/response-webhook(.*)` to `isPublicRoute`. Keep the `Retell.verify` signature check as the actual gate. Fix §1.3 simultaneously (both are needed for the webhook to be functional). |
| Addressed by | **Change #3** |
| Cross-ref | → JOURNEY-MAP §6 row 8, §1.3 below |

### §1.3 [P0] Webhook relative URL — server-side fetch will fail

| Field | Detail |
|---|---|
| File | `src/app/api/response-webhook/route.ts` |
| Lines | ~34 (the `axios.post` call inside the handler) |
| Evidence | ```ts<br/>await axios.post("/api/get-call", { id: call.call_id });<br/>``` |
| Mechanism | Relative URLs require a base. In a server-side route handler (Node/Edge runtime), `axios` has no base URL and the request will throw with `connect ECONNREFUSED` or similar. Even if §1.2 is fixed, this would still fail. |
| User impact | Same as §1.2 — webhook can't trigger downstream analytics. |
| Severity rationale | **P0** — bug in the dependency chain for automatic analytics; blocks §1.2's fix from being useful. |
| Recommended fix | Use absolute URL via `process.env.NEXT_PUBLIC_LIVE_URL` or `process.env.VERCEL_URL`. Better: factor the get-call logic into a shared function and call it directly (no internal HTTP roundtrip) — saves a network hop and avoids URL gymnastics. |
| Addressed by | **Change #3** (or smaller follow-up scoped to webhook fixes) |
| Cross-ref | → §1.2 |

---

## §2 Suspected broken (static evidence only)

### §2.1 [HIGH] `themeColor` / `iconColor` initial-state save-skip bug

| Field | Detail |
|---|---|
| File | `src/app/(client)/interviews/[interviewId]/page.tsx` |
| Lines | 70–71 (initial state), 97–98 (overwrite from DB), 240–250 (apply handler) |
| Evidence | ```ts<br/>const [themeColor, setThemeColor] = useState<string>("#4F46E5");<br/>const [iconColor, seticonColor] = useState<string>("#4F46E5");  // misleading alias<br/>...<br/>setThemeColor(response.theme_color ?? "#4F46E5");<br/>seticonColor(response.theme_color ?? "#4F46E5");<br/>// later, in apply handler<br/>if (themeColor !== iconColor) {<br/>  // save<br/>}<br/>``` |
| Mechanism | Two states (`themeColor` and `iconColor` — both track the same DB column with confusingly different names) initialize to the same value and are overwritten with the same value on mount. The apply handler only saves when they differ — but on initial load they're equal, and the ChromePicker updates only `themeColor` on user interaction, never `iconColor`. So the FIRST apply works (after a change). Then a second apply with NO further change *also* works (because states are now permanently desynced). But navigating away and back resets both to DB value (equal again), making the first attempted save look "skipped" if the user doesn't change the color. **Net effect:** UX is confusing; some saves silently no-op. |
| User impact | Theme color customization is unreliable — sometimes saves, sometimes doesn't, with no error feedback to user. Brand customization feature partially broken. |
| Recommended fix | Refactor to single source of truth: one `themeColor` state, save on every committed change (`onChangeComplete` callback of ChromePicker, not `onChange`). Delete `iconColor`. Add user-visible save confirmation toast on success. |
| Addressed by | **Change #3** (during interview-detail-page redesign) — also consider replacing `react-color` ChromePicker with a Radix popover + curated brand-palette swatches consuming ADS tokens. |
| Cross-ref | → COMPONENT-INVENTORY §1.1 |

### §2.2 [HIGH] Silent service errors — `console.log(error); return []` pattern

| Field | Detail |
|---|---|
| Files | `src/services/interviews.service.ts`, `src/services/responses.service.ts`, others |
| Sample evidence | ```ts<br/>// interviews.service.ts ~line 12<br/>try { ... } catch (error) {<br/>  console.log(error);<br/>  return [];<br/>}<br/>``` and ```ts<br/>// responses.service.ts ~lines 10, 27<br/>console.log(error);<br/>return [];<br/>``` |
| Other locations (sample) | `src/app/(client)/dashboard/page.tsx:53,82` · `src/app/(client)/interviews/[interviewId]/page.tsx:101,123,138,170,192,212` (6 separate catches) · `src/components/call/index.tsx:287` (`.catch(console.error)` on `webClient.startCall`) |
| Pattern | 40+ locations across services, contexts, components, and route handlers use `console.error` or `console.log` as the only error handling. Failures are invisible to users and difficult to debug in production. Services typed to return arrays return `[]` on error, masking failure as "empty result." |
| User impact | (a) Dashboard sometimes shows empty interview lists when the DB query failed — indistinguishable from "no interviews yet." (b) Interview detail page silently leaves states unchanged on save failure. (c) Most critically: candidate's `webClient.startCall(...)` failure in `src/components/call/index.tsx:287` is logged-only, so a failed call connection just hangs the candidate UI with no error message. |
| Recommended fix | Add a shared `errorToast(err, fallbackMessage)` helper using `sonner` (already in the app). Replace all `console.error`/`console.log` error paths with the helper. Services should re-throw or return a `Result<T, Error>` instead of `[]`. Critical: candidate-facing error paths (webClient, register-call) must show a visible error and offer retry. |
| Addressed by | **Change #2** (during service-layer hardening when `any` types are removed) and **Change #3** (component-level error states). |
| Cross-ref | → COMPONENT-INVENTORY Appendix B.4 |

### §2.3 [MEDIUM] Hardcoded `https://folo-up.co/` external link

| Field | Detail |
|---|---|
| Files | `src/app/(user)/call/[interviewId]/page.tsx:37, 71`, `src/components/call/index.tsx:680` |
| Evidence | ```tsx<br/><a href="https://folo-up.co/">...</a><br/>``` in three places in candidate-facing UI |
| User impact | Branding link is hardcoded. If the company changes domains (e.g., `foloup.com`), every candidate UI breaks the link silently. Also: production already runs at `https://foloup.com` according to README cues — the candidate is being linked to a different domain. |
| Recommended fix | Pull from `process.env.NEXT_PUBLIC_MARKETING_URL` with sensible default. Add to `.env.example`. |
| Addressed by | **Change #3** (or smaller follow-up) |

### §2.4 [MEDIUM] `(client)/layout.tsx` has `"use client"` + `metadata` export

| Field | Detail |
|---|---|
| File | `src/app/(client)/layout.tsx` |
| Lines | 1 (`"use client"`), 15–32 (metadata object) |
| Evidence | The file declares `"use client"` at line 1 AND exports `const metadata = { title: ..., description: ... }`. In Next.js App Router, `metadata` is ONLY processed in Server Components. The export is silently dropped. |
| User impact | The `(client)` route group has no `<title>` or `<meta>` tags — search engines and link previews don't see useful metadata for any client-route page. The `(user)` group works correctly because its layout is server-side. |
| Recommended fix | Either (a) consolidate to a single root `src/app/layout.tsx` (server-side) that defines metadata, with `(client)` layout as a child that only does the client-side providers, or (b) move metadata to a separate `src/app/(client)/layout.metadata.ts` consumed by Next.js. Option (a) is cleaner and also fixes the dual-ClerkProvider issue. |
| Addressed by | **Change #3** (root layout consolidation) |
| Cross-ref | → JOURNEY-MAP §1.1, §5 |

### §2.5 [LOW] `dangerouslyAllowBrowser: true` on server-side OpenAI clients

| Field | Detail |
|---|---|
| Files | `src/app/api/analyze-communication/route.ts:27`, `src/app/api/generate-insights/route.ts:28`, `src/app/api/generate-interview-questions/route.ts:17`, `src/services/analytics.service.ts:37` |
| Evidence | ```ts<br/>const openai = new OpenAI({ apiKey: ..., dangerouslyAllowBrowser: true });<br/>``` in route handlers and a service. |
| User impact | Zero runtime impact — flag is a no-op outside a browser context. But it's misleading: a future contributor reading these files might assume the OpenAI key is somehow safe to expose to clients, or that these are client-side calls. Misconfiguration smell. |
| Recommended fix | Remove the flag from all four locations. |
| Addressed by | **Change #2** (during service-layer cleanup) |

### §2.6 [LOW] `interviewCard.tsx` per-card axios call on dashboard mount

| Field | Detail |
|---|---|
| File | `src/components/dashboard/interview/interviewCard.tsx` |
| Pattern | Each interview card fetches its own response list, then for each unanalyzed response, fires `axios.post('/api/get-call', { id: response.call_id })`. With N interview cards, M responses per card, this is up to N×M concurrent OpenAI-triggering POSTs on dashboard load. |
| User impact | Dashboard loads slowly. Burns OpenAI quota every time the recruiter visits `/dashboard`. Can trigger rate limits at scale. |
| Recommended fix | Move analytics triggering off the dashboard render path entirely. Once §1.2 + §1.3 are fixed, the webhook handles this automatically. As an interim fix, batch the analytics call (single endpoint accepting an array of call_ids) and only fire on demand. |
| Addressed by | **Change #3** (after webhook fixes in §1.2/§1.3 land) |
| Cross-ref | → §1.2 (webhook is the proper trigger) |

### §2.7 [LOW] `/api/get-call` and `/api/generate-interview-questions` overly public

| Field | Detail |
|---|---|
| Files | `src/middleware.ts:9, 12` |
| Evidence | Both routes appear in `isPublicRoute`. |
| User impact | Anyone with a known call_id can re-trigger expensive OpenAI analytics on `/api/get-call`. Anyone (no auth needed) can call `/api/generate-interview-questions` which burns the project's OpenAI quota. Not a security issue per se — no destructive writes outside response/interview rows the caller already has IDs for — but a cost-leakage concern. |
| Recommended fix | Move both to recruiter-protected tier (per JOURNEY-MAP §6.1). Use middleware org check + rate limit. |
| Addressed by | **Change #3** (during API auth-tier consolidation) |

### §2.8 [LOW] `(client)/dashboard` plan-enforcement loops on every render

| Field | Detail |
|---|---|
| File | `src/app/(client)/dashboard/page.tsx` |
| Lines | ~30–80 (effect block that checks response count vs allowed count and bulk-deactivates) |
| Evidence | On every dashboard mount (and every dep change), the page reads `responseCount` and `allowed_responses_count`, and if exceeded, calls `deactivateInterviewsByOrgId`. If the DB count is stable, the deactivation effectively runs on every re-mount. |
| User impact | Repeated bulk-update writes when the user navigates the dashboard. Minor DB load, but unnecessary. |
| Recommended fix | Guard the deactivation behind a "has this org's plan already been enforced this session?" flag, or move to a cron / route protected by feature flag. |
| Addressed by | **Change #3** (or smaller follow-up) |

### §2.9 [LOW] Interviewer feature is PARTIAL — `createInterviewerCard.tsx` is orphan UI

| Field | Detail |
|---|---|
| File | `src/components/dashboard/interviewer/createInterviewerCard.tsx` |
| Evidence | 223 lines of fully built UI for creating a custom interviewer (sliders for empathy/exploration/rapport/speed, name/description fields, audio sample upload). Imported by **no file** in the app. `CreateInterviewerButton.tsx` (the one that IS wired) only bootstraps the two default agents (Lisa + Bob) via `/api/create-interviewer`. |
| User impact | The product appears to advertise custom interviewer creation (component exists with full UI) but the feature is non-functional from the user's perspective. Either the feature was de-scoped or never finished wiring. |
| Recommended fix | Operator decision in change #3: (a) wire up the UI on `dashboard/interviewers/page.tsx` and finish the feature (likely needs a new API route `/api/create-custom-interviewer` and a Retell agent-creation flow), or (b) delete the file. |
| Addressed by | **Change #3** decision required |

---

## §3 Cross-reference: which change addresses what

| Entry | Change # | Priority |
|---|---|---|
| §1.1 Auth bypass | #3 | P0 — must fix before any public marketing push |
| §1.2 Webhook 401 | #3 | P0 — core feature broken |
| §1.3 Webhook relative URL | #3 | P0 — needed for §1.2 |
| §2.1 themeColor save bug | #3 | HIGH — user-facing customization broken |
| §2.2 Console-only errors | #2 (services) + #3 (UI) | HIGH — invisible failures everywhere |
| §2.3 Hardcoded marketing URL | #3 or follow-up | MEDIUM |
| §2.4 Layout metadata bug | #3 | MEDIUM — SEO + link-preview impact |
| §2.5 `dangerouslyAllowBrowser` | #2 | LOW — cleanup |
| §2.6 N+1 dashboard analytics calls | #3 (after webhook fix) | LOW — performance/cost |
| §2.7 Over-public API routes | #3 | LOW — cost-leakage |
| §2.8 Plan enforcement loop | #3 or follow-up | LOW |
| §2.9 Orphan interviewer UI | #3 decision | DECISION REQUIRED |

---

## §4 What's NOT a broken feature (smells redirected to other docs)

- `any`-typed service payloads → COMPONENT-INVENTORY Appendix B.1
- eslint-disable hooks-rule bypasses → COMPONENT-INVENTORY Appendix B.2
- Lowercase-exported components (React convention) → COMPONENT-INVENTORY Appendix B.3
- `framer-motion` installed but unused, `@mui/material` installed but unused, 8 dead shadcn ui/* files, dead `@tanstack/react-query` provider → COMPONENT-INVENTORY Appendix A
- Hardcoded `#4F46E5` brand color → ADS-GAP-ANALYSIS §1, §3
- Dark mode CSS defined but disabled → ADS-GAP-ANALYSIS §1, §3
