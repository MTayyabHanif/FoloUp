## Context

This is the second pass on the FoloUp → Robust Devs rebrand. The first pass (archived at `openspec/changes/archive/2026-05-19-rebrand-foloup-to-robust-devs-hiring/`) caught most user-facing strings and renamed `package.json` but missed four categories: the README (still upstream-fork OSS framing), the sign-in/sign-up mobile-fallback wordmarks, the `companyName: "Foloup"` literal that gets interpolated into the analytics LLM prompt at `src/lib/prompts/analytics.ts:158`, and the favicon + logo assets. The prior change deleted `public/FoloUp.png` (the OG image) without producing a replacement and never replaced the favicon at all — `<link rel="icon" href="/browser-client-icon.ico" />` still points at a generic 108 KB browser icon.

The repo's visual identity migrated to the Atlassian Design System token palette (`--ds-brand-bold`, `--color-valley-green`) during the design-system adoption change (`2026-05-19-adopt-atlassian-design-system`). The stranded `text-indigo-600` on the sign-in/sign-up wordmarks is the last reference to the legacy `#4F46E5` FoloUp brand color in user-rendered UI.

## Goals / Non-Goals

**Goals:**
- Eliminate every remaining "Foloup" / "FoloUp" string from non-archive files in the repo (verified via `git grep -i foloup -- ':!openspec/changes/archive/'`).
- Ship a simple, minimal Robust Devs logo + favicon as inline SVG, with no external image tooling required.
- Render the new logo in the only two places that currently show a graphical wordmark: sign-in mobile fallback and sign-up mobile fallback. Other surfaces (sidebar, footer, error pages) keep their existing text-only "Robust Devs" presentation.
- Replace the favicon at the Next.js App Router convention path (`src/app/icon.svg`) so modern browsers pick it up automatically.
- Replace the `companyName: "Foloup"` literal in all four callsites with `"Robust Devs"`, since the value flows into the analytics evaluator LLM prompt.

**Non-Goals:**
- A full logo design system (multiple variants, dark-mode variants, lockups). One SVG monogram is enough for this pass.
- Replacing PNG/ICO favicon variants. Modern browsers honor SVG favicons; legacy browser fallback is acceptable for an internal recruiter-facing tool.
- Restoring an OG image. The prior change explicitly removed the `images:` block from `openGraph` metadata in `src/app/layout.tsx`; that decision stands. Re-adding an OG image is a separate visual-design pass.
- Renaming the existing `public/browser-client-icon.ico` / `browser-user-icon.ico` files. They are unused after the `<link rel="icon">` update and can be deleted in a separate cleanup change (low priority).
- Fixing the case-mismatch bug between `loaderWithLogo.tsx` requesting `/loading-time.png` and the actual file being `public/Loading-Time.png`. Real bug, but orthogonal to the rebrand — handled separately.
- Renaming the local working directory `/Users/tayyab/Projects/foloup` (operator's filesystem; not in repo).
- Modifying the upstream GitHub remote name, the fork relationship, or any git config.

## Decisions

### D1. Logo design: minimal "RD" monogram in SVG

**Decision:** Generate an inline SVG monogram showing the letters "RD" in the brand color, surrounded by a circular ring to give it presence at small sizes. Single color (uses `currentColor` so the SVG inherits whatever color the surrounding text is set to). No gradients, no shadows, no PNG fallback.

**Alternatives considered:**
- *Wordmark "Robust Devs" in custom typography.* Heavier file, harder to render at favicon size (16-64 px), and the sidebar+footer already render the wordmark in plain text.
- *Icon-only abstract mark (no letters).* Would require more design judgment; "RD" is unambiguous and recognizable. Matches the existing sidebar brand-mark which already renders the letters "RD" in a rounded div.
- *PNG/ICO set.* Tooling dependency (ImageMagick, rsvg-convert), more files to maintain. Modern browser support for SVG favicons is now universal.

**Rationale:** The user explicitly asked for "something simple, minimal." The "RD" monogram already exists in text form in the sidebar at [app-sidebar.tsx:55-60](src/components/shell/app-sidebar.tsx:55) — making the favicon and logo a vector version of the same mark is the least surprising visual outcome.

### D2. Favicon path: Next.js App Router convention `src/app/icon.svg`

**Decision:** Place the new SVG at `src/app/icon.svg`. Next.js App Router auto-generates the `<link rel="icon">` for this convention path. Remove the explicit `<link rel="icon" href="/browser-client-icon.ico" />` from [layout.tsx:43](src/app/layout.tsx:43) so the convention path wins without conflict.

**Alternatives considered:**
- *Keep `public/favicon.ico` + explicit `<link>`.* More legacy-compatible but requires generating an ICO file (tooling burden) and the explicit link override is more code to maintain.
- *Leave the `<link rel="icon" href="/browser-client-icon.ico" />` and just replace the file at `public/browser-client-icon.ico`.* Works, but the file name still leaks the old "browser client icon" framing and `.ico` requires PNG/ICO conversion tooling. SVG via App Router is cleaner.

**Rationale:** This is a Next.js App Router project on Next 15. The convention path is the documented approach and produces less boilerplate.

### D3. Logo location: `public/logo.svg`, consumed via `next/image`

**Decision:** Place the reusable logo at `public/logo.svg` and reference it from sign-in / sign-up via `<Image src="/logo.svg" alt="Robust Devs" width={64} height={64} />` (or similar dimensions tuned to the mobile fallback layout). The SVG itself is the same artwork as the favicon — single file would be ideal, but separating them keeps the favicon at `src/app/icon.svg` (App Router convention) and allows the in-page logo to use slightly different sizing without forking the file.

**Alternatives considered:**
- *Inline the SVG directly in each component.* Duplicates the markup across both pages; harder to update.
- *Single file at one location, imported by both.* `src/app/icon.svg` is special-cased by Next.js (it generates `<link>` tags from it) — importing it as a React component from app code is fragile. Two physical files is simpler.

**Rationale:** Two files, same artwork. Tiny duplication, big consistency win.

### D4. Replace `companyName: "Foloup"` with `"Robust Devs"` (exact string)

**Decision:** Replace the four `companyName: "Foloup"` literals with `companyName: "Robust Devs"`. The exact string flows into the LLM prompt at [analytics.ts:158](src/lib/prompts/analytics.ts:158): `"You are a hiring evaluator for a … role at ${args.companyName}."` — so the value is user-visible (well, LLM-visible) and should match the brand name as written elsewhere.

**Alternatives considered:**
- *Pull from env var `NEXT_PUBLIC_COMPANY_NAME`.* Right answer if multi-tenant or white-label, but this is a single-tenant internal tool. YAGNI.
- *Read from `package.json` name.* Awkward (the package name is `robust-devs-hiring-app` — not the brand string).
- *Centralize in a `lib/brand.ts` constant.* Tempting, but four callsites with the same literal is below the threshold for an abstraction. If a fifth callsite appears, refactor then.

**Rationale:** Keep it literal. If white-labeling becomes a need, lift to a single constant or env var at that point.

### D5. README rewrite, not redact

**Decision:** Fully rewrite README.md as a short internal-tool README. Sections: purpose (one paragraph), local dev (prerequisites + commands), env vars (point at `.env.example`), deploy (point at Vercel project), and an internal "who owns this" line. Strip every shields.io badge, every `github.com/FoloUp` link, the "products built on top of FoloUp" section, and the contributor section.

**Alternatives considered:**
- *Targeted edits to remove just the FoloUp strings.* Leaves the structure of an OSS-framed README (badges, "fork this repo" language) which reads wrong for an internal tool.
- *Delete README entirely.* Bad — README is the first thing a new engineer or LLM sees.

**Rationale:** The README's job is different now. Rewrite > redact.

## Risks / Trade-offs

- **[Risk] SVG favicon doesn't render in Safari < 15 / older Android browsers.** → Mitigation: Recruiter-facing internal tool; user base is on current evergreen browsers. If a complaint arrives, add a single `.ico` fallback. Don't pre-emptively engineer for a population that doesn't exist here.
- **[Risk] LLM prompt change (`Foloup` → `Robust Devs`) shifts analytics outputs imperceptibly.** → Mitigation: `Foloup` was meaningless to the LLM — it doesn't know what either name "is." The substitution is cosmetic to anyone reading the prompt. No calibration regression expected, but if scoring drifts, that's caught by `scripts/calibrate-analytics.ts` which is itself updated in this change. Re-running calibration after the change is recommended.
- **[Risk] The `<link rel="icon" href="/browser-client-icon.ico" />` line removal causes a 404 in the network panel before browser cache clears.** → Mitigation: None needed; browsers fall back to the convention path on next load.
- **[Risk] README rewrite loses content someone wanted to keep (e.g., a specific setup nuance).** → Mitigation: Diff carefully; the only content worth preserving is the local dev / env setup info, which is short. Everything else is upstream-fork OSS boilerplate that's no longer accurate.
- **[Trade-off] `currentColor`-driven SVG means the logo inherits the surrounding text color.** That's intentional and matches Next/React idioms, but it does mean designers can't lock the brand color into the asset. → Mitigation: If brand-color enforcement is needed, the SVG can hardcode the hex; we just lose theme-awareness.

## Migration Plan

1. Apply all edits + create new asset files on a single feature branch.
2. Run `yarn dev` locally; verify favicon renders in the browser tab, verify sign-in mobile fallback at 375 px width.
3. Run `git grep -i foloup -- ':!openspec/changes/archive/' ':!.claude/'` — expect zero matches (matches in `.claude/` skill files and archive folders are out of scope).
4. Commit with conventional commit message referencing the change name.
5. Archive locally via /opsx:archive.
6. Push when feature is complete (per /flow's push gate).

**Rollback:** Single feature branch. Hard revert if needed; assets are additive.

## Open Questions

None. Decisions D1-D5 cover the full surface area identified in cgc.
