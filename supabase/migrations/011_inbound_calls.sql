-- =============================================================
-- 011: Inbound calls
--
-- Candidates can ring (or call back) the Neha number. The agent recognises
-- them by caller ID, answers status questions, takes reschedule requests
-- and messages for HR.
-- =============================================================

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_call_type_check;
ALTER TABLE calls ADD CONSTRAINT calls_call_type_check CHECK (call_type IN (
    'screening', 'scheduling',
    'reminder', 'reminder_candidate', 'reminder_interviewer',
    'result', 'pre_joining', 'engagement', 'exit', 'helpdesk', 'pulse_check',
    'inbound', 'interview'
));

-- Unknown callers have no candidate row yet.
ALTER TABLE calls ALTER COLUMN candidate_id DROP NOT NULL;

-- Messages and requests captured on inbound calls, for HR to action.
CREATE TABLE IF NOT EXISTS candidate_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('reschedule', 'withdraw', 'question', 'message', 'callback')),
    details TEXT,
    caller_number TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_candidate_requests_open ON candidate_requests(org_id) WHERE status = 'open';

ALTER TABLE candidate_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read" ON candidate_requests FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can update" ON candidate_requests FOR UPDATE USING (is_org_member(org_id));
DROP TRIGGER IF EXISTS set_org_id_candidate_requests ON candidate_requests;
CREATE TRIGGER set_org_id_candidate_requests BEFORE INSERT ON candidate_requests
    FOR EACH ROW EXECUTE FUNCTION set_org_id();
