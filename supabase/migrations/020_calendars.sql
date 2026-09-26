-- =============================================================
-- 020: Microsoft 365 / Outlook calendars and panel interviews
-- =============================================================

ALTER TABLE interviewers
    ADD COLUMN IF NOT EXISTS calendar_provider TEXT NOT NULL DEFAULT 'google'
        CHECK (calendar_provider IN ('google', 'microsoft')),
    ADD COLUMN IF NOT EXISTS ms_refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS ms_access_token TEXT,
    ADD COLUMN IF NOT EXISTS ms_access_token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ms_connected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS max_interviews_per_day INTEGER;

-- Everyone on the panel besides the lead interviewer (who owns the event).
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS panel_interviewer_ids UUID[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS default_panel_interviewer_ids UUID[];
