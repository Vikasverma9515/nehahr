"""AI video interview links."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "disable_auth", False)
    from app.main import app
    return TestClient(app)


def _row(**over):
    row = {
        "id": "ai-1", "candidate_id": "cand-1", "status": "invited", "attempts": 0, "max_attempts": 2,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat(),
        "room_name": None, "org_id": None, "candidates": {"name": "Priya Sharma"}, "jobs": {"title": "Backend Engineer"},
    }
    row.update(over)
    return row


def test_public_info_is_minimal(client, monkeypatch):
    from app.routers import ai_interviews as r
    monkeypatch.setattr(r, "_by_token", lambda t: _row())
    body = client.get("/api/ai-interviews/public/tok").json()
    assert body["first_name"] == "Priya" and body["job_title"] == "Backend Engineer"
    assert "email" not in body and "candidate_id" not in body


def test_join_requires_consent(client):
    r = client.post("/api/ai-interviews/public/tok/join", json={"consent": False})
    assert r.status_code == 400


def test_join_refuses_used_up_link(client, monkeypatch):
    from app.routers import ai_interviews as r
    monkeypatch.setattr(r, "_by_token", lambda t: _row(attempts=2))
    res = client.post("/api/ai-interviews/public/tok/join", json={"consent": True})
    assert res.status_code == 409


def test_join_reconnects_to_live_room(client, monkeypatch):
    from app.routers import ai_interviews as r
    monkeypatch.setattr(r, "_by_token", lambda t: _row(status="in_progress", room_name="room-x"))
    monkeypatch.setattr(r.livekit_service, "participant_token", lambda room, **k: f"token-for-{room}")
    res = client.post("/api/ai-interviews/public/tok/join", json={"consent": True})
    assert res.status_code == 200 and res.json()["token"] == "token-for-room-x"


def test_invite_requires_sign_in(client):
    assert client.post("/api/ai-interviews", json={"candidate_id": "c"}).status_code == 401


def test_ai_interview_score_is_average_rating(monkeypatch):
    import asyncio
    from app.services import call_outcome

    updates = {}

    class T:
        def __init__(self, n): self.n = n
        def update(self, data):
            updates.setdefault(self.n, []).append(data)
            return self
        def eq(self, *a): return self
        def execute(self): return None

    monkeypatch.setattr(call_outcome.db, "get_supabase", lambda: type("S", (), {"table": lambda s, n: T(n)})())

    class O(call_outcome.CallOutcome):
        def _ended_naturally(self): return True

    o = O("call-1", "interview", "cand-1")
    asyncio.run(o._finalize_ai_interview(
        {"role_specific_answers": [{"rating": 4}, {"rating": 5}, {"rating": 3}]}, "Solid answers"))
    ai = updates["ai_interviews"][0]
    assert ai["score"] == 80 and ai["status"] == "completed" and ai["summary"] == "Solid answers"
