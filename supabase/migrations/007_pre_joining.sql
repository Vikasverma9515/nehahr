-- Pre-joining support: Track A (short-notice) + Track B (long-notice)
-- These fields are set by HR after making the offer call.

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS joining_date DATE,
    ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS offer_ctc JSONB,               -- {fixed: X, variable: Y} — final offer
    ADD COLUMN IF NOT EXISTS pre_joining_status TEXT DEFAULT 'pending'
        CHECK (pre_joining_status IN ('pending', 'confirmed', 'at_risk', 'dropped', 'joined')),
    ADD COLUMN IF NOT EXISTS engagement_score INTEGER,       -- 1-10, updated by AI after each engagement call
    ADD COLUMN IF NOT EXISTS last_engagement_call_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS engagement_notes TEXT;           -- AI flags: competing offers, disengagement signals
