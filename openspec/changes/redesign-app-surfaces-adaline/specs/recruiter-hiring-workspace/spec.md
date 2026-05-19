## ADDED Requirements

### Requirement: Dashboard surfaces hiring priorities before inventory
The recruiter dashboard SHALL function as a hiring command center that emphasizes live sessions, candidates needing review, pipeline bottlenecks, job health, and directional next actions before presenting the raw list of interviews.

#### Scenario: Dashboard highlights urgent work
- **WHEN** the organization has live or interrupted candidate sessions
- **THEN** the dashboard shows those urgent states prominently above or ahead of the general job inventory

#### Scenario: Empty dashboard remains directional
- **WHEN** the recruiter has no interviews to review
- **THEN** the dashboard presents an intentional empty state with clear creation guidance instead of a bare placeholder grid

### Requirement: Interview detail behaves as a job workspace
The `/interviews/[interviewId]` route SHALL present one coherent workspace that combines job overview, pipeline/session navigation, candidate review detail, and edit/share actions without requiring new route contracts or a new persisted job entity.

#### Scenario: No candidate is selected
- **WHEN** the recruiter opens an interview workspace without selecting a candidate response
- **THEN** the page foregrounds job overview, candidate-status distribution, session health, and standout signals for that job

#### Scenario: Candidate detail remains in the same workspace
- **WHEN** the recruiter selects a candidate response from the workspace pipeline
- **THEN** the page shows that candidate’s recommendation, transcript, recording, session integrity, and status actions inside the same workspace context

### Requirement: Jobs and pipeline views are derived from existing interview and response data
Recruiter-facing job and pipeline views SHALL derive their labels, counts, and stage summaries from existing `interview` and `response` fields rather than requiring new backend entities, migrations, or route-level API changes.

#### Scenario: Job definition is derived from the current interview entity
- **WHEN** the system renders a job card or job workspace header
- **THEN** the displayed job identity is derived from the existing interview name, description, objective, duration, and interviewer fields

#### Scenario: Pipeline counts are derived from response state
- **WHEN** the system renders pipeline summaries or candidate rails
- **THEN** it computes live, interrupted, completed, shortlisted, rejected, or pending counts from existing response status and candidate-status fields
