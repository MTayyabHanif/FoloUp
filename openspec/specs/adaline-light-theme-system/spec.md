## ADDED Requirements

### Requirement: App surfaces use a single Adaline light theme
The recruiter and candidate app surfaces SHALL render using a single Adaline-derived light theme with Canvas Ice backgrounds, Adaline Ink foregrounds, muted border treatments, and Amber Seed or Valley Green for sanctioned interactive emphasis. The system SHALL NOT expose a dark-mode toggle, dark-mode provider wiring, or dark-mode-specific visual variants on in-scope routes.

#### Scenario: Recruiter shell loads in the Adaline system
- **WHEN** a signed-in user opens an in-scope recruiter route
- **THEN** the page renders with the Adaline light theme and no theme switcher is available

#### Scenario: Candidate route does not offer theme changes
- **WHEN** a candidate opens `/call/[interviewId]`
- **THEN** the surface renders in the same Adaline light system and does not expose dark-mode controls or dark-specific styling

### Requirement: Shared interactive primitives follow the Adaline token contract
Buttons, cards, inputs, textareas, selects, tabs, dialogs, banners, empty states, navigation items, and page-shell surfaces SHALL use the Adaline spacing, radius, border, and typography contract so that in-scope pages present one consistent component language.

#### Scenario: Primary actions use the system CTA treatment
- **WHEN** an in-scope page renders its primary call to action
- **THEN** that action uses the Amber Seed filled treatment with Canvas Ice text and the shared rounded interactive shape

#### Scenario: Secondary actions use the system ghost treatment
- **WHEN** an in-scope page renders a secondary or tertiary action
- **THEN** the action uses the approved light ghost treatment with subtle borders and Valley Green hover emphasis

### Requirement: Interview theme color does not override system theming
The system SHALL preserve existing `interview.theme_color` data without allowing it to control broad page, shell, or candidate-session theming. If surfaced at all, the value MUST appear only as a subtle recruiter-side identity accent that does not break the Adaline system.

#### Scenario: Candidate session ignores a custom interview theme color
- **WHEN** an interview has a stored `theme_color` value
- **THEN** the candidate call experience still renders with the global Adaline palette instead of adopting that color as the page theme

#### Scenario: Recruiter job identity can retain a subtle accent
- **WHEN** a recruiter views a job card or workspace for an interview with a stored `theme_color`
- **THEN** the interface may show that color as a small identity marker without changing the surrounding surface system
