-- =============================================================
-- 016: WhatsApp / SMS messages with candidates
-- =============================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    body TEXT,
    purpose TEXT,                -- missed_call | booking | reminder | reply | manual | ...
    author TEXT NOT NULL DEFAULT 'neha' CHECK (author IN ('neha', 'recruiter', 'candidate')),
    from_number TEXT,
    to_number TEXT,
    provider_sid TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',   -- queued | sent | delivered | read | failed | received
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_candidate ON messages(candidate_id, created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read" ON messages FOR SELECT USING (is_org_member(org_id));
DROP TRIGGER IF EXISTS set_org_id_messages ON messages;
CREATE TRIGGER set_org_id_messages BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION set_org_id();

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS messaging_opt_out BOOLEAN NOT NULL DEFAULT false;
