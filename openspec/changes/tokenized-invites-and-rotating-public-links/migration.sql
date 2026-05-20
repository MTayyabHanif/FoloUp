-- =====================================================================
-- MIGRATION: tokenized-invites-and-rotating-public-links
-- Apply manually via Supabase SQL editor for existing environments.
-- =====================================================================
--
-- This migration introduces two access-control mechanisms:
--   1. Per-candidate invite tokens (interview_invites table)
--   2. Rotating time-limited public tokens on the interview table
--
-- It also adds invite_id to the response table to link a session back
-- to the invite it was started with (used by the call_started webhook
-- to mark the invite as used).
--
-- RLS posture: The project does not use Supabase RLS today (see archived
-- change openspec/changes/archive/2026-05-19-fix-context-fetch-failures).
-- The new interview_invites table follows the same convention -- no
-- ENABLE ROW LEVEL SECURITY, no policies. The anon key is used for both
-- recruiter and candidate paths. If a future change adds RLS, the
-- validate-access route will need either a restricted SELECT policy on
-- interview_invites(token) or a service-role client.
-- =====================================================================

-- 1) Add new columns to the interview table (idempotent).
ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS invite_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_token UUID,
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMP WITH TIME ZONE;

-- 2) Backfill: existing interviews get a freshly minted public token and
--    a 30-DAY GRANDFATHER expiry (NOT 24h). New interviews created by
--    the app after deploy use the 24h policy via the create-interview
--    route. Rationale: setting NOW() + 24h on backfill would silently
--    break every existing share link 24h after migration runs.
UPDATE interview
   SET public_token = uuid_generate_v4(),
       public_token_expires_at = NOW() + INTERVAL '30 days'
 WHERE public_token IS NULL;

-- 3) Create the interview_invites table.
CREATE TABLE IF NOT EXISTS interview_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id TEXT NOT NULL REFERENCES interview(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reserved_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- 4) Indexes.
--    - (interview_id) for the dashboard "list invites for this interview" query.
--    - (token) already unique via column constraint; an explicit index ensures
--      the validate-access lookup is fast on first hit.
CREATE INDEX IF NOT EXISTS interview_invites_interview_id_idx
    ON interview_invites(interview_id);

CREATE UNIQUE INDEX IF NOT EXISTS interview_invites_token_idx
    ON interview_invites(token);

-- 5) Add invite_id to the response table (nullable; null for public-link or
--    legacy flows). The webhook joins response.call_id -> response.invite_id
--    to mark the invite used_at when call_started fires.
ALTER TABLE response
  ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES interview_invites(id);
