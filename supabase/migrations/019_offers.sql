-- =============================================================
-- 019: Offers with approval and click-to-sign acceptance
-- =============================================================

CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'withdrawn', 'expired')),
    designation TEXT NOT NULL,
    ctc JSONB NOT NULL,              -- {"fixed": 18, "variable": 2, "joining_bonus": 1} in LPA
    joining_date DATE,
    work_location TEXT,
    reporting_to TEXT,
    expires_at TIMESTAMPTZ,
    letter_html TEXT NOT NULL,
    approval_required BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    decline_reason TEXT,
    -- Click-to-sign evidence
    signature_name TEXT,
    signature_ip TEXT,
    signature_user_agent TEXT,
    letter_sha256 TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offers_candidate ON offers(candidate_id);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read" ON offers FOR SELECT USING (is_org_member(org_id));
DROP TRIGGER IF EXISTS set_org_id_offers ON offers;
CREATE TRIGGER set_org_id_offers BEFORE INSERT ON offers FOR EACH ROW EXECUTE FUNCTION set_org_id();
CREATE TRIGGER set_updated_at_offers BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
