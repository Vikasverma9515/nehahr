-- =============================================================
-- 014: Bulk intake — CSV import, resume parsing, resume-to-job match
-- =============================================================

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',   -- manual | csv | resume | careers_page | referral | api
    ADD COLUMN IF NOT EXISTS resume_text TEXT,
    ADD COLUMN IF NOT EXISTS resume_parsed JSONB,                     -- structured fields Claude pulled from the resume
    ADD COLUMN IF NOT EXISTS skills TEXT[],
    ADD COLUMN IF NOT EXISTS experience_years NUMERIC,
    ADD COLUMN IF NOT EXISTS current_company TEXT,
    ADD COLUMN IF NOT EXISTS current_title TEXT,
    ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
    ADD COLUMN IF NOT EXISTS match_score INTEGER,                     -- resume vs job, 0-100, before any call
    ADD COLUMN IF NOT EXISTS match_reasons JSONB,                     -- {strengths: [], gaps: []}
    ADD COLUMN IF NOT EXISTS preferred_language TEXT;                 -- en | hi | hinglish | ...

CREATE INDEX IF NOT EXISTS idx_candidates_org_phone ON candidates(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_candidates_org_email ON candidates(org_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_candidates_match ON candidates(job_id, match_score DESC);

-- Private bucket for resume files (Supabase Storage only).
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
