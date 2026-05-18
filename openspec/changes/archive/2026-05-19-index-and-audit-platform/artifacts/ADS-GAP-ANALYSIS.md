# ADS-GAP-ANALYSIS.md

> Audit: index-and-audit-platform · Source: cgc manifest, fetched 2026-05-19 · ADS docs reference: https://atlassian.design/components/tokens (fetched 2026-05-19) · Audit version: 1.0

This is the **migration script source** for change #2 `adopt-atlassian-design-system`. Three sections plus appendices.

- §1 Baseline tokens — what FoloUp uses today (extracted from `tailwind.config.ts`, `globals.css`, hardcoded class strings, `components.json`)
- §2 Atlassian DS target tokens — the ADS token categories and sample values that change #2 will adopt
- §3 Mapping & component blueprint — current → target, plus Radix primitive candidates per component family

**Binding decisions** (made by this audit, change #2 follows unless explicitly overridden with rationale):

- **D3b Brand-color strategy:** Option (a) — Custom ADS brand-token override preserving `#4F46E5` via `--ds-brand-bold = #4F46E5` (and the rest of the brand ramp derived from it). Rationale: FoloUp's visual identity is built on this indigo; changing it during a design-system migration would dilute the redesign's intent (better design without losing brand).
- **D4b Motion strategy:** Keep `tailwindcss-animate` (compatible with Radix), remove `framer-motion`, migrate accordion keyframes (the only custom motion today) to ADS `motion.duration.fast/medium` consumers.
- **Library consolidation:** Drop `@nextui-org/react`, `@nextui-org/progress`, `@mui/material`, `framer-motion`, `react-color` (if ChromePicker is replaced — recommended). Keep `@mui/x-charts` only if PieChart is kept (else also drop).
- **Dark mode:** Currently defined in CSS but disabled at runtime. Recommend ENABLE during change #2 — ADS has full dark-mode token sets, and the CSS scaffold already exists.

---

## §1 Baseline tokens (current state)

### §1.1 Color tokens

From `src/app/globals.css` `:root` block — all values are HSL space-separated:

| Variable | Light value | Dark value | Notes |
|---|---|---|---|
| `--background` | `0 0% 100%` (#ffffff) | `222.2 84% 4.9%` | white / near-black |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` | near-black / near-white |
| `--card` | `0 0% 100%` | `222.2 84% 4.9%` | same as background |
| `--card-foreground` | `222.2 84% 4.9%` | `210 40% 98%` | same as foreground |
| `--popover` | `0 0% 100%` | `222.2 84% 4.9%` | |
| `--popover-foreground` | `222.2 84% 4.9%` | `210 40% 98%` | |
| `--primary` | `222.2 47.4% 11.2%` (dark navy) | `210 40% 98%` | shadcn-default; NOT the FoloUp brand color |
| `--primary-foreground` | `210 40% 98%` | `222.2 47.4% 11.2%` | |
| `--secondary` | `210 40% 96.1%` (light gray) | `217.2 32.6% 17.5%` | |
| `--secondary-foreground` | `222.2 47.4% 11.2%` | `210 40% 98%` | |
| `--muted` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` | |
| `--accent` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | |
| `--accent-foreground` | `222.2 47.4% 11.2%` | `210 40% 98%` | |
| `--destructive` | `0 84.2% 60.2%` (red) | `0 62.8% 30.6%` | |
| `--destructive-foreground` | `210 40% 98%` | `210 40% 98%` | |
| `--border` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | |
| `--input` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | same as border |
| `--ring` | `222.2 84% 4.9%` | `212.7 26.8% 83.9%` | focus ring color |

**Critical gap:** `#4F46E5` (FoloUp brand indigo, Tailwind's `indigo-600`) is **not represented as a CSS variable**. It's used as raw Tailwind class strings:

```sh
# 71 hits across 22 files; sample:
src/app/(client)/sign-in/[[...sign-in]]/page.tsx:11:Folo<span className="text-indigo-600">Up</span>
src/app/(user)/call/[interviewId]/page.tsx:44:Folo<span className="text-indigo-600">Up</span>
src/app/(client)/dashboard/page.tsx:122:<div className="flex justify-center text-indigo-600">
src/app/(client)/interviews/[interviewId]/page.tsx:403:isActive ? "bg-indigo-600" : "bg-[#E6E7EB]"
src/components/call/index.tsx:680:<a className="text-indigo-600" href="https://folo-up.co/">
# ... plus initial state defaults at:
src/app/(client)/interviews/[interviewId]/page.tsx:70: useState<string>("#4F46E5")
src/app/(client)/interviews/[interviewId]/page.tsx:71: useState<string>("#4F46E5")
src/app/(client)/interviews/[interviewId]/page.tsx:97: response.theme_color ?? "#4F46E5"
src/app/(client)/interviews/[interviewId]/page.tsx:98: response.theme_color ?? "#4F46E5"
```

22 files contain the brand color. This is the single highest-impact migration target.

### §1.2 `tailwind.config.ts`

```ts
// Token extensions:
colors: { border, input, ring, background, foreground,
  primary { DEFAULT, foreground },
  secondary { DEFAULT, foreground },
  destructive { DEFAULT, foreground },
  muted { DEFAULT, foreground },
  accent { DEFAULT, foreground },
  popover { DEFAULT, foreground },
  card { DEFAULT, foreground }
}
// All map to hsl(var(--<token>))
borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" }
// keyframes
accordion-down: from height:0 → to height:var(--radix-accordion-content-height)
accordion-up:   from height:var(--radix-accordion-content-height) → to height:0
// animations
animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out" }
// plugins
plugins: [require("tailwindcss-animate"), require("tailwind-scrollbar-hide")]
```

**No custom `fontFamily`, `fontSize`, `spacing`, `boxShadow`, `opacity`, or `zIndex` extensions.** All values use Tailwind defaults.

### §1.3 `components.json` (shadcn config)

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}
```

Style: `new-york` (sharper aesthetic than `default`). Base: `slate`. CSS variables enabled.

### §1.4 Typography, spacing, elevation, opacity, z-index baseline

**Typography:** Tailwind defaults — `text-xs`, `text-sm`, `text-base`, `text-lg`, etc. No custom `fontFamily` (uses system stack via Tailwind's `font-sans`). No custom `fontWeight` or `lineHeight` scales.

**Spacing:** Tailwind defaults (4px base, `space-y-1` through `space-y-96`). No custom spacing scale.

**Elevation / shadow:** Tailwind defaults (`shadow-sm` through `shadow-2xl`). No custom shadow tokens. Cards and modals use Tailwind defaults inline.

**Opacity:** Tailwind defaults (`opacity-0` through `opacity-100` in 5% steps). No custom values.

**Z-index:** Tailwind defaults (`z-0` through `z-50`). No custom z-index scale. Note: ADS uses an explicit elevation-layer mental model (`elevation.overlay.raised` etc.) — NOT equivalent to z-index numbering. Change #2 must verify modal/popover/dropdown stacking when migrating.

### §1.5 D3b — Brand-color migration decision (binding for change #2)

| Strategy | What it means | Visual impact | Recommendation |
|---|---|---|---|
| **(a) Custom ADS brand-token override** | Define `--ds-brand-bold = #4F46E5` (or `oklch(0.49 0.21 273)` for OKLCH consistency with ADS). Derive `--ds-brand-bolder`, `--ds-brand-subtle`, `--ds-brand-subtlest` from the same hue. | Zero visible change from current; FoloUp brand identity preserved | **✓ RECOMMENDED** — preserves brand while adopting ADS structure |
| (b) Map to nearest ADS blue | Use `color.background.brand.bold` from ADS default palette (`~#0C66E4`) — slightly more saturated, more blue, less violet | Brand shifts from indigo to blue-blue. ~5° hue change, noticeable to existing users | Not recommended — gratuitous visual change |
| (c) Full ADS palette adoption | Drop the FoloUp brand color entirely; use Atlassian's full default palette (their blue, their semantic colors) | Major visual departure; ATL-coded aesthetic; might confuse existing users who know FoloUp's purple-indigo identity | Not recommended unless rebranding is explicit goal |

**Implementation note for change #2:**

```css
/* In :root */
--ds-brand-bold: oklch(54% 0.27 273);     /* #4F46E5 in OKLCH */
--ds-brand-bolder: oklch(45% 0.27 273);   /* darker for hover/active */
--ds-brand-subtle: oklch(91% 0.06 273);   /* tints */
--ds-brand-subtlest: oklch(97% 0.02 273);
/* And similarly in :root.dark mode block for dark theme */
```

Then every `text-indigo-600` / `bg-indigo-600` / `border-indigo-600` becomes `text-[--ds-brand-bold]` / etc. (using Tailwind 3.4+ arbitrary properties), OR a Tailwind plugin maps `brand` as a color key. Recommend the plugin approach for ergonomics.

### §1.6 D4b — Motion baseline + ADS mapping (binding for change #2)

**Current motion:**

- `tailwind.config.ts` accordion keyframes (`accordion-down` 0.2s ease-out, `accordion-up` 0.2s ease-out) — only custom motion
- `tailwindcss-animate` plugin active — provides Radix component animations (`animate-in`, `animate-out`, `fade-in`, `slide-in-from-top`, etc.)
- `framer-motion` v11.3.21 installed (~300 KB ungzipped) — **ZERO imports across `src/`** (dead dependency)

**ADS target motion tokens:**

| ADS category | Sample values |
|---|---|
| `motion.duration.fast` | 100 ms (small UI feedback like button press) |
| `motion.duration.medium` | 200 ms (Radix accordions, modals) |
| `motion.duration.slow` | 400 ms (page transitions) |
| `motion.easing.incoming` | `cubic-bezier(0.0, 0.0, 0.2, 1)` |
| `motion.easing.outgoing` | `cubic-bezier(0.4, 0.0, 1, 1)` |
| `motion.easing.standard` | `cubic-bezier(0.4, 0.0, 0.2, 1)` |

**Migration:**

1. Drop `framer-motion` (zero use)
2. Keep `tailwindcss-animate` (Radix-compatible)
3. Update accordion `0.2s ease-out` → `motion.duration.medium` + `motion.easing.standard` (currently equivalent durations; bring under token control)
4. Any new motion change #3 introduces must consume these tokens, not raw values

---

## §2 Atlassian DS target tokens

Reference: https://atlassian.design/components/tokens (fetched 2026-05-19). Token names listed below are stable in the public ADS docs; values are samples from the default light theme.

### §2.1 Color categories

ADS organizes color into **foreground**, **background**, **border**, **icon**, **link**, **chart**, **interaction**, **brand**, and **status** namespaces — each with `bold` / `bolder` / `subtle` / `subtlest` shades and `hover` / `pressed` modifiers.

| ADS namespace | Sample tokens | Use case |
|---|---|---|
| `color.background.neutral.*` | `subtlest` (white), `subtle`, `default`, `bold` | page bg, card bg |
| `color.background.brand.*` | `bold`, `bolder`, `subtle`, `subtlest` | primary CTAs, brand surfaces — **THIS IS WHERE D3b's `#4F46E5` GOES** |
| `color.background.accent.<hue>.*` | blue/green/yellow/orange/red/magenta/teal/purple ramps | status, charts, callouts |
| `color.background.danger.*` | `bold`, `subtle` | destructive actions |
| `color.background.warning.*` | `bold`, `subtle` | warnings |
| `color.background.success.*` | `bold`, `subtle` | success states |
| `color.background.information.*` | `bold`, `subtle` | info banners |
| `color.text.*` | `default`, `subtle`, `subtlest`, `inverse`, `brand`, `danger`, `warning`, `success`, `disabled` | typography |
| `color.border.*` | `default`, `bold`, `subtle`, `focused`, `disabled` | borders, **focus rings** |
| `color.icon.*` | `default`, `subtle`, `inverse`, `brand`, `danger`, `disabled` | icons |
| `color.link.*` | `default`, `pressed`, `visited` | hyperlinks |

### §2.2 Typography tokens

| ADS token | Sample value | Use case |
|---|---|---|
| `font.heading.xxlarge` | 35px / 40px | display |
| `font.heading.xlarge` | 29px / 32px | page title |
| `font.heading.large` | 24px / 28px | section title |
| `font.heading.medium` | 20px / 24px | subsection |
| `font.heading.small` | 16px / 20px | minor heading |
| `font.heading.xsmall` | 14px / 16px | labels |
| `font.body.large` | 16px / 24px | body large |
| `font.body` | 14px / 20px | body default |
| `font.body.small` | 12px / 16px | small body |
| `font.code` | 12-14px mono | code blocks |
| `font.weight.regular` / `medium` / `semibold` / `bold` | 400 / 500 / 600 / 700 | |
| `font.family.body` | `"Charlie Sans"`, system stack | brand-flexible |

### §2.3 Spacing tokens

| ADS token | Value |
|---|---|
| `space.0` | 0 |
| `space.025` | 2px |
| `space.050` | 4px |
| `space.075` | 6px |
| `space.100` | 8px |
| `space.150` | 12px |
| `space.200` | 16px |
| `space.250` | 20px |
| `space.300` | 24px |
| `space.400` | 32px |
| `space.500` | 40px |
| `space.600` | 48px |
| `space.800` | 64px |
| `space.1000` | 80px |

(ADS spacing is 8-based with finer divisions; Tailwind's 4-based system maps approximately — `p-2` ≈ `space.100`, `p-4` ≈ `space.200`, etc.)

### §2.4 Border-radius tokens

| ADS token | Value |
|---|---|
| `border.radius.050` | 2px |
| `border.radius.100` | 4px (default) |
| `border.radius.200` | 8px |
| `border.radius.300` | 12px |
| `border.radius.400` | 16px |
| `border.radius.circle` | 50% |

Current FoloUp `--radius = 0.5rem` (8px) maps to `border.radius.200`.

### §2.5 Elevation / shadow tokens

| ADS token | Use case |
|---|---|
| `elevation.shadow.raised` | small cards, hovered buttons |
| `elevation.shadow.overflow` | dropdowns, popovers |
| `elevation.shadow.overlay` | modals, dialogs |
| `elevation.surface.raised` | cards (background fill at elevation) |
| `elevation.surface.overlay` | modal surface |

### §2.6 Motion tokens

See §1.6 D4b — already mapped.

---

## §3 Mapping & component blueprint

### §3.1 Token-by-token mapping

| Current (FoloUp) | ADS target | Migration touch | Notes |
|---|---|---|---|
| `--background` `0 0% 100%` | `color.background.neutral.subtlest` | value-equivalent, rename | |
| `--foreground` `222.2 84% 4.9%` | `color.text.default` | value-equivalent, rename | |
| `--card` (same as background) | `elevation.surface.raised` | rename + ADS implies an elevation token, not flat | Cards get a subtle shadow in ADS by default |
| `--primary` (dark navy `222.2 47.4% 11.2%`) | DEPRECATE — this is shadcn-default "primary" not actual brand | rewrite | Replace usages with brand tokens or neutral.bold per intent |
| `text-indigo-600` / `bg-indigo-600` / `#4F46E5` | `color.background.brand.bold` (via D3b option (a) override) | rewrite 71+ sites | The big one |
| `--destructive` `0 84.2% 60.2%` | `color.background.danger.bold` + `color.text.danger` | rename | |
| `--secondary` `210 40% 96.1%` | `color.background.neutral.subtle` | value-near-equivalent | |
| `--muted` `210 40% 96.1%` | `color.background.neutral.subtle` (same as secondary in this scheme) | rename | Currently muted == secondary; ADS distinguishes them slightly |
| `--muted-foreground` `215.4 16.3% 46.9%` | `color.text.subtle` | value-near-equivalent | |
| `--accent` `210 40% 96.1%` | `color.background.accent.gray.subtle` or alias of neutral | rename | |
| `--border` `214.3 31.8% 91.4%` | `color.border.default` | value-near-equivalent | |
| `--ring` (focus ring) `222.2 84% 4.9%` | `color.border.focused` | rename — ADS uses brand-tinted focus ring | Recommend `color.border.focused` derived from brand (D3b option (a)) |
| `--radius` `0.5rem` | `border.radius.200` | rename | |
| Tailwind `text-base` (16px / 24px) | `font.body.large` | value-equivalent, rename | |
| Tailwind `text-sm` (14px / 20px) | `font.body` | value-equivalent, rename | |
| Tailwind `text-xs` (12px / 16px) | `font.body.small` | value-equivalent, rename | |
| Tailwind `p-4` (16px) | `space.200` | value-equivalent | |
| Tailwind `p-2` (8px) | `space.100` | value-equivalent | |
| Tailwind `shadow-sm` | `elevation.shadow.raised` | rename + ADS values are slightly different | |
| Tailwind `shadow-lg` | `elevation.shadow.overlay` | rename | |
| Accordion `0.2s ease-out` | `motion.duration.medium` + `motion.easing.standard` | refactor keyframes | |

### §3.2 Component blueprint

Per-component blueprint with **candidate Radix primitives** (audit names options; change #2 makes the final architectural call).

#### Buttons & actions

| Current component | Variants | Candidate Radix primitives | ADS tokens consumed | Complexity |
|---|---|---|---|---|
| `src/components/ui/button.tsx` | default, destructive, outline, secondary, ghost, link | `Slot` from `@radix-ui/react-slot` (already used) + custom-built button | `color.background.brand.bold` (primary), `color.text.inverse`, `color.border.focused`, `space.100`/`space.200`, `font.body`, `border.radius.100`, `motion.duration.fast` | trivial (variants already exist) |
| `src/components/ui/button.tsx → variant=destructive` | sub-row | same primitive | `color.background.danger.bold`, `color.text.inverse` | trivial |
| `src/components/ui/button.tsx → variant=ghost` | sub-row | same primitive | `color.background.neutral.subtle` (hover), `color.text.default` | trivial |
| `src/components/ui/button.tsx → variant=link` | sub-row | same primitive (no bg) | `color.link.default`, `color.link.pressed` | trivial |

#### Form inputs

| Current component | Candidate Radix primitives | ADS tokens consumed | Complexity |
|---|---|---|---|
| `src/components/ui/textarea.tsx` | native `<textarea>` styled with utilities | `color.background.input`, `color.border.default`, `color.border.focused`, `color.text.default`, `font.body`, `space.150`, `border.radius.100` | trivial — add error state (currently missing) |
| `src/components/ui/select.tsx` | `@radix-ui/react-select` (already used) | `color.background.neutral.subtle`, `color.border.default`, `color.text.default`, `color.border.focused`, `elevation.shadow.overflow`, `motion.duration.medium` | trivial |
| `src/components/ui/switch.tsx` | `@radix-ui/react-switch` (already used) | `color.background.brand.bold` (checked), `color.background.neutral.subtle` (unchecked), `motion.duration.fast` | trivial |
| `src/components/ui/slider.tsx` | `@radix-ui/react-slider` (already used) | `color.background.brand.bold` (fill), `color.border.default` (track) | trivial |
| Missing — text input | `@radix-ui/react-form` field or native styled | full input tokens | small build — currently no `Input` primitive exists; only `Textarea` |
| Missing — label | `@radix-ui/react-label` | `color.text.default`, `font.body.small` | small build — `label.tsx` is dead-import but the primitive is solid |

#### Overlays & dialogs

| Current component | Candidate Radix primitives | ADS tokens consumed | Complexity |
|---|---|---|---|
| `src/components/ui/alert-dialog.tsx` | `@radix-ui/react-alert-dialog` (already used) | `color.background.neutral.subtlest`, `elevation.shadow.overlay`, `motion.duration.medium`, `space.300` | trivial |
| `src/components/dashboard/Modal.tsx` (custom) | **REPLACE with `@radix-ui/react-dialog`** | same as alert-dialog plus `color.background.scrim` (backdrop) | **moderate** — non-Radix custom modal lacks focus trap, ESC handling, ARIA semantics. Migration is a behavioral upgrade, not just visual. → BROKEN-FEATURES Appendix |
| `src/components/ui/tooltip.tsx` | `@radix-ui/react-tooltip` (already used) | `color.background.neutral.bold`, `color.text.inverse`, `border.radius.100`, `motion.duration.fast` | trivial |
| Color picker (currently `react-color` ChromePicker) | `@radix-ui/react-popover` + custom palette swatches OR drop ChromePicker entirely | brand color set, `elevation.shadow.overflow` | **moderate** — drop `react-color` (~150KB), replace with curated brand-palette swatches in a Popover. Better UX (limited choices = on-brand designs) |

#### Navigation & layout

| Current component | Candidate Radix primitives | ADS tokens consumed | Complexity |
|---|---|---|---|
| `src/components/ui/tabs.tsx` | `@radix-ui/react-tabs` (already used) | `color.background.neutral.subtle`, `color.border.focused`, `motion.duration.fast` | trivial |
| `src/components/navbar.tsx` | Clerk components (keep) + Radix `NavigationMenu` | brand + neutral tokens | small build |
| `src/components/sideMenu.tsx` | custom (no Radix needed) | tokens only | trivial |

#### Tables & data display

| Current component | Candidate Radix primitives | ADS tokens consumed | Complexity |
|---|---|---|---|
| `src/components/ui/table.tsx` + `dataTable.tsx` | keep `@tanstack/react-table` + ADS tokens | `color.background.neutral.*`, `color.border.default`, `font.body`, `space.*` | trivial — add row focus state |
| `src/components/ui/card.tsx` | keep custom (no Radix needed) | `elevation.surface.raised`, `elevation.shadow.raised`, `border.radius.200`, `space.300` | trivial |
| `src/components/ui/avatar.tsx` | `@radix-ui/react-avatar` (already used) | `color.background.neutral.subtle`, `border.radius.circle`, fallback `color.text.subtle` | trivial |
| `src/components/ui/skeleton.tsx` | custom (no Radix needed) | `color.background.neutral.subtle`, `motion.duration.slow` (shimmer) | trivial |
| `src/components/dashboard/interview/summaryInfo.tsx` (MUI PieChart) | **REPLACE with `@radix-ui/react-progress` OR a lightweight chart lib (recharts / visx) OR pure-SVG donut** | chart palette: `color.chart.*` (8-hue ADS palette), tooltip tokens | **rewrite** — currently uses `@mui/x-charts` PieChart. Migration drops `@mui/material` + `@mui/x-charts` (~750KB combined). Consider recharts (already common, lightweight, MIT-licensed) or pure-SVG if just two pie charts |
| `src/components/loaders/loader-with-text/loaderWithText.tsx` (NextUI CircularProgress) | **REPLACE with custom Radix-styled SVG spinner OR `@radix-ui/react-progress`** | `color.background.brand.bold` (spinner fg), `color.background.neutral.subtle` (track), `motion.duration.slow` | trivial — drops `@nextui-org/progress` |
| `src/components/call/callInfo.tsx` (NextUI CircularProgress) | same as above | same | trivial — drops `@nextui-org/react` |

#### Scrolling & utilities

| Current component | Candidate Radix primitives | ADS tokens consumed | Complexity |
|---|---|---|---|
| `src/components/ui/scroll-area.tsx` | `@radix-ui/react-scroll-area` (already used) | `color.background.neutral.subtle` (scrollbar track), `color.background.neutral.bold` (thumb) | trivial — also fix the `callInfo.tsx` direct-Radix bypass |

### §3.3 Library consolidation summary

| Package | Current size | Action | Replacement |
|---|---|---|---|
| `@nextui-org/react` | ~200 KB | **REMOVE** | Custom Radix-styled SVG spinner consuming brand tokens |
| `@nextui-org/progress` | ~80 KB | **REMOVE** | Same as above |
| `@mui/material` | ~500 KB | **REMOVE** | Not imported anywhere (dead) |
| `@mui/x-charts` | ~250 KB | **REMOVE** if PieChart replaced (recommend recharts or pure-SVG) | recharts (~100 KB) or pure-SVG (zero deps) |
| `framer-motion` | ~300 KB | **REMOVE** | Not imported anywhere (dead). Use `tailwindcss-animate` + Radix-built animations for everything change #3 needs |
| `react-color` | ~150 KB | **REMOVE** if ChromePicker replaced (recommended) | Radix Popover + curated brand-palette swatches |
| **Estimated bundle savings** | **~1.48 MB ungzipped** | | Combined with dead shadcn ui/* files removal: ~1.5 MB |
| `@radix-ui/*` (all subpackages) | — | **KEEP** | Foundation for the redesign |
| `tailwindcss-animate` | — | **KEEP** | Compatible with Radix |
| `tailwind-scrollbar-hide` | — | **KEEP** | Used by ScrollArea |
| `@clerk/clerk-js`, `@clerk/nextjs` | — | **KEEP** | Auth foundation |
| `@tanstack/react-query` | ~30 KB | **DECISION REQUIRED** — adopt or remove. Currently set up in `providers.tsx` but no `useQuery`/`useMutation` calls exist. | Recommend ADOPT during change #2 (server state caching for `useInterviews`, `useResponses`, etc.) — current contexts manually manage state |
| `@tanstack/react-table` | — | **KEEP** | Used by `dataTable.tsx` |
| `lucide-react` | — | **KEEP** | Icon library, used everywhere |
| `sonner` | — | **KEEP** | Toast system (replaces dead shadcn `toaster`) |

### §3.4 New primitives change #2 should add

The following Radix primitives are NOT currently in `src/components/ui/` but are needed for the redesigned surface:

| Primitive | Radix package | Use case |
|---|---|---|
| `Input` | native + styled | Currently no `Input.tsx` — only `Textarea`. Forms need a styled `<input>` primitive |
| `Dialog` (modal) | `@radix-ui/react-dialog` | Replaces `src/components/dashboard/Modal.tsx` custom modal |
| `Popover` | `@radix-ui/react-popover` | Color picker replacement, dropdown menus |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` | Sort/filter menus on dashboard, action menus on cards |
| `Toast` | keep `sonner` (already in app) | No Radix toast needed |
| `RadioGroup` | `@radix-ui/react-radio-group` | Multi-choice settings (e.g., interview type) |
| `Checkbox` | `@radix-ui/react-checkbox` | Settings, multi-select tables |
| `Accordion` | `@radix-ui/react-accordion` | Already used implicitly via animations; not exported as a primitive — add `accordion.tsx` |
| `Progress` | `@radix-ui/react-progress` | Replaces NextUI CircularProgress |
| `Toggle` (or `ToggleGroup`) | `@radix-ui/react-toggle` (already installed) | Currently dead-import; wire up for change #3 if filter UIs need it |

---

## Appendix C — Smells with ADS-migration impact

(Distinct from BROKEN-FEATURES — these are code-quality issues that change #2 should clean up while refactoring, not standalone broken features.)

### C.1 Server-side `dangerouslyAllowBrowser: true` on OpenAI clients

4 locations (see COMPONENT-INVENTORY Appendix B.5). Misleading flag in server-only code paths. **Action for change #2:** Remove during service-layer hardening.

### C.2 `(client)/layout.tsx` `"use client"` + `metadata` contradiction

Single file, but architecturally significant. **Action for change #2 or #3:** Consolidate to single root `src/app/layout.tsx` (server-side, exports metadata + ClerkProvider); `(client)` layout becomes a child that only adds dashboard-specific shell (Navbar, SideMenu).

### C.3 Hardcoded `https://folo-up.co/` external links

3 locations (see BROKEN-FEATURES §2.3). Brand URL drift risk. **Action for change #2:** Replace with `process.env.NEXT_PUBLIC_MARKETING_URL` while doing brand-token migration in the same files.

### C.4 `any`-typed service payloads and response/interview `details`

Pervasive `any` usage in service layer (see COMPONENT-INVENTORY Appendix B.1). **Action for change #2:** Replace with proper types as part of "consume `@atlaskit/tokens`" work. Brand-color migration touches the same files (interview detail page especially), so consolidate.

### C.5 Lowercase-exported components

4 components (see COMPONENT-INVENTORY Appendix B.3). React DevTools display + eslint suppression noise. **Action for change #2:** Rename when each component is touched for ADS migration.

### C.6 `(client)/layout.tsx` separate ClerkProvider instances

`(client)` and `(user)` each mount ClerkProvider independently. **Action:** Consolidate at root layout (see C.2).

### C.7 Accessibility — DEFERRED scope statement

**Accessibility audit (WCAG AA contrast, ARIA coverage, keyboard navigation, screen-reader compatibility) is OUT OF SCOPE for this audit.** Change #2's QA checklist MUST include:

1. **WCAG AA contrast verification** for the recommended brand-color token (D3b option (a) — `#4F46E5`) against `color.background.neutral.subtlest` (light bg) AND `color.background.neutral.bold` (dark bg). `#4F46E5` on white passes AA for large text (~4.6:1) but **fails AA for small text** (requires 4.5:1, exact value depends on rendering). Change #2 must either use the brand color only for large text/UI elements or define a darker `--ds-brand-bolder` for small text.
2. **ARIA attribute coverage audit** on every non-Radix interactive surface, especially the custom `src/components/dashboard/Modal.tsx` (no focus trap, no `aria-modal`, no ESC handling — replacement with Radix Dialog fixes all three).
3. **Keyboard navigation paths** for the candidate interview flow (`/call/[interviewId]` → start → in-call controls → end → feedback). The `Call` component (`src/components/call/index.tsx`, 696 lines) is the largest interactive surface and most worth a keyboard-only walkthrough.
4. **ChromePicker (`react-color`) replacement audit.** If kept, the ChromePicker has limited keyboard accessibility (HSL sliders are mouse-only by default). Recommend replacement with Radix Popover + ADS swatch palette (item 3.2 above) which is keyboard-navigable by construction.
5. **Color-contrast across the analytics PieCharts** in `summaryInfo.tsx`. The MUI default color palette may not pass AA for adjacent slices.

### C.8 Z-index / elevation collision risk during ADS migration

Tailwind defaults (`z-0` through `z-50`) are flat numbers; ADS uses an elevation layer model. When introducing ADS elevation tokens in change #2, every modal/popover/dropdown stacking must be re-verified. Specific risks:

- Custom `Modal` overlapping with Radix `AlertDialog` (both at high z-index but unrelated stacks)
- ChromePicker popover overlapping with EditInterview AlertDialog
- Sonner Toast vs modal overlays

Change #2's QA must include a stacking-order test pass.

### C.9 Dead `@tanstack/react-query` provider

QueryClient wraps the app but no `useQuery`/`useMutation` calls exist (see COMPONENT-INVENTORY Appendix A). **Decision for change #2:** Adopt (refactor contexts to use react-query for server-state caching) or remove (drop the provider). Recommend ADOPT — would naturally clean up the silent-error patterns in services by providing a structured `error`/`isError`/`isPending` interface for components to render error states from.

---

## §D — Audit metadata

- **Manifest source:** cgc step output (full index — 90 source files inventoried)
- **Fetched ADS docs:** 2026-05-19 from https://atlassian.design/components/tokens
- **Cached ADS token names** (in case docs change before change #2 runs): see §2 above — these are stable in public ADS v17+ (verified 2026-05-19). If a token name conflicts with new ADS docs at change #2 time, prefer the new ADS doc and update this file as a precursor task to change #2's apply step.
- **Decision authority:** D3b brand-color, D4b motion, library consolidation list, and dark mode enable recommendation are BINDING for change #2. Change #2 may override with a documented rationale in its own `proposal.md`.
