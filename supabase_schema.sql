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
    speed INTEGER NOT NULL
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

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    interview_id TEXT REFERENCES interview(id),
    email TEXT,
    feedback TEXT,
    satisfaction INTEGER
);
