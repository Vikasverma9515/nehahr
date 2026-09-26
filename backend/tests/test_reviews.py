"""Hiring-manager review links."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "disable_auth", False)
    from app.main import app
    return TestClient(app)


def link(**over):
    row = {"id": "l1", "token": "tok", "candidate_ids": ["c1", "c2"], "org_id": None, "reviewer_name": "Anil",
           "expires_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(), "jobs": {"title": "SDE"}}
    row.update(over)
    return row


def test_decide_only_for_candidates_in_the_link(client, monkeypatch):
    from app.routers import reviews
    monkeypatch.setattr(reviews, "_review_link", lambda t: link())
    r = client.post("/api/reviews/public/tok/decide", json={"candidate_id": "other", "decision": "advance"})
    assert r.status_code == 404


def test_expired_link_is_refused(monkeypatch):
    from app.routers import reviews
    from fastapi import HTTPException

    class T:
        def select(self, *a): return self
        def eq(self, *a): return self
        def limit(self, *a): return self
        def execute(self):
            return type("R", (), {"data": [link(expires_at="2000-01-01T00:00:00+00:00")]})()

    monkeypatch.setattr(reviews.db, "get_supabase", lambda: type("S", (), {"table": lambda s, n: T()})())
    with pytest.raises(HTTPException) as e:
        reviews._review_link("tok")
    assert e.value.status_code == 410


def test_advance_shortlists(client, monkeypatch):
    from app.routers import reviews
    monkeypatch.setattr(reviews, "_review_link", lambda t: link())
    calls = []

    class T:
        def __init__(self, n): self.n = n
        def upsert(self, row, **k):
            calls.append((self.n, "upsert", row)); return self
        def update(self, row):
            calls.append((self.n, "update", row)); return self
        def eq(self, *a): return self
        def in_(self, *a): return self
        def execute(self): return None

    monkeypatch.setattr(reviews.db, "get_supabase", lambda: type("S", (), {"table": lambda s, n: T(n)})())
    r = client.post("/api/reviews/public/tok/decide", json={"candidate_id": "c1", "decision": "advance", "note": "strong"})
    assert r.status_code == 200
    assert calls[0][0] == "candidate_reviews"
    assert calls[1][2]["stage"] == "shortlisted" and "Anil advanced" in calls[1][2]["scheduling_notes"]


def test_create_requires_sign_in(client):
    assert client.post("/api/reviews", json={"job_id": "j"}).status_code == 401
