"""Careers page apply form."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def test_honeypot_is_silently_dropped(client, monkeypatch):
    from app.routers import careers
    monkeypatch.setattr(careers, "_org", lambda s: (_ for _ in ()).throw(AssertionError("should not look up")))
    r = client.post("/api/careers/acme/j1/apply", data={"name": "Bot", "phone": "1", "website": "spam.com"})
    assert r.status_code == 200


def test_consent_required(client, monkeypatch):
    from app.routers import careers
    careers._recent.clear()
    r = client.post("/api/careers/acme/j1/apply", data={"name": "Priya", "phone": "9876543210"})
    assert r.status_code == 400


def test_bad_phone_rejected(client, monkeypatch):
    from app.routers import careers
    careers._recent.clear()
    monkeypatch.setattr(careers, "_org", lambda s: {"id": "o1", "name": "Acme"})
    monkeypatch.setattr(careers, "_job", lambda o, j: {"id": j})
    r = client.post("/api/careers/acme/j1/apply", data={"name": "Priya", "phone": "12", "consent": "true"})
    assert r.status_code == 400 and "phone" in r.json()["detail"]


def test_rate_limit():
    from app.routers import careers
    careers._recent.clear()
    assert not any(careers._rate_limited("1.2.3.4") for _ in range(5))
    assert careers._rate_limited("1.2.3.4")
