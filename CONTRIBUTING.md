# Contributing

Internal contribution guide for the Robust Devs Hiring app.

## Branch naming

Use one of these prefixes followed by a short kebab-case slug:

- `feat/<slug>` — new feature or capability
- `fix/<slug>` — bug fix
- `chore/<slug>` — tooling, dependency, or non-functional change
- `refactor/<slug>` — restructure without behaviour change

Example: `feat/candidate-status-filter`, `fix/interview-card-loading-state`.

## Pull request process

1. Open the PR against `main`.
2. Make sure the build passes locally before pushing:
   ```bash
   yarn build
   ```
3. The Vercel preview deployment must be green. Use the preview URL for visual / functional QA.
4. One approval is required before merge. Squash-merge is the default — keep the PR title clean (conventional commits format encouraged: `feat:`, `fix:`, `chore:`, etc.).

## Testing expectations

- Run `yarn build` to catch type and build-time errors.
- Manually test the affected flow on the Vercel preview before requesting review.
- For changes to the candidate (interview) flow, test from both the recruiter dashboard and a candidate browser session.

## Deployment

- Merge to `main` triggers an automatic Vercel deployment to production.
- There is no separate staging branch — the PR preview deployment is the staging environment.

## Questions

Reach out to the team or email `hi@robustagency.co`.
