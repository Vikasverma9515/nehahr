-- =============================================================
-- 018: Share candidates with a hiring manager for one-click decisions
-- =============================================================

CREATE TABLE IF NOT EXISTS review_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_ids UUID[] NOT NULL,
    reviewer_name TEXT,
    reviewer_email TEXT,
    message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    link_id UUID REFERENCES review_links(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('advance', 'maybe', 'reject')),
    note TEXT,
    reviewer_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (link_id, candidate_id)
);

ALTER TABLE review_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read" ON review_links FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can read" ON candidate_reviews FOR SELECT USING (is_org_member(org_id));
DROP TRIGGER IF EXISTS set_org_id_review_links ON review_links;
CREATE TRIGGER set_org_id_review_links BEFORE INSERT ON review_links FOR EACH ROW EXECUTE FUNCTION set_org_id();
DROP TRIGGER IF EXISTS set_org_id_candidate_reviews ON candidate_reviews;
CREATE TRIGGER set_org_id_candidate_reviews BEFORE INSERT ON candidate_reviews FOR EACH ROW EXECUTE FUNCTION set_org_id();
