# Design: Rebrand FoloUp → Robust Devs Hiring

## 1. Replacement Strategy

This is a strict text-swap-plus-rename with zero functional changes:

- **String replacements** are surgical: each file is edited at the exact lines identified in the cgc inventory. No regex-bulk-replace across the whole repo; every change is verified by line number.
- **Asset rename** uses `git mv public/FoloUp.png public/robust-devs-hiring.png` to preserve git history for the file.
- **Docs rewrites** (`README.md`, `CONTRIBUTING.md`) are full-file replaces (not surgical), but they are documentation only — no code execution path is affected.
- **Docker service rename** (`foloup` → `app`) is internal to `docker-compose.yml`. The service is not referenced externally (no depends_on from other services using the old name), so the rename is safe.
- No database migrations, no infra changes, no secrets rotated.

## 2. JSX Brand-Span Decision

**Chosen: Option (b) — wrap "Devs Hiring" in `text-brand-bold`**

Rationale:
- The original pattern `Folo<span className="text-brand-bold">Up</span>` uses the span to visually distinguish the suffix and give the name weight in headers and sidebars.
- "Robust Devs Hiring" has a natural split: "Robust" as the brand qualifier, "Devs Hiring" as the product descriptor. Wrapping "Devs Hiring" in `text-brand-bold` mirrors the original intent — a lighter prefix + a heavier, more salient ending.
- Option (a) (drop the span entirely) would flatten the visual hierarchy across 7 UI locations, requiring a CSS/design follow-up to restore weight. That is out of scope for this text-only change.
- Result: `Robust <span className="text-brand-bold">Devs Hiring</span>` at all 7 JSX locations.

## 3. CONTRIBUTING.md Decision

**Decision: Rewrite as a brief internal-contribution guide (do not delete).**

Rationale:
- The file currently contains OSS-framing content (fork instructions, shields.io badges, `github.com/FoloUp/FoloUp` URLs, public contributor guidelines).
- Deleting it entirely would leave no documented contribution process for the internal team — unhelpful when onboarding new engineers.
- A short rewrite (~1 page) covering branch naming, PR review expectations, and deployment process is more useful than nothing, and the resulting file won't be near-empty.
- Content outline: branch naming convention (`feat/`, `fix/`, `chore/`), PR review (1 approval required), testing expectations, deployment (Vercel auto-deploy on merge to `main`), and contact (`hi@robustagency.co`).

## 4. Edge Cases

### Asset rename: macOS case-sensitivity bug
`public/FoloUp.png` vs `public/foloup.png` — macOS HFS+ is case-insensitive by default, meaning a reference to `/foloup.png` would silently resolve on macOS but 404 on Linux (Vercel's build environment). The rename to `robust-devs-hiring.png` (fully lowercase, hyphenated) eliminates this latent bug in one move. Use `git mv` (not `mv` + `git add`) to ensure git tracks the rename atomically.

### `yarn.lock` / lock-file regeneration
This project uses **yarn** (`yarn.lock` exists; CI runs `yarn install`; README instructs `yarn`). `yarn.lock` v1 does **not** embed the `package.json` `name` field, so renaming `foloup-app` → `robust-devs-hiring-app` has zero effect on dependency resolution and lock-file content. No lock-file regeneration is required. The post-apply step in `tasks.md` has been corrected accordingly.

### `text-brand-bold` class
Left as-is. It is a generic styling token (the CSS comment `// FoloUp brand (--ds-brand-bold)` is updated to remove the old brand name, but the class name itself is unchanged). Renaming it would require touching every file that uses the class — that balloon diff is a separate refactor if ever needed.

### Docker service rename safety
`docker-compose.yml` currently has one service named `foloup`. Verify with `grep -n "foloup" docker-compose.yml` that no other service references `foloup` in a `depends_on` or network alias before applying. If found, update those references too (none expected per cgc inventory).

### `.env.example` vs runtime `.env`
Only `.env.example` is in scope (committed to the repo). The operator's local `.env` / Vercel environment variables are updated separately — this change only documents the new default.

## 5. Rollback Note

All changes land in a single commit. Rolling back is:
```
git revert <commit-sha>
```
No database migrations are involved. The `git mv` for the OG image is reversible with `git mv public/robust-devs-hiring.png public/FoloUp.png`. No destructive moves beyond the `git mv`.

## 6. Acceptance Criteria

After applying, the QA step verifies:

```bash
git grep -i foloup -- ':!openspec/changes/archive/' ':!.claude/'
```
Must return **empty** (exit code 1 from git grep).

```bash
git grep -i "folo-up" -- ':!openspec/changes/archive/' ':!.claude/'
```
Must return **empty**.

```bash
git grep -i "folo" -- ':!openspec/changes/archive/' ':!.claude/'
```
Must return **empty**. This broader check catches the JSX split pattern `Folo<span className="text-brand-bold">Up</span>` that the two narrower greps would silently miss if any of the 7 JSX locations were accidentally skipped.

Additionally:
- `src/app/layout.tsx` OG image path references `robust-devs-hiring.png`
- `public/robust-devs-hiring.png` exists; `public/FoloUp.png` does not
- `package.json` `name` is `robust-devs-hiring-app`
- `docker-compose.yml` service is named `app`
- `src/app/(client)/dashboard/page.tsx` contact email is `hi@robustagency.co`
