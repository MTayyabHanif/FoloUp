# Robust Devs Hiring

Internal AI-powered candidate interview platform. Recruiters create role-targeted interviews from a job description, share a one-click link with candidates, and let an AI voice agent conduct the screen. Responses are scored automatically and surface on a recruiter dashboard.

This is the in-house Robust Devs tool. Not for external distribution.

## Stack

- Next.js 15 (App Router, React Server Components)
- Clerk for authentication and organizations
- Supabase (Postgres) for persistence
- Retell AI for the voice-call infrastructure
- OpenAI for question generation and response analytics
- Tailwind + Atlassian Design System tokens for the UI

## Local development

Prerequisites: Node 20+, Yarn.

```bash
yarn
cp .env.example .env
# Fill in the values in .env (see "Environment variables" below)
yarn dev
```

The app boots at [http://localhost:3000](http://localhost:3000).

## Environment variables

See [.env.example](.env.example) for the full list. The required keys group into four buckets:

- **Clerk** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, plus the redirect URLs. Organizations must be enabled in the Clerk dashboard.
- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Run [supabase_schema.sql](supabase_schema.sql) in the SQL editor to create the tables.
- **Retell AI** — `RETELL_API_KEY` from the [Retell dashboard](https://dashboard.retellai.com/apiKey).
- **OpenAI** — `OPENAI_API_KEY` for question generation and analytics.

## Scripts

```bash
yarn dev          # local dev server (webpack)
yarn build        # production build
yarn lint         # biome lint
yarn check        # biome lint + format with --write
yarn check:ci     # biome lint + format, no writes (use in CI)
```

## Deploy

Vercel — production deploys from `main`. Preview deploys per pull request.

## OpenSpec

Architectural changes go through [OpenSpec](https://github.com/Fission-AI/OpenSpec). Live changes live in `openspec/changes/`; archived ones in `openspec/changes/archive/`. Capability specs are in `openspec/specs/`.

## Owners

Robust Devs engineering. Questions: ask in the team Slack.
