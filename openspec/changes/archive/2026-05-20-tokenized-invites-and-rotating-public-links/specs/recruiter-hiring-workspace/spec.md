## ADDED Requirements

### Requirement: Interview edit form exposes an invite-only access toggle
The interview edit form SHALL include an `invite_only` boolean toggle using the same Switch pattern as `is_anonymous`. When toggled on, the system SHALL warn the recruiter that the public link will be blocked for new sessions.

The toggle SHALL be disabled (non-interactive) with tooltip "Disable Anonymous to use invite-only mode" when `is_anonymous=true` (OD1 resolved: the combination is disallowed). When `is_anonymous` is toggled ON while `invite_only` is already ON, the form SHALL display a confirmation dialog ("Enabling anonymous mode will turn off invite-only. Continue?"). On confirm, the system turns off `invite_only` first, then enables `is_anonymous`.

#### Scenario: Recruiter enables invite-only mode
- **WHEN** the recruiter sets `invite_only=true` in the edit form and saves
- **THEN** the interview record is updated and new candidate sessions via the public link are blocked

#### Scenario: Invite-only toggle disabled on anonymous interview
- **WHEN** the interview has `is_anonymous=true` in the edit form
- **THEN** the `invite_only` switch is disabled and shows the tooltip "Disable Anonymous to use invite-only mode"; the recruiter cannot enable invite-only until anonymous mode is turned off

#### Scenario: Confirmation when switching to anonymous while invite-only is on
- **WHEN** the recruiter toggles `is_anonymous` ON while `invite_only=true`
- **THEN** a confirmation dialog appears; on confirm, `invite_only` is cleared first, then `is_anonymous` is set; on cancel, neither flag changes

### Requirement: Share popup displays public link expiry and rotation action
The share popup SHALL display the public token expiry timestamp alongside the share link. A "Rotate link" button SHALL allow the recruiter to regenerate the public token. After rotation, the popup SHALL display the new link and updated expiry. An expiry countdown or human-readable time-remaining label SHALL be shown.

#### Scenario: Expiry is visible in share popup
- **WHEN** the recruiter opens the share popup
- **THEN** the public link section shows the expiry time (e.g., "Expires in 23h 45m" or the exact datetime)

#### Scenario: Rotation confirmation uses a destructive AlertDialog
- **WHEN** the recruiter clicks "Rotate link"
- **THEN** an `AlertDialog` (shadcn/ui, matching the delete-interview pattern in the codebase) is shown with:
  - Title: "Rotate public link?"
  - Description: "This invalidates the current link for any new candidate. Anyone who already started an interview will continue uninterrupted, but new visitors with the old link will see an expired state. You'll need to share the new link manually."
  - Cancel button (default/ghost styling)
  - Confirm button: destructive variant, label "Rotate link"

#### Scenario: Rotation updates the share link immediately
- **WHEN** the recruiter confirms rotation in the AlertDialog
- **THEN** the popup updates to show the new public token URL and a fresh 24h expiry, and the old link is invalidated for new sessions

#### Scenario: Expired link shown with regenerate prompt
- **WHEN** the recruiter opens the share popup and the public token is expired
- **THEN** the popup shows an expired state for the link and prompts the recruiter to rotate it

### Requirement: Share popup provides per-candidate invite management
The share popup SHALL include an "Invites" tab that is always available regardless of the `invite_only` setting. Invites work in both modes: when `invite_only=OFF`, they still provide duplicate-prevention via email binding (one email = one invite = one interview). The Invites tab SHALL:
- Always show the "Send invite" form (email input + send button) at the top, with no gate on `invite_only`
- List existing invites below with status badges: Pending / Reserved / Used / Expired / Revoked
- Show an empty-state inline message when no invites exist: "No invites sent yet. Send one above to track individual candidates."
- Display a small info note in the tab: "Invites work regardless of invite-only mode. Enable invite-only in the interview settings to require an invite."

#### Scenario: Recruiter creates an invite (invite_only=OFF)
- **WHEN** the recruiter enters a candidate email and clicks "Send invite" in an interview with `invite_only=false`
- **THEN** a new invite row is created, the shareable URL is shown for copying, the invite appears in the list with status "Pending" and expiry time; the creation form displays "Expires in 24 hours" as a static label (no TTL selector — OD3 resolved: 24h hard cap)

#### Scenario: Recruiter creates an invite (invite_only=ON)
- **WHEN** the recruiter enters a candidate email and clicks "Send invite" in an interview with `invite_only=true`
- **THEN** the same flow applies as above; the Invites tab is not gated by the `invite_only` flag

#### Scenario: Invites tab shows empty state
- **WHEN** the recruiter opens the Invites tab and no invites have been sent
- **THEN** the list area displays the inline message "No invites sent yet. Send one above to track individual candidates."

#### Scenario: Recruiter sees invite status
- **WHEN** the recruiter views the Invites tab
- **THEN** each invite shows the candidate email, creation time, expiry time, and current status badge (Pending / Reserved / Used / Revoked / Expired)

#### Scenario: Recruiter revokes a pending invite (no dialog)
- **WHEN** the recruiter clicks "Revoke" on an invite with status `pending` (not yet reserved)
- **THEN** the invite is immediately revoked without a confirmation dialog; the status badge updates to "Revoked"

#### Scenario: Recruiter revokes a reserved invite (AlertDialog confirmation)
- **WHEN** the recruiter clicks "Revoke" on an invite with status `reserved` (candidate is in session setup)
- **THEN** an `AlertDialog` is shown with: "Revoke this invite? A candidate may be partway through entering the interview. Revoking will prevent them from starting if they haven't yet, but won't interrupt an active session."
- **WHEN** the recruiter confirms
- **THEN** the invite is revoked

#### Scenario: Revoke button is hidden/disabled on used invite
- **WHEN** an invite has status `used` (consumed — candidate has started a session)
- **THEN** the revoke button is hidden or disabled; the invite cannot be revoked

#### Scenario: Recruiter revokes an expired invite (no dialog)
- **WHEN** the recruiter clicks "Revoke" on an invite with status `expired` (token is past its TTL)
- **THEN** the invite is immediately revoked without a confirmation dialog (cleanup only — the token is already dead)
