-- =============================================================
-- 022: Calling hours, retention and erasure (DPDP / GDPR basics)
--
-- organizations.settings keys used by the backend:
--   calling_hours: {"start": 9, "end": 20, "timezone": "Asia/Kolkata", "weekends": false}
--   retention_days: 365      -- transcripts, recordings, messages older than this are erased
-- =============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    actor TEXT,                      -- user id, 'neha', 'system', 'candidate'
    action TEXT NOT NULL,            -- e.g. candidate.erased, offer.sent, retention.purged
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_log(org_id, created_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read the audit log" ON audit_log FOR SELECT USING (is_org_admin(org_id));
