-- Phase 4: Interview Scheduling
-- Adds interviewers table, default interviewer on jobs, and extended interview fields.

-- ============================================
-- 1. Interviewers
-- ============================================
CREATE TABLE interviewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,

    -- Google OAuth tokens for calendar access
    google_refresh_token TEXT,
    google_access_token TEXT,
    google_access_token_expires_at TIMESTAMPTZ,
    google_connected_at TIMESTAMPTZ,

    -- Working hours configuration (24h, Asia/Kolkata)
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    working_hours_start INTEGER NOT NULL DEFAULT 9,
    working_hours_end INTEGER NOT NULL DEFAULT 18,

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interviewers_email ON interviewers(email);
CREATE INDEX idx_interviewers_active ON interviewers(is_active);

-- Enable RLS with simple "authenticated users only" policy
ALTER TABLE interviewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read interviewers"
    ON interviewers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert interviewers"
    ON interviewers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update interviewers"
    ON interviewers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete interviewers"
    ON interviewers FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER set_updated_at_interviewers
    BEFORE UPDATE ON interviewers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. Jobs — default interviewer for auto-scheduling
-- ============================================
ALTER TABLE jobs
    ADD COLUMN default_interviewer_id UUID REFERENCES interviewers(id) ON DELETE SET NULL,
    ADD COLUMN default_interview_type TEXT CHECK (default_interview_type IN ('in_person', 'video', 'phone')) DEFAULT 'video',
    ADD COLUMN default_interview_duration_minutes INTEGER DEFAULT 60;

-- ============================================
-- 3. Interviews — link to interviewer, store offered slots
-- ============================================
ALTER TABLE interviews
    ADD COLUMN interviewer_id UUID REFERENCES interviewers(id) ON DELETE SET NULL,
    ADD COLUMN offered_slots JSONB,       -- array of slots Neha presented to candidate
    ADD COLUMN confirmed_slot JSONB,      -- slot candidate picked (start, end, label)
    ADD COLUMN scheduling_call_id UUID REFERENCES calls(id) ON DELETE SET NULL;

-- ============================================
-- 4. Candidates — flag for manual scheduling fallback
-- ============================================
ALTER TABLE candidates
    ADD COLUMN needs_manual_scheduling BOOLEAN DEFAULT false,
    ADD COLUMN scheduling_notes TEXT;
