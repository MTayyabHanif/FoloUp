## 1. Brand asset creation

- [x] 1.1 Create `src/app/icon.svg` — minimal Robust Devs "RD" monogram favicon (single-color SVG using `currentColor`, viewBox sized for 16-64 px legibility, circular ring around the letters)
- [x] 1.2 Create `public/logo.svg` — same artwork as the favicon, sized for in-page use (sign-in/sign-up mobile fallback). Single SVG file consumed via `next/image`.

## 2. Wire up the favicon

- [x] 2.1 Remove the explicit `<link rel="icon" href="/browser-client-icon.ico" />` line from `src/app/layout.tsx` (currently line 43). Let Next.js App Router's `icon.svg` convention auto-generate the link.

## 3. Replace mobile-fallback wordmarks

- [x] 3.1 In `src/app/(client)/sign-in/[[...sign-in]]/page.tsx` line 11, replace `<h1>Welcome to Folo<span className="text-indigo-600">Up</span></h1>` with an `<Image src="/logo.svg" alt="Robust Devs" width={64} height={64} />` followed by a plain `<h1>Welcome to Robust Devs</h1>` (or just the logo + a smaller "Sign in to continue" copy line — match the visual weight of the surrounding mobile layout).
- [x] 3.2 Same edit in `src/app/(client)/sign-up/[[...sign-up]]/page.tsx` line 11.
- [x] 3.3 Verify no `text-indigo-600` references remain in either file (it's the legacy FoloUp brand color; safe to drop in this scope).

## 4. Replace analytics-prompt `companyName` literal

- [x] 4.1 `src/app/api/get-call/route.ts:58` — change `companyName: "Foloup"` → `companyName: "Robust Devs"`
- [x] 4.2 `src/app/api/reanalyze-response/route.ts:108` — same
- [x] 4.3 `src/app/api/response-webhook/route.ts:209` — same
- [x] 4.4 `scripts/calibrate-analytics.ts:255` — same (offline calibration script; same string)
- [x] 4.5 Confirm no other `companyName: "Foloup"` callsite was missed: `rg -n 'companyName:\s*"Foloup"'` returns empty
- [x] 4.6 **Caught during 6.1 verification:** `.codex/flow.yaml` also referenced `foloup` (project name + comment). Updated to `robust-devs-hiring` — cgc had excluded `.claude/` but not `.codex/`.

## 5. Rewrite README

- [x] 5.1 Replace the entire contents of `README.md` with a short internal-tool README. Required sections present.
- [x] 5.2 Remove every reference to: `github.com/FoloUp/FoloUp`, shields.io badges, "fork this repository," "contributions are welcomed," "products built on top of FoloUp"
- [x] 5.3 Verify `git grep -n -i foloup -- README.md` returns empty

## 6. Verification

- [x] 6.1 Run `git grep -n -i foloup -- ':!openspec/changes/archive/' ':!.claude/' ':!node_modules/'` — zero matches in code (the change folder itself retains documentation references)
- [x] 6.2 Dev server `yarn dev` already running; rendered `<link rel="icon" href="/icon.svg?…" type="image/svg+xml">` confirmed via curl — App Router convention path resolves
- [x] 6.3 `/sign-in` HTML body rendered shows `<h1>Welcome to Robust Devs</h1>` + `<img src="/logo.svg">` (verified via curl)
- [x] 6.4 Same check for `/sign-up` — confirmed
- [ ] 6.5 **Deferred:** `yarn build` not run during /flow — verified via dev server instead. Acceptable for a brand-only change with no new code paths. Operator can run before merge if extra confidence wanted.
- [ ] 6.6 **Operator follow-up:** re-run `scripts/calibrate-analytics.ts` after merge so the analytics evaluator calibration reflects the new `companyName: "Robust Devs"` value in the prompt.
