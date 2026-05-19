# Proposal — redesign-app-surfaces-adaline

## Why

The app surfaces currently feel like a mix of older dashboard inventory screens, ad hoc candidate-state cards, and a split light/dark system that does not match the product direction. This change rebuilds the recruiter and candidate experience around a calm, modern hiring workflow using the Adaline light theme, while keeping the current APIs, routes, and database model intact.

## What Changes

- Replace the current mixed token system with a single Adaline-based light theme across recruiter and candidate app surfaces.
- Remove dark mode from providers, shell controls, shared primitives, and page/component styling.
- Reframe `/dashboard` as a hiring command center that surfaces live sessions, review bottlenecks, quota state, and job health before raw inventory.
- Rebuild `/interviews/[interviewId]` as a job workspace with overview, pipeline, candidate detail, and edit/share actions inside one coherent layout.
- Redesign `/call/[interviewId]` and the candidate runtime states into a calmer guided session flow with consistent preflight, reconnect, closed, invalid, offline, and completion surfaces.
- Rebuild `/dashboard/interviewers` as a persona library and studio using existing interviewer CRUD and metadata.
- Normalize empty states, banners, dialogs, forms, buttons, cards, and navigation onto the same Adaline surface language.

## Capabilities

### New Capabilities
- `adaline-light-theme-system`: Define the single light-only visual system, shared tokens, and component behaviors for all in-scope app surfaces.
- `recruiter-hiring-workspace`: Reframe dashboard and interview-detail surfaces around derived jobs, pipeline health, and hiring decisions using existing interview and response data.
- `candidate-session-experience`: Deliver a calm, guided candidate journey across preflight, active session, reconnect, blocked, invalid, and completion states.
- `interviewer-persona-library`: Present interviewers as curated personas with stronger library, detail, and composition flows using current CRUD capabilities.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/app/(client)/dashboard/`, `src/app/(client)/interviews/[interviewId]/`, `src/app/(client)/dashboard/interviewers/`, `src/app/(user)/call/[interviewId]/`, `src/components/call/`, `src/components/dashboard/`, `src/components/shell/`, `src/components/ui/`, `src/components/providers.tsx`, `src/app/globals.css`
- Data and APIs: no database migrations, no new backend entities, no route-contract changes; jobs/pipeline views are derived from existing `interview` and `response` fields
- Dependencies and systems: removal of `next-themes` usage from app surfaces, rework of shared primitives and layout shells, likely decomposition of the candidate call runtime for safer visual/state separation
