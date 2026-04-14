-- Multi-round interview support.
-- Jobs can define how many rounds are needed. Default 1 (single round).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_interview_rounds INTEGER NOT NULL DEFAULT 1;
