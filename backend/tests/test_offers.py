"""Offers."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.routers import offers


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "disable_auth", False)
    from app.main import app
    return TestClient(app)


def test_letter_has_the_numbers():
    letter = offers.build_letter(company="Acme", candidate_name="Priya Sharma", designation="SDE 2",
                                 ctc={"fixed": 18, "variable": 2, "joining_bonus": 1},
                                 joining_date="01 November 2026", location="Pune", reporting_to=None,
                                 expires="01 October 2026")
    assert "Dear Priya" in letter and "₹20 lakhs per annum" in letter and "₹1 lakhs" in letter
    assert "01 November 2026" in letter and "01 October 2026" in letter


def test_letter_escapes_html():
    letter = offers.build_letter(company="<b>X</b>", candidate_name="<script>", designation="d", ctc={"fixed": 1},
                                 joining_date=None, location=None, reporting_to=None, expires=None)
    assert "<script>" not in letter


def test_approval_needed_above_band():
    assert offers._approval_needed({"salary_range_max": 20}, {"fixed": 19, "variable": 2})
    assert not offers._approval_needed({"salary_range_max": 20}, {"fixed": 18, "variable": 2})
    assert not offers._approval_needed({}, {"fixed": 99})


def sent_offer(**over):
    row = {"id": "o1", "status": "sent", "candidate_id": "c1", "org_id": None, "letter_html": "<p>x</p>",
           "ctc": {"fixed": 18}, "joining_date": "2026-11-01", "candidates": {"name": "Priya Sharma"},
           "expires_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()}
    row.update(over)
    return row


def test_accept_requires_own_name(client, monkeypatch):
    monkeypatch.setattr(offers, "_by_token", lambda t: sent_offer())
    r = client.post("/api/offers/public/tok/accept", json={"full_name": "Someone Else", "agree": True})
    assert r.status_code == 400 and "own name" in r.json()["detail"]


def test_accept_records_signature(client, monkeypatch):
    monkeypatch.setattr(offers, "_by_token", lambda t: sent_offer())
    updates = []

    class T:
        def __init__(self, n): self.n = n
        def update(self, row):
            updates.append((self.n, row)); return self
        def eq(self, *a): return self
        def execute(self): return None

    monkeypatch.setattr(offers.db, "get_supabase", lambda: type("S", (), {"table": lambda s, n: T(n)})())
    r = client.post("/api/offers/public/tok/accept", json={"full_name": "  Priya   Sharma ", "agree": True},
                    headers={"user-agent": "test-agent"})
    assert r.status_code == 200
    offer_update = dict(updates)["offers"]
    assert offer_update["signature_name"] == "Priya Sharma" and offer_update["status"] == "accepted"
    assert len(offer_update["letter_sha256"]) == 64 and offer_update["signature_user_agent"] == "test-agent"
    assert dict(updates)["candidates"]["stage"] == "pre_joining"


def test_drafts_are_not_public(client, monkeypatch):
    monkeypatch.setattr(offers, "_by_token", lambda t: sent_offer(status="draft"))
    assert client.get("/api/offers/public/tok").status_code == 404
