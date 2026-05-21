-- Migration: rubric-aware-interviewer-and-questions
-- Adds coverage_warnings JSONB column to the interview table.
-- Idempotent: safe to re-run.
--
-- Backward compatibility:
--   - Existing rows pick up the default '[]'::jsonb.
--   - No NOT NULL constraint violations possible because the DEFAULT is supplied.
--   - The application treats an empty array as "no warnings" — identical to the pre-change behavior.

ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS coverage_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- Verify block — run after applying. Each query should return TRUE.
-- -----------------------------------------------------------------------------

-- 1. Column exists with the correct type and default.
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'interview'
    AND column_name = 'coverage_warnings'
    AND data_type = 'jsonb'
    AND is_nullable = 'NO'
    AND column_default = '''[]''::jsonb'
) AS coverage_warnings_column_ok;

-- 2. Every existing row received the default empty-array value.
SELECT NOT EXISTS (
  SELECT 1
  FROM interview
  WHERE coverage_warnings IS NULL
     OR (coverage_warnings::text NOT IN ('[]', '[ ]') AND jsonb_typeof(coverage_warnings) <> 'array')
) AS all_rows_have_array_default;

-- -----------------------------------------------------------------------------
-- Rollback (uncomment to apply):
-- -----------------------------------------------------------------------------
-- ALTER TABLE interview
--   DROP COLUMN IF EXISTS coverage_warnings;
--
-- Note: rolling back is destructive — any operator-acknowledged coverage
-- warnings will be permanently lost. Only roll back before any production
-- writes have used the column, OR after exporting the data elsewhere.
