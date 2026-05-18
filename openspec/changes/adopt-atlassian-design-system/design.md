# Design — adopt-atlassian-design-system

## Architecture decisions

### AD-1: Tokens-as-CSS-variables, not JS imports
`@atlaskit/tokens` ships both JS constants (`import { token } from '@atlaskit/tokens'`) and raw CSS variables. We use the **CSS variable layer only**. Rationale: keeps Tailwind utilities as the styling API (no `style={{ color: token('color.text.brand') }}` in JSX), avoids `AtlassianThemeProvider` mount, and lets PurgeCSS see static class names. The JS package is still installed for future use and provides typed token names for tooling/lint.

### AD-2: Tailwind `brand` color key, not arbitrary properties
Brand colors expose as `bg-brand-bold`, `text-brand-bold`, `border-brand-bolder`, etc. via `extend.colors.brand.{bold,bolder,subtle,subtlest}` in `tailwind.config.ts`. Values are `var(--ds-brand-bold)` etc. Rationale:
- Static class names → PurgeCSS catches all uses
- Autocomplete works in IDE
- Migration is search/replace-friendly (`indigo-600` → `brand-bold`)
- No `bg-[--ds-brand-bold]` syntax noise across 71+ sites

Trade-off accepted: must declare each brand shade in tailwind config. Acceptable for ~4 shades.

### AD-3: 4-wave structure with hard commit boundaries
Each wave is one git commit. Waves are independently revertible. Rationale: 5-week migration with no automated visual regression suite → small reverts must be safe. If wave 3 produces unexpected visual breakage, wave 1+2 stay landed and the migration pauses without rollback churn.

### AD-4: Custom Modal replaced (behavioral upgrade, not just visual)
`src/components/dashboard/Modal.tsx` lacks focus trap, ESC handling, ARIA `aria-modal`, and proper backdrop click semantics. Replacing with Radix Dialog wrapper fixes all four. The `Modal` export name and call site API (`<Modal open onClose>`) are preserved as a thin wrapper around Radix to avoid touching 5 caller sites. One caller (`interviews/[interviewId]/page.tsx` line 568 with `closeOnOutsideClick={false}`) gets `onInteractOutside={(e) => e.preventDefault()}` instead.

### AD-5: Pure-SVG PieChart, not recharts
Operator decision during brainstorming. Rationale:
- 2 static donut charts, no interactions beyond tooltip
- Recharts adds ~100 KB for capability we don't need today
- Pure-SVG is ~50 lines and zero deps
- If change #3 introduces more chart variety, that's the right moment to evaluate recharts

### AD-6: NextUI Progress / CircularProgress replacement is Radix-Progress-based
`@radix-ui/react-progress` is already in `package.json` (^1.1.0). The new `src/components/ui/progress.tsx` exports both a bar and a `SpinnerProgress` variant. Spinner is SVG-based (circle + animated stroke-dasharray); bar is Radix Root + Indicator. Both consume `--ds-brand-bold` for the active color.

### AD-7: ChromePicker replaced with curated 8-swatch palette
The audit (Appendix C accessibility deferral) notes ChromePicker is mouse-only and not keyboard-accessible by default. Replacement is a Radix Popover + grid of 8 brand-palette swatches:
```
#4F46E5 (FoloUp brand), #2684FF, #36B37E, #FF5630,
#FFAB00, #00B8D9, #6554C0, #344563
```
Keyboard-navigable by Popover construction. Drops `react-color` package (~150 KB) and `@types/react-color`. The `handleColorChange(color: any)` typing in `call/index.tsx:238` simplifies to `string` (hex).

### AD-8: `useState<string>("#4F46E5")` DB defaults stay as raw hex
The initial-state hex literals at `interviews/[interviewId]/page.tsx:70,71,97,98` are DB-state values, not display tokens. They should remain raw hex strings — those default DB values must stay stable. The token system applies to class strings (display), not state values (data). The buggy initial-equality save-skip is a known broken feature (BROKEN-FEATURES §2.1) — change #3's territory, not this change's.

### AD-9: Wave 2 builds replacements but does NOT remove old packages
Old packages (`@nextui-org/*`, `@mui/*`, `react-color`) stay installed through waves 2 and 3 even though their replacements exist. Only wave 4 removes them. Rationale: each wave commit must be `yarn install && yarn build` clean. If wave 2 removes packages while wave 3 hasn't yet swapped consumers, the dev server breaks.

### AD-10: Lowercase renames happen in-wave with their callers
`questionCard → QuestionCard`, `interviewerCard → InterviewerCard`, `providers → Providers`. Renaming the export without updating callers in the same commit produces TS errors. All callers updated in the same wave-3 commit as the rename.

### AD-11: `dangerouslyAllowBrowser` removal is opportunistic in Wave 3
The 4 OpenAI client sites (3 route handlers + 1 service) are touched in Wave 3 for `brand-bold` sweep. Removing the flag during the same edit is free. Pure cleanup; no behavioral change (it's a no-op in Node/Edge runtime).

### AD-12: Visual regression strategy — manual + commit-bounded reverts
No Playwright/Storybook added in this change. Mitigation: each wave commit is independently revertible, scope is narrow per wave, and the operator reviews each wave commit before authorizing the next. Cheaper than setting up Playwright for a one-time migration. Adding visual regression tooling can be its own task in change #3 or a follow-up.

## Token-system specifics

### Brand ramp values

OKLCH used for perceptual uniformity (Tailwind 3.4+ supports it):
```css
--ds-brand-bold:     oklch(54% 0.27 273);   /* #4F46E5 */
--ds-brand-bolder:   oklch(45% 0.27 273);   /* darker hover/active */
--ds-brand-subtle:   oklch(91% 0.06 273);   /* very light tint */
--ds-brand-subtlest: oklch(97% 0.02 273);   /* faintest fill */
```

Dark mode adjusts for contrast:
```css
.dark {
  --ds-brand-bold:     oklch(65% 0.22 273);   /* lighter for dark bg */
  --ds-brand-bolder:   oklch(73% 0.18 273);
  --ds-brand-subtle:   oklch(28% 0.12 273);
  --ds-brand-subtlest: oklch(20% 0.06 273);
}
```

### Motion tokens

```css
--ds-motion-duration-fast:   100ms;
--ds-motion-duration-medium: 200ms;  /* accordion uses this */
--ds-motion-duration-slow:   400ms;
--ds-motion-easing-incoming: cubic-bezier(0, 0, 0.2, 1);
--ds-motion-easing-outgoing: cubic-bezier(0.4, 0, 1, 1);
--ds-motion-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
```

### Elevation shadows (light mode)

```css
--ds-shadow-raised:   0 1px 1px rgba(9,30,66,.25), 0 0 1px rgba(9,30,66,.31);
--ds-shadow-overflow: 0 8px 16px rgba(9,30,66,.15), 0 0 1px rgba(9,30,66,.31);
--ds-shadow-overlay:  0 20px 32px rgba(9,30,66,.12), 0 0 1px rgba(9,30,66,.31);
```

Dark mode versions in `.dark` block with darker base colors.

## Verification

### Per-wave gates

- **Wave 1:** `yarn build` succeeds; `globals.css` exports `--ds-brand-*` variables; Tailwind `brand-bold` utility compiles; visual smoke test (dev server) shows existing UI unchanged (no consumer uses brand-bold yet).
- **Wave 2:** `yarn build` succeeds; new primitives exist with correct exports; 8 new Radix packages installed; old dead primitives kept (not deleted yet — deletes go to wave 4).
- **Wave 3:** `yarn build` succeeds; `grep -rn "from \"@nextui-org\\|from \"@mui/x-charts\\|from \"react-color\"" src/` returns 0 hits; `grep -rn "indigo-" src/` returns 0 hits (except DB-state raw hex which is not a class); `grep -rn "dangerouslyAllowBrowser" src/` returns 0 hits.
- **Wave 4:** `yarn install && yarn build` succeeds with old packages absent; `yarn.lock` shrunk; dead shadcn files absent.

### Final QA (after wave 4)

1. **Build green:** `yarn build` with no errors or warnings related to migrated code.
2. **Type-check:** `yarn tsc --noEmit` clean.
3. **Brand color coverage:** `grep -rn "var(--ds-brand-bold)\|brand-bold\|brand-bolder\|brand-subtle\|brand-subtlest" src/ | wc -l` > 0 (tokens consumed).
4. **Library purge:** package.json no longer lists `@nextui-org/react`, `@nextui-org/progress`, `@mui/material`, `@mui/x-charts`, `@emotion/react`, `@emotion/styled`, `framer-motion`, `react-color`, `@types/react-color`.
5. **Bundle size:** `du -sh node_modules` before vs. after; report savings in commit message.
6. **Visual sanity:** Run dev server, walk all 7 routes (`/sign-in`, `/sign-up`, `/dashboard`, `/dashboard/interviewers`, `/interviews/[id]`, `/call/[id]`, `/`) and confirm no obvious visual regressions vs. pre-migration screenshots (manual; documented in commit message).

## Risks

| Risk | Mitigation |
|---|---|
| Manual visual review misses subtle regressions | Each wave is independently revertible; small commit scope per wave |
| OKLCH values don't render `#4F46E5` exactly on some monitors | OKLCH-to-hex conversion is mathematically exact; gamut mapping handled by browsers; fall back to `#4F46E5` hex if needed |
| Tailwind `brand` color key conflicts with future package adding `brand-` prefix | Tailwind merges; we win locally; unlikely conflict in this app |
| Radix Dialog focus-trap traps mid-form-submit | Tested pattern; Radix handles this correctly per docs |
| Pure-SVG donut has no built-in tooltip | Add `<title>` element per slice for hover-tooltip; sufficient for our use case (2 charts, simple data) |
| Removing `react-color` breaks `iconColor` state machinery | Audited: `iconColor` is just a duplicate of `themeColor`; replacement swatch picker writes to same state. The known initial-equality bug stays (BROKEN-FEATURES §2.1) but is change #3's fix. |
| Dark mode CSS is partially applied — some surfaces use `--ds-brand-*` for dark, others still hardcode | Wave 3 sweeps all 22 files; manual QA confirms |
| Adding 6 Radix packages adds bundle weight before old packages are removed | Net is still ~1.35 MB savings even with new packages; final QA verifies |

## Non-goals (re-stated for design clarity)

- We are **not** redesigning any visual surface. The brand color, layouts, spacing, typography all stay where they are. This change swaps the implementation (tokens + Radix), not the look.
- We are **not** fixing any broken feature.
- We are **not** improving accessibility beyond what the Radix primitives bake in for free (focus trap on Dialog, ARIA on every primitive). A full a11y pass is change #3 / dedicated audit.
