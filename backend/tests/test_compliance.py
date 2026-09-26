"""Calling hours and deferred calls."""

import asyncio
from datetime import datetime, timezone

from app.services.compliance import DEFAULT_HOURS, next_call_time


def utc(y, m, d, h, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


def test_inside_hours_calls_now():
    # 2026-09-28 is a Monday; 06:00 UTC = 11:30 IST
    assert next_call_time(DEFAULT_HOURS, utc(2026, 9, 28, 6)) is None


def test_late_evening_moves_to_next_morning():
    # 16:00 UTC Monday = 21:30 IST -> Tuesday 09:05 IST = 03:35 UTC
    assert next_call_time(DEFAULT_HOURS, utc(2026, 9, 28, 16)) == utc(2026, 9, 29, 3, 35)


def test_early_morning_moves_to_same_day():
    # 01:00 UTC Monday = 06:30 IST -> Monday 09:05 IST
    assert next_call_time(DEFAULT_HOURS, utc(2026, 9, 28, 1)) == utc(2026, 9, 28, 3, 35)


def test_weekend_moves_to_monday():
    # Saturday 2026-09-26 12:00 IST
    assert next_call_time(DEFAULT_HOURS, utc(2026, 9, 26, 6, 30)) == utc(2026, 9, 28, 3, 35)
    assert next_call_time({**DEFAULT_HOURS, "weekends": True}, utc(2026, 9, 26, 6, 30)) is None


def test_queue_defers_without_counting_a_failure(monkeypatch):
    from app.workers import queue

    updates, finished = [], []

    class Q:
        def __init__(self, n): self.n = n
        def update(self, row):
            updates.append(row); return self
        def eq(self, *a): return self
        def execute(self): return type("R", (), {"data": None})()

    class S:
        def table(self, n): return Q(n)
        def rpc(self, fn, params):
            class R:
                def execute(self_inner):
                    if fn == "claim_background_tasks":
                        return type("R", (), {"data": [{"id": "t1", "kind": "test.defer", "payload": {}, "attempts": 1}]})()
                    finished.append(params)
                    return type("R", (), {"data": None})()
            return R()

    later = datetime(2030, 1, 1, tzinfo=timezone.utc)

    @queue.task("test.defer")
    def _defer(payload):
        raise queue.Deferred(later)

    monkeypatch.setattr(queue.db, "get_supabase", lambda: S())
    asyncio.run(queue.run_once())
    assert updates and updates[0]["status"] == "queued" and updates[0]["run_at"] == later.isoformat()
    assert updates[0]["attempts"] == 0 and finished == []
