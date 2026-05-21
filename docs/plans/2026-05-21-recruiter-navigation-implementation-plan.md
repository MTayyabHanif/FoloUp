# Recruiter Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the recruiter shell into `Dashboard`, `Jobs`, and `Personas`, move job inventory off the dashboard, and introduce contextual job-local navigation without polluting the compact primary rail.

**Architecture:** Introduce stable top-level routes first, then extract the existing interview and interviewer surfaces into shared page modules so both legacy and new URLs can coexist during migration. Once route foundations exist, update the shell to compute primary navigation from product domains and render a contextual job submenu for `/jobs/[jobId]` pages.

**Tech Stack:** Next.js App Router, React, TypeScript, Clerk, Biome, Node test runner

---

### Task 1: Navigation helpers and tests

**Files:**
- Create: `src/components/shell/sidebar-nav.test.mjs`
- Modify: `src/components/shell/sidebar-nav.ts`
- Modify: `src/components/shell/app-sidebar.tsx`

**Step 1: Write the failing test**

Add tests for:
- stable primary destinations: dashboard, jobs, personas
- contextual job submenu when pathname matches `/jobs/[jobId]`
- no contextual submenu on dashboard/personas routes

**Step 2: Run test to verify it fails**

Run: `node --test src/components/shell/sidebar-nav.test.mjs`
Expected: FAIL because the helper does not yet model the new navigation.

**Step 3: Write minimal implementation**

Refactor the navigation manifest into route-aware helpers that expose:
- primary nav items
- job-context submenu items when inside a job route
- active state helpers usable by the compact rail

**Step 4: Run test to verify it passes**

Run: `node --test src/components/shell/sidebar-nav.test.mjs`
Expected: PASS

### Task 2: Jobs route surface

**Files:**
- Create: `src/components/jobs/jobs-page.tsx`
- Create: `src/components/jobs/use-job-workflows.ts`
- Create: `src/app/(client)/jobs/page.tsx`
- Modify: `src/app/(client)/dashboard/page.tsx`

**Step 1: Write the failing test**

Add or extend a helper-level test around workflow summary extraction if needed; otherwise use route verification plus typecheck as the red/green boundary for the extraction.

**Step 2: Run verification to show the current dashboard still owns job inventory**

Run: `rg -n "Job workflows|CreateInterviewCard|InterviewCard" src/app/(client)/dashboard/page.tsx`
Expected: existing dashboard page still contains job inventory concerns.

**Step 3: Write minimal implementation**

Extract the job workflow data logic and build `/jobs` as the canonical inventory page with:
- job grid
- create job action
- empty/loading states

Trim `/dashboard` so it only owns overview content.

**Step 4: Run checks**

Run: `yarn tsc --noEmit`
Expected: PASS

### Task 3: Personas route surface

**Files:**
- Create: `src/app/(client)/personas/page.tsx`
- Create or Modify: shared persona page module extracted from `src/app/(client)/dashboard/interviewers/page.tsx`
- Modify: `src/app/(client)/dashboard/interviewers/page.tsx`

**Step 1: Write the failing test**

Use route/helper coverage for nav plus static route existence as the red/green boundary.

**Step 2: Verify current persona surface lives under dashboard**

Run: `rg -n "/dashboard/interviewers|Persona Library" src/app/(client) src/components`
Expected: persona route still hangs off dashboard.

**Step 3: Write minimal implementation**

Create `/personas` as the canonical route and convert the old `/dashboard/interviewers` page into a redirect or thin compatibility wrapper.

**Step 4: Run checks**

Run: `yarn tsc --noEmit`
Expected: PASS

### Task 4: Job workspace route migration

**Files:**
- Create: shared job workspace module extracted from `src/app/(client)/interviews/[interviewId]/page.tsx`
- Create: `src/app/(client)/jobs/[jobId]/page.tsx`
- Create: shared job invites module extracted from `src/app/(client)/interviews/[interviewId]/invites/page.tsx`
- Create: `src/app/(client)/jobs/[jobId]/invites/page.tsx`
- Modify: legacy interview route pages to redirect or wrap shared modules

**Step 1: Write the failing test**

Extend navigation tests to cover contextual submenu entries for `/jobs/[jobId]` and `/jobs/[jobId]/invites`.

**Step 2: Run test to verify it fails**

Run: `node --test src/components/shell/sidebar-nav.test.mjs`
Expected: FAIL if the submenu contract is not yet satisfied.

**Step 3: Write minimal implementation**

Move the current job workspace and invites behavior behind `/jobs/...` and preserve legacy `/interviews/...` entry points through redirects or wrappers.

**Step 4: Run test to verify it passes**

Run: `node --test src/components/shell/sidebar-nav.test.mjs`
Expected: PASS

### Task 5: Compact rail and contextual submenu UI

**Files:**
- Modify: `src/components/shell/app-sidebar.tsx`
- Create or Modify: `src/components/shell/sidebar-nav.ts`
- Create: `src/components/shell/job-context-nav.tsx`
- Modify: `src/app/(client)/layout.tsx`
- Modify: `src/components/shell/app-header.tsx`

**Step 1: Write the failing test**

Add server-rendered markup assertions for:
- exactly three primary rail destinations
- contextual job submenu rendering only on job routes

**Step 2: Run test to verify it fails**

Run: `node --test src/components/shell/sidebar-nav.test.mjs`
Expected: FAIL because the current rail does not match the approved hierarchy.

**Step 3: Write minimal implementation**

Render:
- primary rail with `Dashboard`, `Jobs`, `Personas`
- job-context submenu attached to the shell/content seam for job routes
- breadcrumb labels aligned to the new route model

**Step 4: Run test to verify it passes**

Run: `node --test src/components/shell/sidebar-nav.test.mjs`
Expected: PASS

### Task 6: Link migration and verification

**Files:**
- Modify: any components that deep-link to `/interviews/...` or `/dashboard/interviewers`
- Modify: shell/header/footer links as needed

**Step 1: Write the failing check**

Run: `rg -n '"/interviews/|`/interviews/|"/dashboard/interviewers"|`/dashboard/interviewers`' src`
Expected: remaining legacy links identified for migration.

**Step 2: Write minimal implementation**

Update internal links to prefer `/jobs/...` and `/personas` while preserving compatibility for old URLs.

**Step 3: Run focused verification**

Run:
- `node --test src/components/shell/sidebar-nav.test.mjs`
- `yarn biome check src/components/shell/sidebar-nav.ts src/components/shell/app-sidebar.tsx src/components/shell/app-header.tsx`
- `yarn tsc --noEmit`

Expected: PASS
