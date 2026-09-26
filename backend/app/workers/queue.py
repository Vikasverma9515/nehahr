"""Durable background tasks on Postgres (migration 009).

    from app.workers.queue import enqueue
    enqueue("call.initiate", {"candidate_id": cid, "call_type": "screening"}, delay_seconds=300)

A worker loop (started in the FastAPI lifespan, or on its own with
``python -m app.workers.queue``) claims due tasks with SKIP LOCKED, runs the
registered handler and records the result. Failed tasks retry with a
growing delay up to ``max_attempts``.

If the table doesn't exist yet (migration 009 not applied), ``enqueue``
falls back to an in-process asyncio timer so nothing is silently dropped.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import os
import socket
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from app.services import db

log = logging.getLogger("neha.queue")

Handler = Callable[[dict], Any | Awaitable[Any]]
_handlers: dict[str, Handler] = {}

WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"
POLL_SECONDS = 5


def task(kind: str):
    """Register a handler: ``@task("call.initiate")``."""
    def register(fn: Handler) -> Handler:
        _handlers[kind] = fn
        return fn
    return register


def enqueue(
    kind: str,
    payload: dict | None = None,
    *,
    delay_seconds: float = 0,
    dedupe_key: str | None = None,
    max_attempts: int = 3,
    org_id: str | None = None,
) -> str | None:
    """Queue a task. Returns its id, or None if the dedupe key already exists."""
    payload = payload or {}
    run_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    row = {
        "kind": kind,
        "payload": payload,
        "run_at": run_at.isoformat(),
        "max_attempts": max_attempts,
    }
    if dedupe_key:
        row["dedupe_key"] = dedupe_key
    if org_id:
        row["org_id"] = org_id
    try:
        res = db.get_supabase().table("background_tasks").insert(row).execute()
        return res.data[0]["id"] if res.data else None
    except Exception as e:
        msg = str(e)
        if dedupe_key and ("duplicate key" in msg or "23505" in msg):
            return None
        if "background_tasks" in msg and ("does not exist" in msg or "PGRST205" in msg):
            log.warning("background_tasks table missing; running %s in-process", kind)
            _run_later_in_process(kind, payload, delay_seconds)
            return None
        raise


def _run_later_in_process(kind: str, payload: dict, delay_seconds: float) -> None:
    async def _later():
        await asyncio.sleep(delay_seconds)
        await _dispatch(kind, payload)

    try:
        asyncio.get_running_loop().create_task(_later())
    except RuntimeError:
        asyncio.run(_later())


async def _dispatch(kind: str, payload: dict) -> Any:
    handler = _handlers.get(kind)
    if handler is None:
        raise LookupError(f"No handler registered for task kind {kind!r}")
    if inspect.iscoroutinefunction(handler):
        return await handler(payload)
    # Handlers that do blocking IO (Twilio REST, sync Supabase) run in a thread.
    return await asyncio.to_thread(handler, payload)


async def run_once(limit: int = 10) -> int:
    """Claim and run due tasks once. Returns how many ran."""
    supabase = db.get_supabase()
    res = await asyncio.to_thread(
        lambda: supabase.rpc("claim_background_tasks", {"p_worker": WORKER_ID, "p_limit": limit}).execute()
    )
    tasks = res.data or []
    for t in tasks:
        ok, err = True, None
        try:
            await _dispatch(t["kind"], t.get("payload") or {})
        except Deferred as d:
            # Back to the queue at the allowed time; this attempt doesn't count.
            await asyncio.to_thread(lambda: supabase.table("background_tasks").update({
                "status": "queued", "run_at": d.run_at.isoformat(), "attempts": max(0, (t.get("attempts") or 1) - 1),
                "locked_by": None, "locked_at": None, "last_error": f"deferred to {d.run_at.isoformat()}",
            }).eq("id", t["id"]).execute())
            continue
        except Exception as e:
            ok, err = False, f"{e}\n{traceback.format_exc(limit=5)}"
            log.error("task %s (%s) failed: %s", t["id"], t["kind"], e)
        await asyncio.to_thread(
            lambda: supabase.rpc(
                "finish_background_task", {"p_id": t["id"], "p_ok": ok, "p_error": err}
            ).execute()
        )
    return len(tasks)


async def run_worker() -> None:
    """Poll forever. Safe to run in several processes at once."""
    log.info("queue worker %s started", WORKER_ID)
    while True:
        try:
            ran = await run_once()
        except Exception as e:
            msg = str(e)
            if "claim_background_tasks" in msg or "PGRST202" in msg:
                log.warning("migration 009 not applied; queue worker idle")
                await asyncio.sleep(60)
                continue
            log.error("queue poll failed: %s", e)
            ran = 0
        if not ran:
            await asyncio.sleep(POLL_SECONDS)


# ── Built-in handlers ────────────────────────────────────────────────────

class Deferred(Exception):
    """Raised by a handler to push the task to a later time without counting a failure."""

    def __init__(self, run_at: datetime):
        self.run_at = run_at


@task("call.initiate")
def _initiate_call(payload: dict):
    from app.services import compliance, db as _db
    from app.services.call_service import call_service

    # Automated calls only inside the org's calling hours.
    cand = _db.get_supabase().table("candidates").select("org_id").eq(
        "id", payload["candidate_id"]).single().execute().data or {}
    later = compliance.next_call_time(compliance.calling_hours(cand.get("org_id")))
    if later and not payload.get("ignore_calling_hours"):
        raise Deferred(later)
    return call_service.initiate_call(
        candidate_id=payload["candidate_id"],
        call_type=payload.get("call_type", "screening"),
    )


@task("retention.purge")
def _retention_purge(payload: dict):
    from app.services import compliance
    return compliance.purge_expired()


@task("meet.launch")
async def _meet_launch(payload: dict):
    from app.services import meet_bot_service
    return await meet_bot_service.launch_for_interview(payload["interview_id"])


@task("scheduler.tick")
async def _scheduler_tick(payload: dict):
    from app.workers.scheduler import run_checks
    await run_checks()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
