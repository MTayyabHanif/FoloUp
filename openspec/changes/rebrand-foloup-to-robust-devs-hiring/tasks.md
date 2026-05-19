# Tasks: Rebrand FoloUp → Robust Devs Hiring

## package.json

- [x] `package.json:2` — change `"name": "foloup-app"` → `"name": "robust-devs-hiring-app"`

## src/app/layout.tsx

- [x] `src/app/layout.tsx:12` — change `title: "FoloUp"` → `title: "Robust Devs Hiring"`
- [x] `src/app/layout.tsx:15` — change `title: "FoloUp"` (openGraph.title) → `"Robust Devs Hiring"`
- [x] `src/app/layout.tsx:17` — change `siteName: "FoloUp"` → `"Robust Devs Hiring"`
- [x] `src/app/layout.tsx:20` — change OG image url `"/foloup.png"` (or `"/FoloUp.png"`) → `"/robust-devs-hiring.png"`

## src/app/not-found.tsx

- [x] `src/app/not-found.tsx:6` — change `title: "Page not found · FoloUp"` → `"Page not found · Robust Devs Hiring"`

## src/app/error.tsx

- [x] `src/app/error.tsx:29` — replace `Folo<span className="text-brand-bold">Up</span>` → `Robust <span className="text-brand-bold">Devs Hiring</span>`

## src/app/(user)/error.tsx

- [x] `src/app/(user)/error.tsx:29` — replace `Folo<span className="text-brand-bold">Up</span>` → `Robust <span className="text-brand-bold">Devs Hiring</span>`
- [x] `src/app/(user)/error.tsx:9` — update comment mentioning "FoloUp users" to say "Robust Devs Hiring users"

## src/components/auth-shell.tsx

- [x] `src/components/auth-shell.tsx:30` — replace `Folo<span className="text-brand-bold">Up</span>` → `Robust <span className="text-brand-bold">Devs Hiring</span>`

## src/components/shell/app-sidebar.tsx

- [x] `src/components/shell/app-sidebar.tsx:64` — replace `Folo<span className="text-brand-bold">Up</span>` → `Robust <span className="text-brand-bold">Devs Hiring</span>`

## src/components/shell/app-footer.tsx

- [x] `src/components/shell/app-footer.tsx:9` — change hardcoded fallback `"https://folo-up.co/"` → `"https://robustagency.co"`
- [x] `src/components/shell/app-footer.tsx:18` — replace `Folo<span className="text-brand-bold">Up</span>` → `Robust <span className="text-brand-bold">Devs Hiring</span>`
- [x] `src/components/shell/app-footer.tsx:61` — update comment mentioning "Powered by FoloUp" to say "Powered by Robust Devs Hiring"
- [x] `src/components/shell/app-footer.tsx:66` — change hardcoded fallback `"https://folo-up.co/"` → `"https://robustagency.co"`
- [x] `src/components/shell/app-footer.tsx:79` — replace `Folo<span className="text-brand-bold">Up</span>` → `Robust <span className="text-brand-bold">Devs Hiring</span>`

## src/components/shell/app-header.tsx

- [x] `src/components/shell/app-header.tsx:134` — change hardcoded fallback `"https://folo-up.co/"` → `"https://robustagency.co"`

## src/components/call/index.tsx

- [x] `src/components/call/index.tsx:680` — change hardcoded fallback `"https://folo-up.co/"` → `"https://robustagency.co"`
- [x] `src/components/call/index.tsx:686` — replace `Folo<span className="text-brand-bold">Up</span>` → `Robust <span className="text-brand-bold">Devs Hiring</span>`

## src/app/(client)/dashboard/interviewers/page.tsx

- [x] `src/app/(client)/dashboard/interviewers/page.tsx:53` — update description string mentioning "FoloUp" to say "Robust Devs Hiring"

## src/app/(client)/dashboard/page.tsx

- [x] `src/app/(client)/dashboard/page.tsx:214` — change contact email `founders@folo-up.co` → `hi@robustagency.co`

## src/app/(client)/interviews/[interviewId]/page.tsx

- [x] `src/app/(client)/interviews/[interviewId]/page.tsx:27` — update comment `// FoloUp brand (--ds-brand-bold)` → `// Robust Devs Hiring brand (--ds-brand-bold)`

## .env.example

- [x] `.env.example:5` — change `NEXT_PUBLIC_MARKETING_URL=https://folo-up.co` → `NEXT_PUBLIC_MARKETING_URL=https://robustagency.co`

## public/ (asset removal)

- [x] **Divergence from plan:** The PNG itself has "FoloUp" baked into the artwork (text-rendered logo), so renaming alone would leave a misleading social-card image. Deleted `public/FoloUp.png` and removed the `images: [...]` block from the openGraph metadata in `src/app/layout.tsx`. Logo redesign remains out of scope; OG card will fall back to no image (acceptable for an internal tool).
- [x] Ran `git mv public/FoloUp.png public/robust-devs-hiring.png` then `git rm -f public/robust-devs-hiring.png`

## docker-compose.yml

- [x] `docker-compose.yml:2` — rename service `foloup:` → `app:`
- [x] Verified no other line in `docker-compose.yml` references the old `foloup` service name (e.g., in `depends_on`)

## README.md (full rewrite)

- [x] Rewrote `README.md` as a 1-page internal-tool description covering:
  - What the tool does (hiring workflow manager)
  - Tech stack (Next.js, Supabase, Tailwind, Radix UI)
  - How to run locally (`npm install`, copy `.env.example` → `.env`, `npm run dev`)
  - Deployment target: Vercel (auto-deploys on merge to `main`)
  - Contact: `hi@robustagency.co`
  - Remove all: shields.io badges, `github.com/FoloUp/FoloUp` URLs, "fork this repo" instructions, OSS-contribution framing

## CONTRIBUTING.md (full rewrite — internal guide)

- [x] Rewrote `CONTRIBUTING.md` as a brief internal-contribution guide covering:
  - Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`
  - PR process: open PR against `main`, 1 approval required before merge
  - Testing expectations: run `npm run build` locally before pushing; no broken builds
  - Deployment: Vercel auto-deploys on merge to `main`; staging preview per PR
  - Contact / questions: `hi@robustagency.co`
  - Remove all OSS-contribution content, `github.com/FoloUp` references, and public contributor guidance

## LICENSE

- [x] `LICENSE:3` — change `Copyright (c) 2025 FoloUp` → `Copyright (c) 2025 Robust Devs Hiring`

## Post-apply operator steps

- [x] No lock-file regeneration needed: the project uses `yarn` (not npm), and `yarn.lock` does not embed the `package.json` `name` field — the rename has no effect on dependency resolution. If you prefer to confirm, run `yarn install --frozen-lockfile`.
- [x] Verified zero foloup/folo-up matches: `git grep -i foloup -- ':!openspec/changes/archive/' ':!.claude/'` returns empty
- [x] Verified zero folo-up matches: `git grep -i "folo-up" -- ':!openspec/changes/archive/' ':!.claude/'` returns empty
- [x] Verified zero JSX-split matches (not caught by the above): `git grep -i "folo" -- ':!openspec/changes/archive/' ':!.claude/'` returns empty (only non-brand "folo" hits would indicate a missed JSX edit)
