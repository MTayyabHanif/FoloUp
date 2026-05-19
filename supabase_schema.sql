-- Create enum type for plan
CREATE TYPE plan AS ENUM ('free', 'pro', 'free_trial_over');

-- Create tables
CREATE TABLE organization (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT,
    image_url TEXT,
    allowed_responses_count INTEGER,
    plan plan
);

CREATE TABLE "user" (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    email TEXT,
    organization_id TEXT REFERENCES organization(id)
);

CREATE TABLE interviewer (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    agent_id TEXT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT NOT NULL,
    audio TEXT,
    empathy INTEGER NOT NULL,
    exploration INTEGER NOT NULL,
    rapport INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    voice_id TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE interview (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT,
    description TEXT,
    objective TEXT,
    organization_id TEXT REFERENCES organization(id),
    user_id TEXT REFERENCES "user"(id),
    interviewer_id INTEGER REFERENCES interviewer(id),
    is_active BOOLEAN DEFAULT true,
    is_anonymous BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    logo_url TEXT,
    theme_color TEXT,
    url TEXT,
    readable_slug TEXT,
    questions JSONB,
    quotes JSONB[],
    insights TEXT[],
    respondents TEXT[],
    question_count INTEGER,
    response_count INTEGER,
    time_duration TEXT
);

CREATE TABLE response (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    interview_id TEXT REFERENCES interview(id),
    name TEXT,
    email TEXT,
    call_id TEXT,
    candidate_status TEXT,
    duration INTEGER,
    details JSONB,
    analytics JSONB,
    is_analysed BOOLEAN DEFAULT false,
    is_ended BOOLEAN DEFAULT false,
    is_viewed BOOLEAN DEFAULT false,
    tab_switch_count INTEGER,
    status TEXT NOT NULL DEFAULT 'ongoing',
    disconnection_reason TEXT,
    questions_covered INTEGER,
    last_active_at TIMESTAMP WITH TIME ZONE,
    session_token UUID
);

-- Index for session-token lookups on the reconnect critical path.
CREATE UNIQUE INDEX IF NOT EXISTS response_session_token_idx
    ON response(session_token) WHERE session_token IS NOT NULL;

-- =====================================================================
-- MIGRATION: resilient-interview-sessions (apply manually via Supabase
-- SQL editor for existing environments — no migrations folder exists).
-- =====================================================================
--
-- 1) Add the five new columns to the response table:
--
--   ALTER TABLE response
--     ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ongoing',
--     ADD COLUMN IF NOT EXISTS disconnection_reason TEXT,
--     ADD COLUMN IF NOT EXISTS questions_covered INTEGER,
--     ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
--     ADD COLUMN IF NOT EXISTS session_token UUID;
--
-- 2) Add the unique index on session_token:
--
--   CREATE UNIQUE INDEX IF NOT EXISTS response_session_token_idx
--     ON response(session_token) WHERE session_token IS NOT NULL;
--
-- 3) Backfill status for existing rows. Two-pass UPDATE — the WHERE
--    clauses are mutually exclusive so the order does not matter:
--
--   -- Rows that completed normally → 'completed'
--   UPDATE response SET status = 'completed'
--     WHERE is_ended = true AND status = 'ongoing';
--
--   -- Old orphan rows (started but never closed, and old enough that
--   -- they will never close) → 'interrupted'. Adjust the interval if
--   -- you want a tighter cutoff:
--   UPDATE response SET status = 'interrupted'
--     WHERE is_ended = false
--       AND status = 'ongoing'
--       AND created_at < NOW() - INTERVAL '5 minutes';
--
-- 4) Note: status DEFAULT 'ongoing' means new rows from the app will
--    pick up the correct value automatically. is_ended is kept for
--    backwards compatibility but is no longer authoritative.
-- =====================================================================

-- =====================================================================
-- MIGRATION: add-interviewer-crud-mvp (apply manually via Supabase SQL
-- editor for existing environments — no migrations folder exists).
-- =====================================================================
--
-- 1) Add the three new columns to the interviewer table (idempotent —
--    safe to re-run; the temporary default on `prompt` is dropped after
--    the backfill via a conditional DO block):
--
--   ALTER TABLE interviewer ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';
--   ALTER TABLE interviewer ADD COLUMN IF NOT EXISTS voice_id TEXT;
--   ALTER TABLE interviewer ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
--
-- 2) Backfill `prompt` for the three existing seed interviewers. The
--    prompts are dollar-quoted ($PROMPT$ ... $PROMPT$) so embedded
--    apostrophes do NOT need escaping. Read the verbatim values from
--    src/lib/constants.ts (RETELL_AGENT_GENERAL_PROMPT for Lisa+Bob;
--    RETELL_AGENT_ROBUST_BOT_PROMPT for Robust Bot). Example shape:
--
--   UPDATE interviewer SET prompt = $PROMPT$<verbatim GENERAL prompt>$PROMPT$
--     WHERE name IN ('Explorer Lisa', 'Empathetic Bob') AND prompt = '';
--   UPDATE interviewer SET prompt = $PROMPT$<verbatim ROBUST BOT prompt>$PROMPT$
--     WHERE name = 'Robust Bot' AND prompt = '';
--
-- 3) Backfill `voice_id` from what each interviewer is already using in
--    Retell (visible in the agent record but never stored locally):
--
--   UPDATE interviewer SET voice_id = '11labs-Chloe'
--     WHERE name = 'Explorer Lisa' AND voice_id IS NULL;
--   UPDATE interviewer SET voice_id = '11labs-Brian'
--     WHERE name IN ('Empathetic Bob', 'Robust Bot') AND voice_id IS NULL;
--
-- 4) Drop the temporary default on `prompt` only if it is still present.
--    Wrapped in a DO block so the step is idempotent (DROP DEFAULT has
--    no IF EXISTS form in Postgres):
--
--   DO $$
--   BEGIN
--     IF EXISTS (
--       SELECT 1 FROM information_schema.columns
--       WHERE table_name = 'interviewer'
--         AND column_name = 'prompt'
--         AND column_default IS NOT NULL
--     ) THEN
--       EXECUTE 'ALTER TABLE interviewer ALTER COLUMN prompt DROP DEFAULT';
--     END IF;
--   END $$;
--
-- 5) A runnable, ready-to-paste version with the verbatim prompt text
--    inlined is bundled with the openspec change at
--    openspec/changes/add-interviewer-crud-mvp/migration.sql (until the
--    change is archived; the archive copy survives indefinitely).
-- =====================================================================

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    interview_id TEXT REFERENCES interview(id),
    email TEXT,
    feedback TEXT,
    satisfaction INTEGER
);
