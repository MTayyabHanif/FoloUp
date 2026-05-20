-- ===========================================================================
-- hiring-grade-analytics-scoring — runnable migration (paste into Supabase SQL editor)
-- ===========================================================================
-- Idempotent. Safe to re-run.
--
-- Adds three columns to `interview` (job_description, seniority, must_haves)
-- and one column to `response` (analytics_v1) so the new hiring-grade v2
-- analytics pipeline has the JD context it needs and so the webhook can
-- dual-write v1 + v2 outputs during the calibration window.
--
-- See design.md §Migration Plan for the full rationale. The two env flags
-- ANALYTICS_V2_ENABLED and ANALYTICS_V2_AS_PRIMARY both default to false in
-- code, so applying this migration before the code lands is safe — no code
-- path reads or writes the new columns until both pieces are deployed and
-- the flags are explicitly turned on.
-- ===========================================================================

-- 1) interview: job_description (full JD text)
ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS job_description TEXT NOT NULL DEFAULT '';

-- 2) interview: seniority (enum-like, defaults to 'mid' for existing rows)
ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS seniority TEXT NOT NULL DEFAULT 'mid';

-- 3) interview: must_haves (JSONB array of strings; defaults to empty array)
ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS must_haves JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4) interview: CHECK constraint pinning seniority to the allowed enum values.
--    Wrapped in a DO block because Postgres has no IF NOT EXISTS on ADD CONSTRAINT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'interview'
      AND constraint_name = 'interview_seniority_check'
  ) THEN
    ALTER TABLE interview
      ADD CONSTRAINT interview_seniority_check
      CHECK (seniority IN ('junior', 'mid', 'senior', 'staff', 'principal'));
  END IF;
END $$;

-- 5) response: analytics_v1 (secondary-write JSONB column for dual-write window)
ALTER TABLE response
  ADD COLUMN IF NOT EXISTS analytics_v1 JSONB NULL;

-- ===========================================================================
-- Done. Verify:
--
--   -- Confirm the new columns exist with the expected defaults.
--   SELECT id, name, seniority,
--          length(job_description) AS jd_len,
--          jsonb_array_length(must_haves) AS mh_count
--   FROM interview ORDER BY id;
--
--   -- Confirm response.analytics_v1 is present and starts NULL for all rows.
--   SELECT COUNT(*) AS total,
--          COUNT(*) FILTER (WHERE analytics_v1 IS NULL) AS null_count
--   FROM response;
--
-- Expected:
--   - Every interview row has seniority = 'mid', empty job_description, and
--     must_haves = []. No row violates interview_seniority_check.
--   - Every response row has analytics_v1 = NULL (no dual-write has happened yet).
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK (run only if no code is reading or writing the new columns)
-- ===========================================================================
-- The two env flags default to false, so the safest rollback is a code revert
-- with the columns left in place. If a full DB-level rollback is required:
--
--   ALTER TABLE response DROP COLUMN IF EXISTS analytics_v1;
--   ALTER TABLE interview DROP CONSTRAINT IF EXISTS interview_seniority_check;
--   ALTER TABLE interview DROP COLUMN IF EXISTS must_haves;
--   ALTER TABLE interview DROP COLUMN IF EXISTS seniority;
--   ALTER TABLE interview DROP COLUMN IF EXISTS job_description;
--
-- Each statement is idempotent. Rolling back loses any operator-set seniority
-- or job_description values; the defaults will be reapplied if the migration
-- is re-run later.
-- ===========================================================================
