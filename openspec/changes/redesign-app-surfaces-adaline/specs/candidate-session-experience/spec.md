## ADDED Requirements

### Requirement: Candidate entry uses a guided readiness surface
The candidate entry flow SHALL present a calm readiness experience that explains the role context, expected interview duration, interviewer presence, microphone expectations, and the next step before a session begins.

#### Scenario: Candidate opens a valid active interview
- **WHEN** a candidate opens a valid active call link before joining
- **THEN** the page presents a guided preflight state with job context, time expectations, readiness cues, and a clear start or resume action

#### Scenario: Candidate receives clarity before joining
- **WHEN** the candidate has not yet started the session
- **THEN** the interface explains what will happen next instead of dropping them directly into an unframed call widget

### Requirement: Candidate exceptional states share one calm visual language
Invalid-link, closed-interview, mobile-blocked, offline, expired-session, resume-check, and similar exceptional states SHALL use consistent calm shells with clear explanations and next actions where possible.

#### Scenario: Invalid link state is clear and branded
- **WHEN** a candidate opens a link that does not resolve to an interview
- **THEN** the page shows a consistent invalid-link state explaining the problem and what to do next

#### Scenario: Mobile-blocked state remains consistent
- **WHEN** a candidate opens the interview on a mobile device
- **THEN** the page shows the same system language and clearly instructs them to switch to desktop

### Requirement: Active and completion states emphasize focus and progress
During an active session, the candidate experience SHALL emphasize interviewer presence, current progress, and session focus instead of recruiter-style dashboard chrome. Completion and feedback states SHALL remain within the same visual system and provide clear closure.

#### Scenario: Active session remains focused
- **WHEN** the interview call is active
- **THEN** the page prioritizes the live interview experience, progress cues, and essential supporting context without exposing recruiter navigation chrome

#### Scenario: Completion state provides closure
- **WHEN** the session ends successfully
- **THEN** the candidate sees a clear completion state and any feedback collection in the same calm visual system
