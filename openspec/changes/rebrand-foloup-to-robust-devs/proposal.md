## Why

A prior rebrand change (archived `2026-05-19-rebrand-foloup-to-robust-devs-hiring`) swapped most user-facing FoloUp strings to Robust Devs but left four categories untouched: the README (still full OSS framing for the upstream fork), the sign-in / sign-up mobile-fallback wordmarks, four `companyName: "Foloup"` literals that flow into the analytics LLM prompt, and the favicon + logo assets (the prior change deleted `public/FoloUp.png` without supplying a replacement and never replaced the favicon). With the app about to go public under the Robust Devs identity, these surviving references are now the only inconsistencies left.

## What Changes

- **README.md** — full rewrite. Strip upstream-fork OSS framing (shields.io badges, `github.com/FoloUp/FoloUp` URLs, fork instructions, "products built on FoloUp", contributor section) and replace with a minimal Robust Devs internal-tool README (purpose, dev setup, env vars, deploy notes). **BREAKING** for external-facing perception only; no code paths depend on README content.
- **Sign-in / sign-up mobile fallback** — replace the `Welcome to Folo<span>Up</span>` text wordmark in `src/app/(client)/sign-in/[[...sign-in]]/page.tsx:11` and `src/app/(client)/sign-up/[[...sign-up]]/page.tsx:11` with an `<Image>` rendering the new Robust Devs logo SVG. Also strips the legacy `text-indigo-600` brand-color reference (already a stranded color outside the migrated valley-green token palette).
- **Analytics company-name literal** — replace `companyName: "Foloup"` with `"Robust Devs"` in `src/app/api/get-call/route.ts:58`, `src/app/api/reanalyze-response/route.ts:108`, `src/app/api/response-webhook/route.ts:209`, and `scripts/calibrate-analytics.ts:255`. Each value is interpolated into the analytics evaluator LLM prompt at `src/lib/prompts/analytics.ts:158` (`"You are a hiring evaluator for a … role at ${companyName}."`), so this directly affects how the LLM frames evaluations.
- **Favicon** — generate a simple, minimal SVG monogram for the Robust Devs mark and ship it as the favicon. Add it via the Next.js App Router convention: `src/app/icon.svg` (modern browsers) and update the explicit `<link rel="icon" href="/browser-client-icon.ico" />` in `src/app/layout.tsx:43` to point at the new asset (or remove the explicit link and let App Router conventions handle it).
- **Logo** — generate the same SVG monogram as a reusable logo asset (`public/logo.svg`) consumed by the sign-in/sign-up mobile wordmarks. The sidebar tooltip / footer / error pages already use a text-based "Robust Devs" presentation — those are out of scope for the SVG logo and stay as text.
- **No changes** to `src/app/layout.tsx` metadata (already "Robust Devs"), no changes to footer / sidebar / error pages (already migrated), no changes to package.json (already `robust-devs-hiring-app`), no changes to any spec capability requirements.

## Capabilities

### New Capabilities

None — this is a brand-asset and string change, not a new product capability.

### Modified Capabilities

None — no spec-level requirements change. The behavior of every capability (interview access control, candidate session, recruiter workspace, etc.) is unchanged. Only the brand strings and visual mark are updated.

## Impact

- **Code touched:** 6 source files (2 sign-in/up pages + 4 analytics callsites including 1 script) + 1 layout file (favicon link) + README + 1 new asset file (`public/logo.svg`) + 1 new favicon file (`src/app/icon.svg`).
- **APIs / contracts:** No public API changes. The analytics LLM prompt receives `"Robust Devs"` instead of `"Foloup"` — this is a soft-content change that may slightly shift LLM outputs but does not alter the schema, request, or response.
- **Dependencies:** None added. Logo + favicon are inline SVG.
- **Systems:** None. No env vars, no database migrations, no cloud-resource renames.
- **Risk:** Low. Changes are localized; only the analytics-prompt change has a behavioral surface, and it's a single-word substitution inside an existing prompt template that already accepts company-name parameterization.
- **Out of scope:** Logo redesign beyond a minimal SVG monogram; PNG/ICO asset set; OG image replacement (deferred — current state has no OG image and that's acceptable for an internal tool); the case-mismatch bug between `loaderWithLogo.tsx` requesting `/loading-time.png` and the file being `Loading-Time.png` (separate issue).
