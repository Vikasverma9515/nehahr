"""Background task queue and phone normalization."""

import asyncio

import pytest

from app.services.phone import to_e164


@pytest.mark.parametrize("raw,expected", [
    ("9876543210", "+919876543210"),
    ("09876543210", "+919876543210"),
    ("+91 98765 43210", "+919876543210"),
    ("+1 415 555 2671", "+14155552671"),
])
def test_to_e164(raw, expected):
    assert to_e164(raw) == expected


def test_to_e164_rejects_garbage():
    with pytest.raises(ValueError):
        to_e164("12")


class FakeSupabase:
    """Just enough of the Supabase client for the queue."""

    def __init__(self, due=None, insert_error=None):
        self.due = due or []
        self.inserted = []
        self.finished = []
        self.insert_error = insert_error

    def table(self, name):
        outer = self

        class T:
            def insert(self, row):
                if outer.insert_error:
                    raise Exception(outer.insert_error)
                outer.inserted.append(row)
                return self

            def execute(self):
                return type("R", (), {"data": [{"id": "task-1"}]})()
        return T()

    def rpc(self, fn, params):
        outer = self

        class R:
            def execute(self):
                if fn == "claim_background_tasks":
                    data, outer.due = outer.due, []
                    return type("R", (), {"data": data})()
                outer.finished.append(params)
                return type("R", (), {"data": None})()
        return R()


def test_enqueue_writes_row(monkeypatch):
    from app.workers import queue
    fake = FakeSupabase()
    monkeypatch.setattr(queue.db, "get_supabase", lambda: fake)
    assert queue.enqueue("call.initiate", {"candidate_id": "c1"}, delay_seconds=60, dedupe_key="k") == "task-1"
    row = fake.inserted[0]
    assert row["kind"] == "call.initiate" and row["dedupe_key"] == "k"


def test_enqueue_duplicate_returns_none(monkeypatch):
    from app.workers import queue
    fake = FakeSupabase(insert_error="duplicate key value violates unique constraint (23505)")
    monkeypatch.setattr(queue.db, "get_supabase", lambda: fake)
    assert queue.enqueue("scheduler.tick", dedupe_key="slot-1") is None


def test_run_once_dispatches_and_records(monkeypatch):
    from app.workers import queue
    seen = []

    @queue.task("test.ok")
    def ok(payload):
        seen.append(payload)

    @queue.task("test.boom")
    async def boom(payload):
        raise RuntimeError("nope")

    fake = FakeSupabase(due=[
        {"id": "1", "kind": "test.ok", "payload": {"x": 1}},
        {"id": "2", "kind": "test.boom", "payload": {}},
    ])
    monkeypatch.setattr(queue.db, "get_supabase", lambda: fake)
    assert asyncio.run(queue.run_once()) == 2
    assert seen == [{"x": 1}]
    results = {f["p_id"]: f["p_ok"] for f in fake.finished}
    assert results == {"1": True, "2": False}
