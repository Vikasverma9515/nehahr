-- Neha AI HR Agent - Database Schema
-- Single-company internal tool for SalesCode.ai
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Profiles (linked to Supabase Auth users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. Jobs / Open Positions
-- ============================================
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    work_model TEXT CHECK (work_model IN ('office', 'hybrid', 'remote')),
    job_description TEXT,
    required_skills TEXT[],
    role_type TEXT CHECK (role_type IN ('client_facing', 'team_handling', 'technical', 'other')),
    salary_range_min NUMERIC,
    salary_range_max NUMERIC,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Candidates
-- ============================================
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    resume_url TEXT,

    -- Category A: Demographics
    current_location TEXT,
    open_to_relocation BOOLEAN,
    relocation_preferences TEXT[],
    work_model_preference TEXT,
    shift_flexibility BOOLEAN,
    employment_status TEXT,
    last_working_day DATE,
    reason_for_leaving TEXT,
    current_ctc JSONB,
    expected_ctc JSONB,
    notice_period_days INTEGER,
    early_release_possible BOOLEAN,

    -- Category B: Role-specific
    role_specific_answers JSONB,

    -- Category C: Salary trajectory
    previous_ctc NUMERIC,
    ctc_growth_percentage NUMERIC,
    yoy_increments JSONB,
    financial_expectations JSONB,

    -- Scoring
    qualification_status TEXT DEFAULT 'pending'
        CHECK (qualification_status IN ('pending', 'qualified', 'unqualified')),
    score NUMERIC,
    score_breakdown JSONB,
    disqualification_reason TEXT,

    -- Pipeline stage
    stage TEXT DEFAULT 'new'
        CHECK (stage IN (
            'new', 'screening', 'screened', 'shortlisted',
            'scheduling', 'scheduled', 'interviewing',
            'offer', 'pre_joining', 'joined', 'rejected',
            'withdrawn', 'no_show'
        )),

    -- Engagement tracking
    engagement_score NUMERIC,
    last_contact_at TIMESTAMPTZ,
    next_scheduled_contact TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. Calls
-- ============================================
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,

    call_type TEXT NOT NULL CHECK (call_type IN (
        'screening', 'scheduling', 'reminder_candidate',
        'reminder_interviewer', 'result', 'pre_joining',
        'engagement', 'exit', 'helpdesk', 'pulse_check'
    )),

    twilio_call_sid TEXT UNIQUE,
    direction TEXT DEFAULT 'outbound',
    from_number TEXT,
    to_number TEXT,
    status TEXT DEFAULT 'queued'
        CHECK (status IN ('queued', 'ringing', 'in_progress',
                          'completed', 'failed', 'no_answer', 'busy')),
    duration_seconds INTEGER,
    recording_url TEXT,

    transcript TEXT,
    transcript_segments JSONB,
    ai_summary TEXT,
    extracted_data JSONB,
    sentiment_score NUMERIC,

    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. Interviews
-- ============================================
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    round_number INTEGER NOT NULL DEFAULT 1,
    interviewer_name TEXT,
    interviewer_email TEXT,
    interview_type TEXT CHECK (interview_type IN ('in_person', 'video', 'phone')),

    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link TEXT,
    location TEXT,

    google_event_id TEXT,

    status TEXT DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'in_progress',
                          'completed', 'cancelled', 'no_show')),

    feedback_status TEXT DEFAULT 'pending'
        CHECK (feedback_status IN ('pending', 'requested', 'submitted', 'overdue')),
    feedback JSONB,
    feedback_submitted_at TIMESTAMPTZ,

    result TEXT CHECK (result IN ('pass', 'fail', 'hold', 'pending')),
    result_communicated BOOLEAN DEFAULT false,
    result_communicated_at TIMESTAMPTZ,

    candidate_reminded BOOLEAN DEFAULT false,
    interviewer_reminded BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. Helpdesk Tickets
-- ============================================
CREATE TABLE helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_name TEXT NOT NULL,
    employee_phone TEXT NOT NULL,
    employee_email TEXT,

    bucket TEXT NOT NULL CHECK (bucket IN (
        'team_manager', 'time_attendance',
        'payroll', 'hr_documentation', 'it_helpdesk'
    )),

    query_text TEXT,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'escalated')),
    escalated_to TEXT,
    resolution TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- ============================================
-- 7. Exit Interviews
-- ============================================
CREATE TABLE exit_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_name TEXT,
    employee_email TEXT,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,

    reason_for_leaving TEXT,
    manager_rating INTEGER CHECK (manager_rating BETWEEN 1 AND 5),
    team_rating INTEGER CHECK (team_rating BETWEEN 1 AND 5),
    culture_rating INTEGER CHECK (culture_rating BETWEEN 1 AND 5),
    suggestions TEXT,
    tags TEXT[],
    summary TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_candidates_job ON candidates(job_id);
CREATE INDEX idx_candidates_stage ON candidates(stage);
CREATE INDEX idx_candidates_phone ON candidates(phone);
CREATE INDEX idx_calls_candidate ON calls(candidate_id);
CREATE INDEX idx_calls_type ON calls(call_type);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX idx_interviews_scheduled ON interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_helpdesk_bucket ON helpdesk_tickets(bucket);

-- ============================================
-- Row Level Security
-- ============================================
-- Since this is a single-company internal tool,
-- RLS just checks that the user is authenticated.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_interviews ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- All other tables: any authenticated user has full access
CREATE POLICY "Authenticated users can read jobs"
    ON jobs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert jobs"
    ON jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update jobs"
    ON jobs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete jobs"
    ON jobs FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read candidates"
    ON candidates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert candidates"
    ON candidates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update candidates"
    ON candidates FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete candidates"
    ON candidates FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read calls"
    ON calls FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert calls"
    ON calls FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update calls"
    ON calls FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read interviews"
    ON interviews FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert interviews"
    ON interviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update interviews"
    ON interviews FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read helpdesk tickets"
    ON helpdesk_tickets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert helpdesk tickets"
    ON helpdesk_tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update helpdesk tickets"
    ON helpdesk_tickets FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read exit interviews"
    ON exit_interviews FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert exit interviews"
    ON exit_interviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update exit interviews"
    ON exit_interviews FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================
-- Auto-create profile on signup trigger
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Updated_at auto-update trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_jobs
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_candidates
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
