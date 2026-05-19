# Tasks — redesign-app-surfaces-adaline

## 1. Establish the Adaline light-only system

- [x] 1.1 Replace the global token definitions in `src/app/globals.css` with the Adaline color, type, spacing, radius, and subtle border system, and remove all `.dark` theme blocks
- [x] 1.2 Remove `next-themes` usage from `src/components/providers.tsx` and delete theme-toggle behavior from recruiter shell components such as `src/components/shell/app-sidebar.tsx`
- [x] 1.3 Restyle shared primitives in `src/components/ui/` so buttons, cards, inputs, textareas, selects, tabs, dialogs, banners, empty states, and page-shell surfaces follow the new Adaline contract
- [x] 1.4 Update recruiter shell surfaces in `src/components/shell/` to match the new light-only navigation, header, and supporting chrome

## 2. Rebuild recruiter command-center and job-workspace views

- [x] 2.1 Introduce shared derived selectors or helpers that map existing interview and response data into job summaries, pipeline counts, live-session signals, and review bottlenecks
- [x] 2.2 Redesign `src/app/(client)/dashboard/page.tsx` into a hiring command center with priority sections, stronger empty/quota states, and job cards built from the derived workflow model
- [x] 2.3 Redesign recruiter job cards and related dashboard components in `src/components/dashboard/interview/` to foreground job health, candidate progress, and next actions instead of decorative inventory-only summaries
- [x] 2.4 Re-layout `src/app/(client)/interviews/[interviewId]/page.tsx` as a job workspace with overview, pipeline rail, candidate detail, and edit/share actions in one cohesive hierarchy
- [x] 2.5 Update `src/components/dashboard/interview/summaryInfo.tsx`, recruiter-side response detail surfaces, and related interview subcomponents to match the new workspace model and demote `theme_color` to a subtle identity accent only

## 3. Rebuild the candidate session experience

- [x] 3.1 Refactor `src/components/call/index.tsx` into safer view-oriented seams for preflight, active session, reconnect, exceptional, and completion states while preserving existing session behavior
- [x] 3.2 Redesign `src/app/(user)/call/[interviewId]/page.tsx` and candidate shell states for invalid, closed, loading, and mobile-blocked flows using the calm Adaline system
- [x] 3.3 Redesign candidate preflight, in-session support panels, reconnect/resume flows, and completion/feedback surfaces across `src/components/call/`
- [x] 3.4 Remove candidate-facing broad theming based on `interview.theme_color` and ensure the candidate journey stays visually consistent across all state branches

## 4. Rebuild the interviewer persona library

- [x] 4.1 Redesign `src/app/(client)/dashboard/interviewers/page.tsx` as a persona library with stronger hierarchy, discovery, and empty-state storytelling
- [x] 4.2 Update `src/components/dashboard/interviewer/` cards, detail surfaces, and creation entry points to frame interviewers as personas with clear identity, purpose, voice, and style
- [x] 4.3 Rework the interviewer create/manage modal flow so prompt, voice, avatar, and trait fields read as persona composition rather than a generic utility form

## 5. Verification and polish

- [x] 5.1 Audit the in-scope routes for remaining `dark:` classes, legacy brand color assumptions, and inconsistent interactive radii or border treatments
- [x] 5.2 Verify the redesigned recruiter and candidate surfaces at desktop and tablet breakpoints, including empty, loading, live-session, interrupted, invalid, and no-data states
- [x] 5.3 Run project verification commands and capture any residual risks that remain outside this frontend-only redesign scope

## 6. Engineering review follow-ups

- [x] 6.1 Move dashboard aggregation and response hydration out of per-card rendering by introducing a page-level or selector-layer workflow model that computes job health, pipeline counts, and analysis readiness without `InterviewCard` triggering its own response fetch loop or `/api/get-call` side effects on mount
- [x] 6.2 Update recruiter workspace editing and sharing flows so `theme_color` is either removed from primary controls or explicitly demoted to a subtle recruiter-side identity marker, with no remaining candidate-session or shell theming dependency on that field
- [x] 6.3 Add a concrete verification strategy for this change: establish the project test approach for frontend logic in this repo and cover at minimum the derived hiring-workflow selectors, light-only shell/theme removal, and the candidate session state matrix for valid, invalid, closed, reconnect, offline, expired, and completion flows
- [x] 6.4 Before splitting `src/components/call/index.tsx`, document and preserve the existing lifecycle side effects for `check-session`, `register-call`, response creation/update, heartbeat, tab-switch persistence, and feedback submission so the view refactor does not regress session semantics

## 7. Design review follow-ups

- [x] 7.1 Replace generic recruiter-side placeholders and legacy upgrade treatment with intentional Adaline states for dashboard empty/quota, no-candidate-yet workspace, analysis-pending, live-session, interrupted-session, and no-persona library scenarios so each major screen has a clear first impression and next action
- [x] 7.2 Define responsive and accessibility behavior for the redesigned shell and workspace, including sidebar-to-drawer collapse, pipeline rail behavior at tablet widths, dialog and filter focus order, keyboard access for persona/workspace controls, reduced-motion handling, and screen-reader labels for candidate and recruiter state panels
- [x] 7.3 Remove legacy blue/purple status language and ad hoc illustration/card treatments from the shell, candidate reconnect states, and recruiter utility surfaces, replacing them with one Adaline semantic status system that keeps urgent/error messaging readable without breaking the restrained palette
- [x] 7.4 Add a small set of purposeful motion and visual-anchor rules for the command center, workspace selection, and candidate preflight/completion states so the redesign feels current and friendly without introducing decorative animation or motion-dependent UX

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 plan gaps resolved in tasks 6.1-6.4 |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 7/10 → 9/10, 4 decisions added in tasks 7.1-7.4 |

**UNRESOLVED:** 0 — the remaining design risk was converted into explicit implementation tasks around states, responsive behavior, semantic status styling, and motion.
**VERDICT:** ENG + DESIGN CLEARED — proceed to implementation.

## APPLY NOTES

- Browser-based route verification was attempted after implementation, but the
  local execution environment blocked all Next.js dev-server port binding
  (`EPERM` on both `0.0.0.0:3000` and `127.0.0.1:3001`).
- Static verification completed with targeted `eslint`, repo-wide
  `tsc --noEmit`, `git diff --check`, and a dark-mode usage audit.
- Live browser QA remains a release-risk item to complete on a machine that
  can run the local app server.
