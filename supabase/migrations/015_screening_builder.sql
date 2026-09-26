-- =============================================================
-- 015: Per-job screening builder
--
-- screening_config shape:
-- {
--   "questions":           [{"text": "...", "what_good_looks_like": "..."}],
--   "interview_questions": [{"text": "..."}],          -- AI video / Meet interviews
--   "knockouts":           ["Must be able to work from Pune office 3 days a week"],
--   "must_haves": {
--     "max_notice_days": 60, "min_experience_years": 3, "max_expected_ctc_lpa": 30,
--     "locations": ["Pune", "Mumbai"], "allow_relocation": true,
--     "work_models": ["hybrid", "office"]
--   },
--   "language": "auto"                                  -- auto | en | hi | hinglish
-- }
-- =============================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS screening_config JSONB NOT NULL DEFAULT '{}'::jsonb;
