"""Candidate portal."""

import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "disable_auth", False)
    from app.main import app
    return TestClient(app)


def cand(**over):
    c = {"id": "cand-1", "name": "Priya Sharma", "stage": "shortlisted", "job_id": "job-1", "org_id": None,
         "jobs": {"title": "Backend Engineer", "default_interviewer_id": "iv-1"}}
    c.update(over)
    return c


def test_booking_rejects_a_slot_that_is_no_longer_free(client, monkeypatch):
    from app.routers import portal
    monkeypatch.setattr(portal, "_candidate", lambda t: cand())

    async def slots(c):
        return [{"start": "2026-10-01T10:00:00+05:30", "end": "2026-10-01T11:00:00+05:30", "label": "Thu 10 AM"}]

    monkeypatch.setattr(portal, "_slots_for", slots)
    r = client.post("/api/portal/public/tok/book", json={"start": "2026-10-01T15:00:00+05:30"})
    assert r.status_code == 409 and "just taken" in r.json()["detail"]


def test_booking_closed_unless_shortlisted(client, monkeypatch):
    from app.routers import portal
    monkeypatch.setattr(portal, "_candidate", lambda t: cand(stage="new"))
    assert client.get("/api/portal/public/tok/slots").status_code == 409


def test_call_me_rejects_far_future(client, monkeypatch):
    from app.routers import portal
    monkeypatch.setattr(portal, "_candidate", lambda t: cand(stage="new"))
    r = client.post("/api/portal/public/tok/call-me", json={"when": "2099-01-01T10:00:00+00:00"})
    assert r.status_code == 400


def test_call_me_now_queues(client, monkeypatch):
    from app.routers import portal
    import app.workers.queue as q
    monkeypatch.setattr(portal, "_candidate", lambda t: cand(stage="new"))
    queued = []
    monkeypatch.setattr(q, "enqueue", lambda kind, payload, **k: queued.append((kind, payload, k)) or "t1")
    r = client.post("/api/portal/public/tok/call-me", json={})
    assert r.status_code == 200 and queued[0][1] == {"candidate_id": "cand-1", "call_type": "screening"}


def test_link_requires_sign_in(client):
    assert client.post("/api/portal/link/cand-1").status_code == 401
