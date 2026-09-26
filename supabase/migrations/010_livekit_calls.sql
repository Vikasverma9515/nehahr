-- =============================================================
-- 010: Calls on the LiveKit voice agent
--
-- A call can now run on the original Twilio Media Streams loop or on the
-- LiveKit agent, over a phone line (SIP), the browser playground, our own
-- interview room, or a Google Meet bot.
-- =============================================================

ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS runtime TEXT NOT NULL DEFAULT 'twilio'
        CHECK (runtime IN ('twilio', 'livekit')),
    ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'phone'
        CHECK (channel IN ('phone', 'playground', 'room', 'meet')),
    ADD COLUMN IF NOT EXISTS room_name TEXT,
    ADD COLUMN IF NOT EXISTS sip_call_id TEXT,
    -- Per-turn latency: [{turn, eou_ms, stt_ms, llm_ttft_ms, tts_ttfb_ms, total_ms}]
    ADD COLUMN IF NOT EXISTS latency_metrics JSONB,
    -- Voice pipeline actually used: {stt, llm, tts, avatar}
    ADD COLUMN IF NOT EXISTS pipeline JSONB,
    ADD COLUMN IF NOT EXISTS answered_by TEXT
        CHECK (answered_by IN ('human', 'machine', 'ivr', 'unknown')),
    ADD COLUMN IF NOT EXISTS end_reason TEXT;

-- Twilio-only statuses stay; LiveKit calls also report 'voicemail'.
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
ALTER TABLE calls ADD CONSTRAINT calls_status_check CHECK (status IN (
    'queued', 'ringing', 'in_progress', 'completed', 'failed',
    'no_answer', 'busy', 'voicemail'
));

-- Playground sessions have no candidate phone call behind them.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_calls_room ON calls(room_name);
