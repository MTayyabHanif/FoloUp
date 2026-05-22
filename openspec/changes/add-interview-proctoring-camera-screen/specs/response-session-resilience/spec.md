## ADDED Requirements

### Requirement: Heartbeat route accepts proctoring status updates
The `/api/response-heartbeat` PATCH route SHALL accept two additional optional fields: `proctoring_interrupted` (boolean) and `camera_status` (string). When present, these SHALL be written to the matching `response` row alongside the existing `tab_switch_count` update.

#### Scenario: Heartbeat updates proctoring_interrupted flag
- **WHEN** a PATCH to /api/response-heartbeat includes `{ proctoring_interrupted: true }`
- **THEN** the response row is updated with `proctoring_interrupted = true`

#### Scenario: Heartbeat updates camera_status
- **WHEN** a PATCH to /api/response-heartbeat includes `{ camera_status: "denied" }`
- **THEN** the response row is updated with `camera_status = "denied"`

#### Scenario: Heartbeat without proctoring fields is unaffected
- **WHEN** a PATCH to /api/response-heartbeat is sent without proctoring fields
- **THEN** the existing tab_switch_count and last_active_at updates proceed as before
