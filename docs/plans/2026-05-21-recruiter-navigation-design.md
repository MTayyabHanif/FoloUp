# Recruiter Navigation Redesign

**Date:** 2026-05-21

## Goal

Restructure the recruiter shell so the compact icon rail reflects stable product domains instead of a mixture of overview pages and deep workspace routes.

## Approved Information Architecture

- `/dashboard`: overview only
- `/jobs`: collection page for all job workflows
- `/jobs/[jobId]`: job workspace
- `/jobs/[jobId]/invites`: invite management inside a job
- `/personas`: persona library

## Navigation Model

### Primary navigation

The icon rail should contain only stable top-level destinations:

- Dashboard
- Jobs
- Personas

Deep routes must not appear as peer rail items.

### Job-local navigation

When the user is inside a job route, the shell should reveal contextual sub-navigation attached to the active `Jobs` destination rather than introducing new primary icons. The job-local areas are:

- Overview
- Candidates or session/review surface
- Invites
- Settings or edit

The visual treatment should read as secondary navigation.

## Page Responsibilities

### Dashboard

Keep:

- metrics
- live sessions
- review queue
- urgent next actions

Remove:

- job workflows inventory grid

### Jobs

Own:

- job workflows grid
- search/filter
- active/paused status browsing
- primary `Create job` action

### Job workspace

Own:

- current job summary/workspace surface
- candidate sessions
- share/edit actions
- contextual child areas such as invites

### Personas

Own:

- persona library
- primary `Create persona` action

## Migration Intent

- Current dashboard route stays, but narrows to overview.
- Current interview detail surfaces become job routes conceptually and by URL.
- Current interviewers route becomes personas.
- Compatibility redirects or wrappers should preserve the old URLs during migration.
