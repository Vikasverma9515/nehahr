-- =============================================================
-- 023: No-show calls, first-day / first-week check-ins, documents
-- =============================================================

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_call_type_check;
ALTER TABLE calls ADD CONSTRAINT calls_call_type_check CHECK (call_type IN (
    'screening', 'scheduling',
    'reminder', 'reminder_candidate', 'reminder_interviewer',
    'result', 'pre_joining', 'engagement', 'exit', 'helpdesk', 'pulse_check',
    'inbound', 'interview', 'no_show', 'day_one', 'week_one'
));

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS day_one_call_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS week_one_call_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS candidate_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,                 -- pan | aadhaar | degree | payslips | relieving_letter | bank | photo | other
    file_path TEXT NOT NULL,
    file_name TEXT,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'verified', 'rejected')),
    note TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_candidate_documents ON candidate_documents(candidate_id);
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read" ON candidate_documents FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can update" ON candidate_documents FOR UPDATE USING (is_org_member(org_id));
DROP TRIGGER IF EXISTS set_org_id_candidate_documents ON candidate_documents;
CREATE TRIGGER set_org_id_candidate_documents BEFORE INSERT ON candidate_documents
    FOR EACH ROW EXECUTE FUNCTION set_org_id();

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
