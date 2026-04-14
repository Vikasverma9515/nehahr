-- Add a unique token to interviews so interviewers can submit feedback
-- via a standalone link (no dashboard login required).
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS feedback_token TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_interviews_feedback_token ON interviews(feedback_token);
