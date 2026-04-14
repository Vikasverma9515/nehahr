-- Phase 4.1: Dedicated HR sender account
-- Singleton table storing OAuth tokens for the shared HR/recruiting Google
-- account that sends all booking confirmation emails. This decouples "who
-- sends the email" from "who conducts the interview" so candidates see a
-- real recruiting team sender instead of an individual interviewer.

CREATE TABLE hr_sender (
    -- Enforce singleton: only one row, id = 1
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

    name TEXT,
    email TEXT NOT NULL,

    -- Google OAuth tokens (gmail.send scope)
    google_refresh_token TEXT NOT NULL,
    google_access_token TEXT,
    google_access_token_expires_at TIMESTAMPTZ,

    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hr_sender ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read hr_sender"
    ON hr_sender FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert hr_sender"
    ON hr_sender FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update hr_sender"
    ON hr_sender FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete hr_sender"
    ON hr_sender FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER set_updated_at_hr_sender
    BEFORE UPDATE ON hr_sender
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
