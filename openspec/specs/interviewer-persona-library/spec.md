## ADDED Requirements

### Requirement: Interviewers are presented as personas, not utility records
The interviewer library SHALL present each interviewer as a persona with visible identity, purpose, and conversation style so recruiters can understand and choose an interviewer without reading raw admin fields first.

#### Scenario: Recruiter browses the interviewer library
- **WHEN** the recruiter opens `/dashboard/interviewers`
- **THEN** the page shows interviewer personas with clear identity, role context, and distinctive descriptive cues

#### Scenario: Empty interviewer library remains actionable
- **WHEN** no interviewers exist yet
- **THEN** the page presents a persona-oriented empty state with a clear creation action

### Requirement: Persona creation and editing are framed as composition flows
The create and manage flows SHALL present name, avatar, description, voice, prompt, and trait metadata as part of composing an interviewer persona rather than as a generic utility form.

#### Scenario: Recruiter starts creating an interviewer
- **WHEN** the recruiter opens the create interviewer flow
- **THEN** the interface guides them through persona identity, voice, and prompt composition in an editorial productized layout

#### Scenario: Trait metadata remains visible
- **WHEN** a recruiter reviews or edits an interviewer
- **THEN** the persona detail keeps conversation traits visible as descriptive metadata alongside the prompt and voice details

### Requirement: Persona management preserves existing CRUD behavior
The interviewer library SHALL preserve current create, view, and delete behavior using the existing interviewer APIs and fields while adopting the new presentation system.

#### Scenario: Recruiter deletes a persona
- **WHEN** the recruiter confirms deletion of an interviewer
- **THEN** the persona is removed through the existing delete behavior and the library updates within the redesigned interface

#### Scenario: Recruiter opens persona details
- **WHEN** the recruiter selects an interviewer from the library
- **THEN** the system shows persona details and available management actions without requiring a new backend contract
