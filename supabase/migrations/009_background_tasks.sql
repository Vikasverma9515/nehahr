-- =============================================================
-- 009: Durable background tasks
--
-- Replaces in-memory asyncio.sleep() retries and the in-process 5-minute
-- scheduler loop. Tasks survive restarts and redeploys, and with several
-- backend replicas each task runs exactly once (claim uses SKIP LOCKED;
-- dedupe_key stops two replicas enqueueing the same scheduler tick).
-- =============================================================

CREATE TABLE IF NOT EXISTS background_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,                       -- e.g. 'call.initiate', 'scheduler.tick'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    dedupe_key TEXT UNIQUE,
    locked_by TEXT,
    locked_at TIMESTAMPTZ,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_tasks_due
    ON background_tasks (run_at) WHERE status = 'queued';

ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read their tasks" ON background_tasks
    FOR SELECT USING (org_id IS NOT NULL AND is_org_member(org_id));

-- Claim up to p_limit due tasks for one worker. Tasks stuck in 'running'
-- for longer than p_stale_seconds (a crashed worker) are picked up again.
CREATE OR REPLACE FUNCTION claim_background_tasks(
    p_worker TEXT,
    p_limit INTEGER DEFAULT 10,
    p_stale_seconds INTEGER DEFAULT 600
)
RETURNS SETOF background_tasks
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    UPDATE background_tasks t
    SET status = 'running',
        attempts = t.attempts + 1,
        locked_by = p_worker,
        locked_at = now()
    WHERE t.id IN (
        SELECT id FROM background_tasks
        WHERE (status = 'queued' AND run_at <= now())
           OR (status = 'running' AND locked_at < now() - make_interval(secs => p_stale_seconds))
        ORDER BY run_at
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING t.*;
$$;

-- Finish a task: done, or back to queued with a delay, or failed for good.
CREATE OR REPLACE FUNCTION finish_background_task(
    p_id UUID,
    p_ok BOOLEAN,
    p_error TEXT DEFAULT NULL,
    p_retry_seconds INTEGER DEFAULT 60
)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    UPDATE background_tasks SET
        status = CASE
            WHEN p_ok THEN 'done'
            WHEN attempts >= max_attempts THEN 'failed'
            ELSE 'queued' END,
        run_at = CASE WHEN p_ok THEN run_at
                      ELSE now() + make_interval(secs => p_retry_seconds * attempts) END,
        last_error = p_error,
        locked_by = NULL,
        locked_at = NULL,
        finished_at = CASE WHEN p_ok OR attempts >= max_attempts THEN now() ELSE NULL END
    WHERE id = p_id;
$$;
