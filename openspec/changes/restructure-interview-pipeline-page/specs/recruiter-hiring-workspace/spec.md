## MODIFIED Requirements

### Requirement: Interview detail behaves as a job workspace
The `/interviews/[interviewId]` route SHALL present one coherent workspace that combines job identity, sessions navigation, candidate review detail, and edit/share actions without requiring new route contracts or a new persisted job entity. The workspace SHALL avoid duplicating the same job overview at the page level and inside the no-selection right column.

#### Scenario: No candidate is selected
- **WHEN** the recruiter opens an interview workspace without selecting a candidate response
- **THEN** the page header presents the job identity and primary actions once, and the right column foregrounds role setup, candidate-status distribution, session health, and the strongest current signal without re-rendering the page-level identity strip

#### Scenario: Candidate detail remains in the same workspace
- **WHEN** the recruiter selects a candidate response from the sessions panel
- **THEN** the page shows that candidate’s recommendation, transcript, recording, session integrity, and status actions inside the same workspace context

#### Scenario: Workspace primary actions remain accessible without crowding
- **WHEN** the recruiter views the workspace header
- **THEN** the header surfaces sharing, editing, and active-state toggling as primary actions and collapses lower-frequency actions such as preview and identity-marker into an overflow menu

### Requirement: Sessions navigation supports fast filtering, sorting, and search
The interview workspace SHALL expose session filtering, sorting, and search controls that let a recruiter narrow the list, change the ordering, find a candidate by name, and isolate unread candidates from one toolbar without leaving the page.

#### Scenario: Recruiter filters by stage with one click
- **WHEN** the recruiter wants to see only one workflow stage
- **THEN** the sessions panel offers a chip-row stage filter that switches the visible candidates with a single click, including an "All" option that restores the full list

#### Scenario: Recruiter changes the session ordering
- **WHEN** the recruiter wants to scan candidates by recency, score, name, or stage
- **THEN** the sessions panel provides an explicit sort control and re-orders the visible candidates accordingly, flattening the stage grouping when the sort is not "Stage"

#### Scenario: Recruiter searches a candidate by name
- **WHEN** the recruiter types a name fragment into the sessions search input
- **THEN** the sessions panel filters the visible candidates to those whose displayed name contains that fragment, applied on top of the active stage filter, unread toggle, and sort

#### Scenario: Recruiter isolates unread candidates
- **WHEN** the recruiter enables the "Unread only" toggle
- **THEN** the sessions panel hides candidates that have already been opened and keeps every other active filter and sort

### Requirement: Session selection uses one consistent in-page navigation contract
Every surface that opens a candidate from the interview workspace SHALL navigate via the existing `?call=<callId>` URL parameter to the same workspace, so selection behaves identically from the sessions panel, the dashboard deep-links, and the "strongest current signal" call-out.

#### Scenario: Sessions panel opens a candidate inline
- **WHEN** the recruiter clicks a session row in the workspace sessions panel
- **THEN** the same workspace updates the URL with `?call=<callId>` and renders the candidate detail in the right column without opening a new tab

#### Scenario: Modifier-click opens a candidate in a new tab
- **WHEN** the recruiter cmd-clicks, ctrl-clicks, or middle-clicks a session row
- **THEN** the row honors the browser's native modifier behavior and opens the same `?call=<callId>` URL in a new tab

#### Scenario: Dashboard deep-link still opens candidates in the workspace
- **WHEN** the recruiter follows a candidate deep-link from `/dashboard`
- **THEN** the workspace opens with that candidate already selected, with the sessions panel beside the detail view

### Requirement: Workspace right column does not duplicate the sessions panel
The interview workspace right column SHALL NOT render a second candidate list, candidate table, or candidate filtering surface that duplicates the sessions panel on the left.

#### Scenario: No candidate selected
- **WHEN** the recruiter opens the workspace with no candidate selected
- **THEN** the right column shows job-level overview, pipeline health, and a small set of standout signals, but does NOT render a sortable candidate table that mirrors the sessions panel

#### Scenario: Standout signal links back to the sessions navigation contract
- **WHEN** the recruiter activates a standout-signal call-out in the right column
- **THEN** the workspace selects that candidate by updating `?call=<callId>` and rendering the detail in the right column
