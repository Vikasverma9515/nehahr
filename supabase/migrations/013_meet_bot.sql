-- =============================================================
-- 013: Neha joins Google Meet interviews
-- =============================================================

-- Which human interview a Meet-bot call belongs to.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS interview_id UUID REFERENCES interviews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calls_interview ON calls(interview_id);

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS bot_id TEXT;
