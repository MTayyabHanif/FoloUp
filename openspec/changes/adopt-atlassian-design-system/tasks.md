# Tasks — adopt-atlassian-design-system

4 waves. Each wave ends with one git commit. Wave N+1 starts only after wave N is verified green.

---

## Wave 1 — Token foundation

- [ ] **W1.1** — `yarn add @atlaskit/tokens` (verify ^2.1.0 or latest)
- [ ] **W1.2** — Rewrite `tailwind.config.ts` per cgc manifest:
  - Keep all existing `extend.colors` keys (border, input, ring, etc.)
  - Add `extend.colors.brand = { bold, bolder, subtle, subtlest }` mapping to `var(--ds-brand-*)`
  - Update accordion `animation` to use `var(--ds-motion-duration-medium)` + `var(--ds-motion-easing-standard)`
  - Keep both plugins (`tailwindcss-animate`, `tailwind-scrollbar-hide`)
- [ ] **W1.3** — Rewrite `src/app/globals.css` per cgc manifest:
  - Keep all existing shadcn `:root` and `.dark` HSL variables (untouched in wave 1)
  - Add `--ds-brand-bold/bolder/subtle/subtlest` to both `:root` and `.dark` (use **hex fallback first**, then `@supports (color: oklch(0 0 0))` block with OKLCH override — per eng-review C4 gamut-mapping fidelity concern)
  - Add `--ds-link-default: var(--ds-brand-bold)` to both `:root` and `.dark` (per design-review D2 — distinct link token even if value equals brand-bold initially; lets change #3 introduce prose links cleanly)
  - Add `--ds-motion-duration-fast/medium/slow` and `--ds-motion-easing-incoming/outgoing/standard` to both blocks
  - Add `--ds-shadow-raised/overflow/overlay` to both blocks
  - Collapse the duplicate `@layer base { * ... body ... }` block into one
- [ ] **W1.3b** — Brand-color fallback structure:
  ```css
  :root {
    --ds-brand-bold:     #4F46E5;   /* hex fallback */
    --ds-brand-bolder:   #3730A3;
    --ds-brand-subtle:   #EDE9FE;
    --ds-brand-subtlest: #F5F3FF;
  }
  @supports (color: oklch(0 0 0)) {
    :root {
      --ds-brand-bold:     oklch(54% 0.27 273);
      --ds-brand-bolder:   oklch(45% 0.27 273);
      --ds-brand-subtle:   oklch(91% 0.06 273);
      --ds-brand-subtlest: oklch(97% 0.02 273);
    }
  }
  ```
  Same structure for `.dark` block.
- [ ] **W1.4** — Add `NEXT_PUBLIC_MARKETING_URL=https://folo-up.co` to `.env.example`
- [ ] **W1.5** — Verify: `yarn build` succeeds; `grep -c "ds-brand-bold" src/app/globals.css` returns at least 4 (2 fallback + 2 oklch overrides); WCAG AA contrast spot-check: `#4F46E5` on `#FFFFFF` ≈ 4.6:1 (passes for large text; small text needs `--ds-brand-bolder` `#3730A3` ≈ 8.2:1); dark mode: `oklch(65% 0.22 273)` on `hsl(222.2 84% 4.9%)` ≈ 5.0:1 (passes AA) — document result in commit message
- [ ] **W1.6** — Verify: `yarn dev` shows existing UI visually unchanged (no consumer yet uses brand utilities)
- [ ] **W1.7** — Commit: `feat(design-system): add @atlaskit/tokens foundation + ADS CSS variables`

## Wave 2 — Primitives

- [ ] **W2.1** — `yarn add @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-dropdown-menu @radix-ui/react-radio-group @radix-ui/react-checkbox @radix-ui/react-accordion`
- [ ] **W2.2** — MIGRATE `src/components/ui/alert-dialog.tsx` — overlay `bg-black/80` → `bg-black/50`; content add `shadow-[var(--ds-shadow-overlay)]`
- [ ] **W2.3** — MIGRATE `src/components/ui/avatar.tsx` — fallback `bg-muted` → `bg-secondary` (trivial)
- [ ] **W2.4** — MIGRATE `src/components/ui/button.tsx` — `default` variant `bg-primary` → `bg-brand-bold text-white hover:bg-brand-bolder`; `link` variant `text-primary` → `text-[--ds-link-default] hover:underline` (uses link token, NOT brand-bold directly — per design-review D2); focus ring `focus-visible:ring-ring` → `focus-visible:ring-[--ds-brand-bold]`
- [ ] **W2.5** — MIGRATE `src/components/ui/card.tsx` — `rounded-xl border bg-card shadow` → `rounded-lg border bg-card shadow-[var(--ds-shadow-raised)]`
- [ ] **W2.6** — MIGRATE `src/components/ui/scroll-area.tsx` — scrollbar thumb `bg-border` → `bg-[var(--ds-brand-subtle)]`
- [ ] **W2.7** — MIGRATE `src/components/ui/select.tsx` — content popover add `shadow-[var(--ds-shadow-overflow)]`; focus ring `focus:ring-ring` → `focus:ring-[--ds-brand-bold]`
- [ ] **W2.8** — MIGRATE `src/components/ui/skeleton.tsx` — `bg-primary/10` → `bg-secondary animate-pulse`
- [ ] **W2.9** — MIGRATE `src/components/ui/slider.tsx` — `bg-indigo-600` (line 21) → `bg-brand-bold`
- [ ] **W2.10** — MIGRATE `src/components/ui/switch.tsx` — `data-[state=checked]:bg-indigo-600` (line 14) → `data-[state=checked]:bg-brand-bold`; focus ring update
- [ ] **W2.11** — MIGRATE `src/components/ui/table.tsx` — header row `bg-muted/50` → `bg-secondary/50`; add `focus-visible` on `tr` for keyboard nav
- [ ] **W2.12** — MIGRATE `src/components/ui/tabs.tsx` — update focus ring to `--ds-brand-bold`
- [ ] **W2.13** — MIGRATE `src/components/ui/textarea.tsx` — add `data-[error=true]:border-destructive data-[error=true]:ring-destructive/20`; focus ring update
- [ ] **W2.14** — MIGRATE `src/components/ui/tooltip.tsx` — `TooltipContent bg-primary` → `bg-[#1e2832] text-white`; add `shadow-[var(--ds-shadow-overflow)]`
- [ ] **W2.15** — CREATE `src/components/ui/input.tsx` per cgc manifest spec (native `<input>` styled, forwardRef, ADS tokens for border/focus)
- [ ] **W2.16** — CREATE `src/components/ui/dialog.tsx` per cgc manifest (Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose). **Motion tokens:** all animation classes use `duration-[--ds-motion-duration-medium]` (NOT raw `duration-200`) per design-review D9. Easing via inline `transition-timing-function: var(--ds-motion-easing-standard)`.
- [ ] **W2.17** — CREATE `src/components/ui/popover.tsx` per cgc manifest (Popover, PopoverTrigger, PopoverContent, PopoverAnchor). Animation: `duration-[--ds-motion-duration-medium]`.
- [ ] **W2.18** — CREATE `src/components/ui/dropdown-menu.tsx` per cgc manifest (full DropdownMenu family). Animation: `duration-[--ds-motion-duration-fast]` (menu opens are fast).
- [ ] **W2.19** — CREATE `src/components/ui/radio-group.tsx` (RadioGroup, RadioGroupItem with brand-bold checked indicator).
- [ ] **W2.20** — CREATE `src/components/ui/checkbox.tsx` (Checkbox with brand-bold checked bg).
- [ ] **W2.21** — CREATE `src/components/ui/accordion.tsx` (Accordion family; AccordionContent uses `data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up` — animation already token-driven from W1.2).
- [ ] **W2.22** — CREATE `src/components/ui/progress.tsx` (uses already-installed `@radix-ui/react-progress`; export both `Progress` bar and `SpinnerProgress` SVG variant). Spinner uses `--ds-motion-duration-slow` for 360° rotation cycle.
- [ ] **W2.23** — DO NOT delete any dead shadcn files (carousel, context-menu, form, label, separator, toast, toaster, toggle, use-toast) — wave 4 territory
- [ ] **W2.24** — DO NOT remove any npm packages — wave 4 territory
- [ ] **W2.25** — Verify: `yarn build` succeeds; new primitives exist and export expected names
- [ ] **W2.26** — Commit: `feat(design-system): migrate ui primitives + add 7 new Radix-based primitives`

## Wave 3 — Composites + color sweep + smell cleanup

**Split into 3 commits** (per eng-review C3) for independent revertibility:
- **W3-A commit:** Composites only (W3.1–W3.29) — all component-level migrations
- **W3-B commit:** App-level page sweeps (W3.30–W3.36) — all page tokens + ChromePicker
- **W3-C commit:** Smell cleanup (W3.37–W3.40) — `dangerouslyAllowBrowser` removals
Each commit must pass `yarn build` independently.

### W3-A: Composite component migrations (each file gets one task)

- [ ] **W3.1** — `src/components/call/callInfo.tsx`: replace `CircularProgress` from `@nextui-org/react` (lines 16, 309-311, 340-342) with `SpinnerProgress` from `@/components/ui/progress`; replace direct `@radix-ui/react-scroll-area` import (line 6) with `@/components/ui/scroll-area`; sweep `bg-indigo-600` (267) → `bg-brand-bold`; sweep `text-indigo-600` (173) → `text-brand-bold`
- [ ] **W3.2** — `src/components/call/index.tsx`: sweep all 7 `indigo-*` hits → brand equivalents per color mapping table; replace `href="https://folo-up.co/"` (line 680) → `href={process.env.NEXT_PUBLIC_MARKETING_URL}`; remove `color: any` parameter type on `handleColorChange` (line 238) → `color: string` (will now receive hex from new swatch picker)
- [ ] **W3.3** — `src/components/call/feedbackForm.tsx`: sweep `border-indigo-600` (42), `bg-indigo-600` (57) → brand-bold
- [ ] **W3.4** — `src/components/call/tabSwitchPrevention.tsx`: sweep `bg-indigo-400 hover:bg-indigo-600` (53) → `bg-brand-subtle hover:bg-brand-bold`
- [ ] **W3.5** — `src/components/dashboard/Modal.tsx`: REPLACE entire file content with thin wrapper around `Dialog` from `@/components/ui/dialog`; preserve `<Modal open onClose>` API. NEW: the `closeOnOutsideClick={false}` prop, when set, must wire `onInteractOutside={(e) => e.preventDefault()}` AND `onEscapeKeyDown={(e) => e.preventDefault()}` on the underlying DialogContent. Default `closeOnOutsideClick={true}` does nothing special (Radix's default behavior).
- [ ] **W3.6** — Verify all 3 call sites of `<Modal closeOnOutsideClick={false}>` work correctly with the new wrapper (no caller-side code changes needed since W3.5 preserves the prop):
  - `src/app/(client)/interviews/[interviewId]/page.tsx:568` (ChromePicker modal — see W3.31)
  - `src/components/dashboard/interview/createInterviewCard.tsx:31` (multi-step interview creation modal — outside-click would lose form data)
  - `src/components/dashboard/interview/sharePopup.tsx:78` (share popup modal — outside-click acceptable from UX but defaulted false originally; preserve)
- [ ] **W3.7** — `src/components/dashboard/interview/createInterviewCard.tsx`: no indigo hits — verify only
- [ ] **W3.8** — `src/components/dashboard/interview/createInterviewModal.tsx`: verify Modal usage still works after W3.5; sweep any indigo hits
- [ ] **W3.9** — `src/components/dashboard/interview/dataTable.tsx`: sweep `text-indigo-600` (lines 81, 97, 132, 158) → `text-brand-bold`; add `focus-visible` ring on sortable column headers
- [ ] **W3.10** — `src/components/dashboard/interview/editInterview.tsx`: sweep `text-indigo-600` (163, 372), `bg-indigo-600` (182, 210, 366), `border-indigo-600` (259), and the anonymous toggle (291) per mapping
- [ ] **W3.11** — `src/components/dashboard/interview/interviewCard.tsx`: sweep `bg-indigo-600` (119), `text-indigo-600` (148, 155) → brand-bold
- [ ] **W3.12** — `src/components/dashboard/interview/sharePopup.tsx`: sweep `bg-indigo-600` (106, 161) → bg-brand-bold
- [ ] **W3.13** — `src/components/dashboard/interview/summaryInfo.tsx`: REPLACE both `<PieChart>` (MUI x-charts) with inline pure-SVG `DonutChart`; remove `import { PieChart } from "@mui/x-charts/PieChart"`; use ADS chart palette: `["var(--ds-brand-bold)", "#2684FF", "#FFAB00", "#36B37E", "#FF5630", "#00B8D9", "#6554C0", "#FF7452"]` — **ordered so green (#36B37E) and red-orange (#FF5630) are non-adjacent for deuteranopia safety** (design-review D4); add `<title>` element per slice for screen-reader + hover tooltip; sweep `text-[#4F46E5]` (line 35) → `text-brand-bold`; document in W3-A commit message: "PieChart `highlightScope` hover-shimmer not ported — visually intentional"
- [ ] **W3.14** — `src/components/dashboard/interview/create-popup/details.tsx`: sweep `border-indigo-600` (183), `bg-indigo-600`/`bg-[#E6E7EB]` (245), `bg-indigo-600 hover:bg-indigo-800` (317, 335) → brand-bold/bolder
- [ ] **W3.15** — `src/components/dashboard/interview/create-popup/questionCard.tsx`: sweep all `bg-indigo-600` + `hover:bg-indigo-800` hits → brand-bold/bolder; **RENAME** `questionCard` → `QuestionCard` (export name change). NOTE: this file does NOT contain an `eslint-disable react-hooks/rules-of-hooks` to remove (per eng-review C5 — that comment only exists in `createInterviewerCard.tsx`)
- [ ] **W3.16** — Update callers of QuestionCard: `src/components/dashboard/interview/create-popup/questions.tsx` + `editInterview.tsx` — change import names
- [ ] **W3.17** — `src/components/dashboard/interview/create-popup/questions.tsx`: sweep `border-indigo-600` (137), `text-indigo-600` (143), `bg-indigo-600 hover:bg-indigo-800` (179) → brand equivalents
- [ ] **W3.18** — `src/components/dashboard/interviewer/createInterviewerButton.tsx`: verify no indigo hits; no rename needed (already uppercase)
- [ ] **W3.19** — `src/components/dashboard/interviewer/createInterviewerCard.tsx`: RENAME `createInterviewerCard` → `CreateInterviewerCard`; sweep any indigo hits; remove file-wide `eslint-disable react-hooks/rules-of-hooks` comment (still orphan-ui — wave 4 may delete entirely; for now leave file in place but renamed)
- [ ] **W3.20** — `src/components/dashboard/interviewer/interviewerCard.tsx`: RENAME `interviewerCard` → `InterviewerCard` (line 13); remove line 13 eslint-disable
- [ ] **W3.21** — Update caller of InterviewerCard: `src/app/(client)/dashboard/interviewers/page.tsx`
- [ ] **W3.22** — `src/components/dashboard/interviewer/interviewerDetailsModal.tsx`: verify only — likely no indigo hits
- [ ] **W3.23** — `src/components/loaders/loader-with-logo/loaderWithLogo.tsx`: verify no indigo hits
- [ ] **W3.24** — `src/components/loaders/loader-with-text/loaderWithText.tsx`: replace `@nextui-org/progress` `CircularProgress` with `SpinnerProgress` from `@/components/ui/progress`; sweep `stroke-indigo-600` (10) → `stroke-[--ds-brand-bold]`
- [ ] **W3.25** — `src/components/loaders/mini-loader/miniLoader.tsx`: verify no indigo hits
- [ ] **W3.26** — `src/components/navbar.tsx`: sweep `text-indigo-600` (12) → `text-brand-bold`
- [ ] **W3.27** — `src/components/providers.tsx`: RENAME `providers` → `Providers`; keep `defaultTheme="light"` (dark mode toggle is change #3); no other changes
- [ ] **W3.28** — Update callers of Providers: `src/app/(client)/layout.tsx` + `src/app/(user)/layout.tsx`
- [ ] **W3.29** — `src/components/sideMenu.tsx`: sweep `bg-indigo-200` (19, 30) → `bg-brand-subtle`

### W3-B: App-level page color sweeps

- [ ] **W3.30** — `src/app/(client)/dashboard/page.tsx`: line 122 `text-indigo-600` → `text-brand-bold`
- [ ] **W3.31** — `src/app/(client)/interviews/[interviewId]/page.tsx`: sweep lines 289, 313, 337, 361, 403 (indigo-600); 462, 464, 465 (subtle variants); 501, 517, 518 (indigo-500); plus inline-styled `var(--ds-brand-bold)` replacements for `themeColor`/`iconColor` driven elements; **REPLACE ChromePicker (line 22 import + lines 568-586 usage)** with new `BrandColorPicker` using `Popover` + 8-swatch grid. **Palette (per design-review D3 — swap `#344563` for `#FF7452` to match donut and remove perceptually-close dark hue):** `["#4F46E5", "#2684FF", "#FFAB00", "#36B37E", "#FF5630", "#00B8D9", "#6554C0", "#FF7452"]` — brand always first. **CRITICAL (eng-review C2):** `BrandColorPicker` must call `handleColorChange(hexString)` directly — pass a raw hex string, NOT a `{hex: hexString}` object. Current `handleColorChange` in `call/index.tsx:238` accesses `.hex` — that property access must be removed in W3.2. Remove `react-color` import (line 22).
- [ ] **W3.32** — `src/app/(client)/sign-in/[[...sign-in]]/page.tsx`: line 11 `text-indigo-600` → `text-brand-bold`
- [ ] **W3.33** — `src/app/(client)/sign-up/[[...sign-up]]/page.tsx`: line 11 `text-indigo-600` → `text-brand-bold`
- [ ] **W3.34** — `src/app/(user)/call/[interviewId]/page.tsx`: sweep lines 44, 78, 159 (indigo-600); 47, 81 (indigo-500); replace `href="https://folo-up.co/"` (37, 71) and `href="www.folo-up.co"` (156, fix missing protocol) → `href={process.env.NEXT_PUBLIC_MARKETING_URL}`
- [ ] **W3.35** — `src/app/(client)/layout.tsx`: line 74 Clerk theme `actionButton: "bg-indigo-400"` → `"bg-brand-subtle"`
- [ ] **W3.36** — `src/app/(user)/layout.tsx`: lines 46, 49 `border-indigo-400`, `bg-indigo-400` → `border-brand-subtle`, `bg-brand-subtle`

### W3-C: Smell cleanup

- [ ] **W3.37** — Remove `dangerouslyAllowBrowser: true` from `src/app/api/analyze-communication/route.ts:26`
- [ ] **W3.38** — Remove `dangerouslyAllowBrowser: true` from `src/app/api/generate-insights/route.ts:28`
- [ ] **W3.39** — Remove `dangerouslyAllowBrowser: true` from `src/app/api/generate-interview-questions/route.ts:18`
- [ ] **W3.40** — Remove `dangerouslyAllowBrowser: true` from `src/services/analytics.service.ts:37`

### W3-D: Wave 3 verification

- [ ] **W3.41** — Verify: `yarn build` succeeds with no new errors
- [ ] **W3.42** — Verify: `grep -rn "indigo-" src/ | grep -v "useState\|theme_color ??\|response.theme_color"` returns 0 hits (DB-state hex literals are NOT class strings; exclusions allowed)
- [ ] **W3.43** — Verify: `grep -rn "from \"@nextui-org\\|from \"@mui/x-charts\\|from \"react-color\"" src/` returns 0 hits
- [ ] **W3.44** — Verify: `grep -rn "dangerouslyAllowBrowser" src/` returns 0 hits
- [ ] **W3.45** — Verify: dev server walkthrough — load all 7 routes, confirm visuals match pre-wave screenshots
- [ ] **W3.46** — Three commits (per eng-review C3 split):
  - **W3-A:** `feat(design-system): migrate composite components to ADS tokens (replace Modal/PieChart/Progress)` — after W3.1–W3.29 + W3.42 (grep checks) green
  - **W3-B:** `feat(design-system): sweep page-level brand colors + ChromePicker → swatch popover` — after W3.30–W3.36 + W3.43–W3.45 green
  - **W3-C:** `chore(design-system): remove dangerouslyAllowBrowser flag from server OpenAI clients` — after W3.37–W3.40 + W3.44 green

## Wave 4 — Cleanup

- [ ] **W4.1** — `yarn remove @nextui-org/react @nextui-org/progress`
- [ ] **W4.2** — `yarn remove @mui/material @mui/x-charts @emotion/react @emotion/styled`
- [ ] **W4.3** — `yarn remove framer-motion`
- [ ] **W4.4** — `yarn remove react-color @types/react-color`
- [ ] **W4.5** — DELETE `src/components/ui/carousel.tsx`
- [ ] **W4.6** — DELETE `src/components/ui/context-menu.tsx`
- [ ] **W4.7** — DELETE `src/components/ui/form.tsx`
- [ ] **W4.8** — DELETE `src/components/ui/label.tsx`
- [ ] **W4.9** — DELETE `src/components/ui/separator.tsx`
- [ ] **W4.10** — DELETE `src/components/ui/toast.tsx`
- [ ] **W4.11** — DELETE `src/components/ui/toaster.tsx`
- [ ] **W4.12** — DELETE `src/components/ui/toggle.tsx`
- [ ] **W4.13** — DELETE `src/components/ui/use-toast.ts`
- [ ] **W4.14** — Verify: `grep -rn "from.*ui/carousel\|from.*ui/context-menu\|from.*ui/form\|from.*ui/label\|from.*ui/separator\|from.*ui/toast\|from.*ui/toaster\|from.*ui/toggle\|from.*use-toast" src/` returns 0
- [ ] **W4.15** — Verify: `yarn install && yarn build` succeeds with new lockfile
- [ ] **W4.16** — Verify: `yarn tsc --noEmit` clean
- [ ] **W4.17** — Run bundle size compare (manual `du -sh node_modules` before/after for commit message)
- [ ] **W4.18** — Commit: `chore(design-system): remove dead packages + dead shadcn primitives (~1.35 MB ungzipped savings)`

## Definition of done (whole change)

1. **6 commits** in order: W1, W2, W3-A, W3-B, W3-C, W4 (any commit independently revertible)
2. `yarn build` green at each commit boundary
3. `grep -rn "indigo-" src/ | grep -v "useState\|theme_color ??\|response.theme_color"` returns 0 (DB-state defaults excluded)
4. `grep -rn "from \"@nextui-org\\|from \"@mui/x-charts\\|from \"react-color\"\\|from \"framer-motion\"" src/` returns 0
5. `grep -rn "dangerouslyAllowBrowser" src/` returns 0
6. No new TypeScript errors, no new ESLint errors
7. Bundle size reduction documented in W4.18 commit message
8. Visual sanity walkthrough completed on dev server (all 7 routes)
9. WCAG AA contrast spot-check noted in commit (brand-bold on background; for small text, fall back to brand-bolder if needed)
