-- =============================================================
-- 012: AI video interviews in our own room
--
-- HR sends a candidate a one-time link; the candidate joins a LiveKit room
-- in the browser and Neha (with a Tavus face) runs a first-round interview.
-- Recruiters can watch live and take over.
-- =============================================================

CREATE TABLE IF NOT EXISTS ai_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    token TEXT NOT NULL UNIQUE,
    venue TEXT NOT NULL DEFAULT 'neha_room' CHECK (venue IN ('neha_room', 'google_meet')),
    status TEXT NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'in_progress', 'completed', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    max_attempts INTEGER NOT NULL DEFAULT 2,
    attempts INTEGER NOT NULL DEFAULT 0,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    room_name TEXT,
    -- Result
    score INTEGER,
    summary TEXT,
    answers JSONB,
    recording_url TEXT,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ai_interviews_candidate ON ai_interviews(candidate_id);

ALTER TABLE ai_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read" ON ai_interviews FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert" ON ai_interviews FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update" ON ai_interviews FOR UPDATE USING (is_org_member(org_id));
DROP TRIGGER IF EXISTS set_org_id_ai_interviews ON ai_interviews;
CREATE TRIGGER set_org_id_ai_interviews BEFORE INSERT ON ai_interviews
    FOR EACH ROW EXECUTE FUNCTION set_org_id();

-- Neha's part in a human-led interview (used by the Google Meet bot).
ALTER TABLE interviews
    ADD COLUMN IF NOT EXISTS neha_role TEXT NOT NULL DEFAULT 'none'
        CHECK (neha_role IN ('none', 'notetaker', 'co_interviewer', 'lead')),
    ADD COLUMN IF NOT EXISTS bot_status TEXT
        CHECK (bot_status IN ('scheduled', 'joining', 'in_call', 'left', 'failed')),
    ADD COLUMN IF NOT EXISTS ai_notes JSONB;
