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
    deleted_at TIMESTAMP WITH TIME ZONE,
    retell_llm_id TEXT
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
    invite_only BOOLEAN NOT NULL DEFAULT false,
    public_token UUID,
    public_token_expires_at TIMESTAMP WITH TIME ZONE,
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
    time_duration TEXT,
    job_description TEXT NOT NULL DEFAULT '',
    seniority TEXT NOT NULL DEFAULT 'mid',
    must_haves JSONB NOT NULL DEFAULT '[]'::jsonb,
    coverage_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    proctoring_camera_enabled BOOLEAN NOT NULL DEFAULT false,
    proctoring_screen_enabled BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT interview_seniority_check
        CHECK (seniority IN ('junior', 'mid', 'senior', 'staff', 'principal'))
);

CREATE TABLE interview_invites (
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

CREATE INDEX IF NOT EXISTS interview_invites_interview_id_idx
    ON interview_invites(interview_id);

CREATE UNIQUE INDEX IF NOT EXISTS interview_invites_token_idx
    ON interview_invites(token);

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
    session_token UUID,
    invite_id UUID REFERENCES interview_invites(id),
    consent_acknowledged_at TIMESTAMP WITH TIME ZONE,
    camera_status TEXT,
    screen_share_type TEXT,
    proctoring_interrupted BOOLEAN NOT NULL DEFAULT false,
    camera_storage_path TEXT,
    screen_storage_path TEXT
    -- NOTE: the `analytics_v1` JSONB column physically exists in deployed
    -- databases (added by the hiring-grade-analytics-scoring migration during
    -- the original dual-write design). It is no longer written by the app.
    -- Safe to drop via:  ALTER TABLE response DROP COLUMN IF EXISTS analytics_v1;
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

-- =====================================================================
-- MIGRATION: tokenized-invites-and-rotating-public-links (apply manually
-- via Supabase SQL editor for existing environments — no migrations
-- folder exists). The runnable file is at
-- openspec/changes/tokenized-invites-and-rotating-public-links/migration.sql
-- =====================================================================
--
-- RLS posture: the project does not use Supabase RLS today. The new
-- interview_invites table follows the same convention — no ENABLE ROW
-- LEVEL SECURITY, no policies. If a future change adds RLS, the
-- validate-access route will need either a restricted SELECT policy on
-- interview_invites(token) or a service-role client.
--
-- 1) Add the three new columns to the interview table (idempotent):
--
--   ALTER TABLE interview
--     ADD COLUMN IF NOT EXISTS invite_only BOOLEAN NOT NULL DEFAULT false,
--     ADD COLUMN IF NOT EXISTS public_token UUID,
--     ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMP WITH TIME ZONE;
--
-- 2) Backfill existing interviews with a 30-DAY GRANDFATHER expiry (NOT
--    24h). Setting NOW() + 24h on backfill would silently break every
--    existing share link 24h after the migration runs. New interviews
--    created by the app after deploy use 24h via the create-interview
--    route.
--
--   UPDATE interview
--      SET public_token = uuid_generate_v4(),
--          public_token_expires_at = NOW() + INTERVAL '30 days'
--    WHERE public_token IS NULL;
--
-- 3) Create the interview_invites table:
--
--   CREATE TABLE IF NOT EXISTS interview_invites (
--       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--       interview_id TEXT NOT NULL REFERENCES interview(id) ON DELETE CASCADE,
--       token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
--       email TEXT NOT NULL,
--       created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--       expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
--       reserved_at TIMESTAMP WITH TIME ZONE,
--       used_at TIMESTAMP WITH TIME ZONE,
--       revoked_at TIMESTAMP WITH TIME ZONE
--   );
--
-- 4) Indexes for lookups:
--
--   CREATE INDEX IF NOT EXISTS interview_invites_interview_id_idx
--     ON interview_invites(interview_id);
--   CREATE UNIQUE INDEX IF NOT EXISTS interview_invites_token_idx
--     ON interview_invites(token);
--
-- 4a) Disable RLS to match the project-wide no-RLS posture. Some Supabase
--     projects auto-enable RLS on every newly created table; without this
--     ALTER, anon-key INSERTs fail with "new row violates row-level
--     security policy for table interview_invites".
--
--   ALTER TABLE interview_invites DISABLE ROW LEVEL SECURITY;
--
-- 5) Add invite_id to the response table (nullable; null for public-link
--    or legacy flows). The webhook joins response.call_id ->
--    response.invite_id to mark interview_invites.used_at when
--    call_started fires.
--
--   ALTER TABLE response
--     ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES interview_invites(id);
--
-- 6) Runnable file with the SQL inlined:
--    openspec/changes/archive/2026-05-20-tokenized-invites-and-rotating-public-links/migration.sql
-- =====================================================================

-- ============ PROCTORING BUCKET SETUP (Cloudflare R2) ============
--
-- This block documents the MANUAL steps required to set up the `proctoring`
-- Cloudflare R2 bucket for the add-interview-proctoring-camera-screen
-- feature. R2 was chosen over Supabase Storage primarily because R2 has
-- ZERO egress fees (recruiter playback doesn't accrue bandwidth cost) and
-- a 10 GB free tier ($0.015/GB-month beyond).
--
-- DO NOT RUN THIS BLOCK AS SQL. It is documentation only.
--
-- ── Step 1: Create the R2 bucket ───────────────────────────────────────
-- In Cloudflare dashboard → R2 → Create bucket:
--   Name:        proctoring
--   Location:    Automatic (or your preferred region)
--   Public:      NO — leave the public access (r2.dev domain) DISABLED.
--                Recruiter playback always goes through presigned URLs
--                generated by /api/proctoring/signed-url.
--
-- ── Step 2: Create an R2 API token ─────────────────────────────────────
-- In Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API token:
--   Permissions:  Object Read & Write
--   Bucket scope: proctoring (only — do not grant Admin or full-account)
-- Copy the Access Key ID and Secret Access Key into your .env as:
--   R2_ACCOUNT_ID         (visible on R2 dashboard top-right; the
--                          subdomain of your r2.cloudflarestorage.com URL)
--   R2_ACCESS_KEY_ID
--   R2_SECRET_ACCESS_KEY
--   R2_BUCKET_NAME=proctoring
--
-- ── Step 3: Configure 90-day lifecycle / TTL ──────────────────────────
-- In Cloudflare dashboard → R2 → proctoring → Settings → Object lifecycle rules:
--   Add rule:
--     Name:         proctoring-90d-expiry
--     Prefix:       (leave blank — applies to all objects in bucket)
--     Action:       Delete objects 90 days after creation
--   This rule applies to BOTH chunk .webm files and manifest .json files.
--   Note: R2 lifecycle expiration runs daily; objects are deleted within
--   ~24h of the 90-day mark.
--
-- ── Step 3.5: Configure CORS so recruiter playback works ──────────────
-- Without this, the recruiter UI fetches manifest/chunk URLs from R2 and
-- the browser blocks the response (no Access-Control-Allow-Origin header).
-- Symptom: "Failed to fetch" on every video element.
--
-- In Cloudflare dashboard → R2 → proctoring → Settings → CORS Policy
--   → Add CORS policy:
--
-- [
--   {
--     "AllowedOrigins": [
--       "http://localhost:3000",
--       "https://YOUR-PRODUCTION-DOMAIN.com"
--     ],
--     "AllowedMethods": ["GET", "HEAD"],
--     "AllowedHeaders": ["*"],
--     "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
--     "MaxAgeSeconds": 3600
--   }
-- ]
--
-- Replace YOUR-PRODUCTION-DOMAIN.com with the actual deployed hostname
-- BEFORE going live. The localhost entry is fine to keep — it only
-- matters during local dev.
--
-- CLI alternative (requires wrangler):
--   wrangler r2 bucket cors put proctoring --rules ./cors-rules.json
--
-- ── Step 4: Verify ─────────────────────────────────────────────────────
-- After setup, confirm:
--   - The bucket's public r2.dev access is OFF (returns 403 on direct GET)
--   - A test PutObject via the AWS SDK succeeds using the API token
--   - The lifecycle rule appears under bucket Settings → Object lifecycle
--
-- ── Storage path layout (for reference) ───────────────────────────────
-- proctoring/                              ← R2 bucket name
--   <org_id>/
--     <response_id>/
--       camera/
--         0.webm, 1.webm, 2.webm, ...   ← retained after finalize
--       screen/
--         0.webm, 1.webm, 2.webm, ...   ← retained after finalize
--       camera.manifest.json             ← written by finalize route
--       screen.manifest.json             ← written by finalize route
--
-- response.camera_storage_path → "<org_id>/<response_id>/camera.manifest.json"
-- response.screen_storage_path → "<org_id>/<response_id>/screen.manifest.json"
--
-- ── Database columns required (apply via migration) ───────────────────
-- These ALTER TABLE statements ARE valid SQL and should be run in the
-- Supabase SQL editor to add proctoring columns to existing environments:
--
--   ALTER TABLE interview
--     ADD COLUMN IF NOT EXISTS proctoring_camera_enabled BOOLEAN NOT NULL DEFAULT false,
--     ADD COLUMN IF NOT EXISTS proctoring_screen_enabled BOOLEAN NOT NULL DEFAULT false;
--
--   ALTER TABLE response
--     ADD COLUMN IF NOT EXISTS consent_acknowledged_at TIMESTAMPTZ,
--     ADD COLUMN IF NOT EXISTS camera_status TEXT,
--     ADD COLUMN IF NOT EXISTS screen_share_type TEXT,
--     ADD COLUMN IF NOT EXISTS proctoring_interrupted BOOLEAN NOT NULL DEFAULT false,
--     ADD COLUMN IF NOT EXISTS camera_storage_path TEXT,
--     ADD COLUMN IF NOT EXISTS screen_storage_path TEXT;
--
-- ============ END PROCTORING BUCKET SETUP ============
