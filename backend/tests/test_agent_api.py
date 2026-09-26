"""Internal API used by the LiveKit voice agent."""

import pytest
from fastapi.testclient import TestClient

from app.config import settings

HEADERS = {"X-Internal-Key": "test-internal"}


@pytest.fixture(autouse=True)
def secure(monkeypatch):
    monkeypatch.setattr(settings, "disable_auth", False)
    monkeypatch.setattr(settings, "internal_api_key", "test-internal")


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def test_internal_routes_need_service_key(client):
    assert client.get("/api/agent/calls/c1/context").status_code == 401
    assert client.get("/api/agent/calls/c1/context", headers={"X-Internal-Key": "wrong"}).status_code == 401


def test_complete_runs_shared_outcome(client, monkeypatch):
    from app.routers import agent

    call = {"id": "c1", "call_type": "screening", "candidate_id": "cand-1", "status": "in_progress"}
    monkeypatch.setattr(agent.db, "get_call", lambda cid: call)
    monkeypatch.setattr(agent.db, "update_call_status", lambda *a, **k: {})
    ran = {}

    async def fake_end_call(self):
        ran["transcript"] = self.full_transcript
        ran["extracted"] = self._extracted()
        ran["ended"] = self._ended_naturally()

    monkeypatch.setattr(agent.AgentCallOutcome, "_end_call", fake_end_call)
    r = client.post("/api/agent/calls/c1/complete", headers=HEADERS, json={
        "transcript": [{"speaker": "neha", "text": "Hi"}, {"speaker": "candidate", "text": "Hello"}],
        "extracted": {"current_location": "Pune"},
        "ended_naturally": True,
    })
    assert r.status_code == 200
    assert ran["extracted"] == {"current_location": "Pune"} and ran["ended"] is True
    assert [t["speaker"] for t in ran["transcript"]] == ["neha", "candidate"]


def test_complete_for_test_call_leaves_candidate_alone(client, monkeypatch):
    from app.routers import agent

    call = {"id": "c2", "call_type": "result", "candidate_id": "cand-1", "is_test": True}
    monkeypatch.setattr(agent.db, "get_call", lambda cid: call)
    saved = {}
    monkeypatch.setattr(agent.db, "complete_call", lambda call_id, **k: saved.update(k))

    async def no_summary(*a, **k):
        return "summary"

    monkeypatch.setattr(agent, "summarize_transcript", no_summary)
    monkeypatch.setattr(agent.AgentCallOutcome, "_end_call",
                        lambda self: (_ for _ in ()).throw(AssertionError("must not run")))
    r = client.post("/api/agent/calls/c2/complete", headers=HEADERS, json={
        "transcript": [{"speaker": "neha", "text": "Hi"}], "extracted": {"result_delivered": True},
    })
    assert r.status_code == 200 and r.json()["test"] is True
    assert saved["extracted_data"] == {"result_delivered": True}


def test_callback_validates_time(client, monkeypatch):
    from app.routers import agent
    monkeypatch.setattr(agent.db, "get_call", lambda cid: {"id": "c1", "candidate_id": "x", "call_type": "screening"})
    r = client.post("/api/agent/calls/c1/callback", headers=HEADERS, json={"when": "2001-01-01T10:00:00+00:00"})
    assert r.status_code == 400


def test_playground_needs_livekit(client, monkeypatch):
    monkeypatch.setattr(settings, "disable_auth", True)
    from app.services import livekit_service
    monkeypatch.setattr(livekit_service, "is_configured", lambda: False)
    r = client.post("/api/agent/playground/session", json={"candidate_id": "cand-1"})
    assert r.status_code == 503
