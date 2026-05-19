# Design — redesign-app-surfaces-adaline

## Context

The redesign covers app surfaces only: recruiter dashboard, interview detail, interviewer library, and candidate call/session pages. Current surfaces already contain the right underlying data and route structure, but the information architecture is inventory-first, visual treatments are inconsistent, dark mode still leaks through providers and utility classes, and the candidate journey is implemented inside one large runtime component that mixes transport state with presentation.

The locked brainstorming decisions constrain this change in useful ways:
- Jobs are a derived UX layer built from existing `interview` and `response` data, not a new persistence model.
- The Adaline light theme becomes the only app theme.
- The recruiter experience shifts toward hiring decisions and bottlenecks.
- The candidate experience prioritizes calm guidance and trust.
- Interviewers stay on current CRUD but are presented as personas.

## Goals / Non-Goals

**Goals:**
- Establish one Adaline-based light-only system for all in-scope recruiter and candidate surfaces.
- Re-layout dashboard and interview detail around a hiring-workflow mental model without changing route or data contracts.
- Redesign the candidate flow so every state shares one calm, trustworthy visual language.
- Rebuild interviewer management into a persona library/studio using the existing fields and API behavior.
- Keep implementation deployable as frontend-only work with safe rollback via code revert.

**Non-Goals:**
- Auth, homepage, marketing, or static-page redesign.
- Database migrations, new tables, or a first-class persisted jobs model.
- Rewriting response lifecycle semantics or Retell integration behavior.
- Preserving dark mode as a supported option.
- Blocking the redesign on self-hosted Akkurat or Fragment Mono font assets.

## Decisions

### D1. Replace the theme stack with a single light-only Adaline system

`src/app/globals.css` becomes the source of truth for Adaline tokens: canvas, ink, moss, valley-green, amber-seed, typography scales, spacing, radius, and subtle borders. `src/components/providers.tsx` stops mounting `NextThemesProvider`, `src/components/shell/app-sidebar.tsx` loses theme controls entirely, and shared UI primitives are restyled so buttons, cards, dialogs, inputs, tabs, banners, and empty states all inherit the same surface language.

Why this approach:
- The redesign request explicitly removes dark mode.
- A token-first rewrite creates the most leverage across routes and shared components.

Alternatives considered:
- Keep dual theme support and only set light as default: rejected because it preserves the very complexity and inconsistency this redesign is trying to eliminate.
- Reskin pages one by one without replacing primitives: rejected because it would leave mixed component languages in place.

### D2. Keep the current route map but change the mental model

The redesign stays on existing routes:
- `/dashboard` becomes the recruiter command center.
- `/interviews/[interviewId]` becomes the job workspace.
- `/dashboard/interviewers` becomes the persona library/studio.
- `/call/[interviewId]` remains the candidate entry route.

Why this approach:
- The current route map already matches the product workflow closely enough.
- Avoiding route churn keeps implementation focused on layout, hierarchy, and component systems instead of navigation migrations.

Alternatives considered:
- Add a dedicated `/jobs` route and split the workspace across additional pages: rejected for this change because it adds navigation complexity without unlocking new data.

### D3. Build a derived hiring-workflow view model from existing interview and response fields

Recruiter-facing job and pipeline UI should be computed from current entities rather than fetched from new APIs. The implementation should introduce shared selectors or helper functions that derive:
- job definition from `interview.name`, `objective`, `description`, `questions`, `interviewer_id`, `time_duration`
- live/interrupted/completed state from `response.status`
- review outcome and shortlist signals from `response.candidate_status`
- session quality and completion cues from `analytics`, `questions_covered`, `disconnection_reason`, `is_viewed`, and `created_at`

Why this approach:
- The backend already contains the signals needed for a jobs/pipeline UX.
- Centralized derivation reduces duplicated, per-component view logic.

Alternatives considered:
- Keep the current raw interview card and response list framing: rejected because it leaves the recruiter experience inventory-driven.
- Introduce a new backend jobs abstraction: rejected by scope and the no-DB-change constraint.

### D4. Demote `theme_color` from page theming to an optional subtle marker

The existing `interview.theme_color` field remains in storage, but it no longer controls broad candidate theming or shell colors. If preserved in the UI, it should appear only as a small accent marker on recruiter-facing job identity surfaces where it does not break the single-system look.

Why this approach:
- It preserves existing data without letting per-interview customization fragment the product language.
- It removes a direct conflict with the locked single-theme decision.

Alternatives considered:
- Continue using `theme_color` across candidate and recruiter surfaces: rejected because it undermines consistency.
- Delete or migrate away from `theme_color`: rejected because schema changes are out of scope.

### D5. Split the candidate runtime into view-oriented seams while preserving behavior

`src/components/call/index.tsx` is too large and state-dense to safely redesign as one monolith. The implementation should preserve the existing lifecycle semantics but separate presentation into clearer subviews for:
- preflight/readiness
- active call shell
- reconnect/resume states
- terminal/feedback states
- exceptional states such as offline, expired, invalid, and mobile blocked

Why this approach:
- It lowers change risk in the most complex component in scope.
- It makes visual consistency across candidate states achievable without tangling transport logic further.

Alternatives considered:
- Pure reskin of the current monolith: rejected because it is likely to create fragile JSX branches and inconsistent states.

### D6. Rebuild recruiter pages on shared editorial shell primitives before page-specific detailing

`PageShell` and other shared layout primitives should be upgraded first to enforce width, rhythm, spacing, and action placement. Then dashboard, job workspace, interviewer library, and candidate shells can compose from that baseline rather than each inventing its own spacing and hierarchy.

Why this approach:
- Shared shells reduce layout drift.
- It keeps the redesign maintainable after the first wave of implementation.

Alternatives considered:
- Rebuild each page with bespoke layout wrappers: rejected because it would recreate inconsistency.

## Risks / Trade-offs

- `src/components/call/index.tsx` is a high-risk component → Mitigation: separate visual subviews from lifecycle logic and verify each candidate state explicitly.
- Dashboard cards currently fetch related data per card and are not command-center ready → Mitigation: move derived metrics closer to the page/workspace layer or shared selectors so the new layout does not depend on decorative per-card network work.
- Removing dark mode reaches providers, shell, globals, and route-level utility classes → Mitigation: treat theme removal as a first implementation slice and search for remaining `dark:` usage before page polish.
- Exact Adaline typography is not available in-repo today → Mitigation: define the token contract now and use fallback stacks until assets are sourced.
- Demoting `theme_color` may make recruiter-side color customization feel reduced → Mitigation: keep a small identity accent where it adds recognition without taking over the interface.

## Verification Strategy

This repo does not currently ship a dedicated frontend unit-test harness for
route-level React UI, so verification for this change is a layered mix of
static checks, pure selector design, and route-state validation.

### Automated checks

- Keep derived recruiter workflow logic centralized in pure helpers (for this
  change: `src/lib/hiring-workflow.ts`) so it is type-checkable and can be
  validated independently of route rendering.
- Run targeted `eslint` on the redesigned recruiter, interviewer, and
  candidate files after each slice lands.
- Run repo-wide `tsc --noEmit` after integration to catch state-shape drift,
  stale imports, and cross-slice typing errors.
- Run `git diff --check` before ship to catch formatting / whitespace issues.

### Manual route-state matrix

The redesign must be checked against these UI branches when a local browser
session is available:

- Recruiter dashboard: populated, empty, quota-reached, live-session present
- Recruiter workspace: summary, candidate selected, no-candidate-yet,
  interrupted / abandoned candidates visible in rail
- Interviewer library: populated, empty, create flow, detail modal, delete
  confirmation
- Candidate session: loading, invalid, closed, mobile-blocked, preflight,
  reconnect ready, reconnect failure, offline, active session, completion,
  feedback submitted

### Current limitation

If local port binding is unavailable in the execution environment, treat the
manual browser pass as a release-risk item to be completed on a machine that
can run the Next.js dev server. Static verification still proceeds, but the
ship / QA summary must call out the missing live browser check explicitly.

## Migration Plan

1. Replace the global token and provider stack so all in-scope surfaces inherit the new light-only foundation.
2. Update shared UI primitives and recruiter shell/navigation to establish the new component language.
3. Rebuild the recruiter dashboard and job workspace around shared derived selectors for pipeline and session health.
4. Refactor the candidate runtime into presentational seams and redesign each session state on the new system.
5. Rebuild the interviewer library and persona composition flows to match the same system.
6. Run final verification for responsive layouts, light-only behavior, and unchanged route/API behavior.

Rollback strategy:
- This is frontend-only work. Reverting the change restores the previous layout/theme behavior without data migration concerns.

## Open Questions

- Whether Akkurat and Fragment Mono assets will be added during implementation or deferred as a follow-up polish task.
- Whether dashboard-level aggregation should remain purely client-derived in this change or be lightly reorganized to reduce repeated fetches inside `InterviewCard`.
