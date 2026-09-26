-- =============================================================
-- 017: Candidate self-serve portal (/c/<token>)
-- =============================================================

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;
