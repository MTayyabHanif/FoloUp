# Robust Devs

Internal AI-powered voice interview tool used by Robust Devs to screen candidates. Tailored interview generation, one-click candidate sharing, conversational AI interviews, and a dashboard for reviewing responses and scores.

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** Clerk (with organizations enabled)
- **Database:** Supabase (Postgres + Storage)
- **Voice:** Retell AI
- **AI:** OpenAI (question generation, response analysis)
- **UI:** Tailwind CSS, Radix UI primitives, Atlassian Design System tokens
- **Hosting:** Vercel (production)

## Local development

1. Clone the repo and install dependencies:

   ```bash
   yarn install
   ```

2. Copy the env template and fill in the values:

   ```bash
   cp .env.example .env
   ```

   Required keys (see `.env.example` for the full list):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — from the Clerk dashboard
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — from the Supabase project
   - `RETELL_API_KEY` — from the Retell AI dashboard
   - `OPENAI_API_KEY` — from the OpenAI platform console
   - `NEXT_PUBLIC_MARKETING_URL` — defaults to `https://robustagency.co`

3. Run the dev server:

   ```bash
   yarn dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Database setup

Run the SQL in `supabase_schema.sql` against a fresh Supabase project (SQL Editor → paste → run). This creates the tables the app expects.

## Deployment

Production is hosted on Vercel and auto-deploys on merge to `main`. Per-PR preview deployments are also enabled — use them for QA before requesting review.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the internal contribution workflow.

## Contact

Questions or issues: `hi@robustagency.co`.

## License

MIT. See [LICENSE](LICENSE).
