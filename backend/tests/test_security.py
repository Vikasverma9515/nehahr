"""Auth, signed links and Twilio signature checks."""

import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.fixture(autouse=True)
def secure_settings(monkeypatch):
    monkeypatch.setattr(settings, "disable_auth", False)
    monkeypatch.setattr(settings, "skip_twilio_signature", False)
    monkeypatch.setattr(settings, "supabase_jwt_secret", "test-jwt-secret")
    monkeypatch.setattr(settings, "app_secret", "test-app-secret")
    monkeypatch.setattr(settings, "internal_api_key", "test-internal")
    monkeypatch.setattr(settings, "twilio_auth_token", "test-twilio-token")
    monkeypatch.setattr(settings, "backend_url", "https://api.example.com")


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def _token(**overrides):
    claims = {"sub": "user-1", "aud": "authenticated", "exp": int(time.time()) + 60}
    claims.update(overrides)
    return jwt.encode(claims, "test-jwt-secret", algorithm="HS256")


def test_api_rejects_anonymous(client):
    assert client.get("/api/jobs/").status_code == 401


def test_api_rejects_bad_token(client):
    r = client.get("/api/jobs/", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_api_rejects_expired_token(client):
    r = client.get("/api/jobs/", headers={"Authorization": f"Bearer {_token(exp=1)}"})
    assert r.status_code == 401


def test_require_user_accepts_valid_token():
    import asyncio
    from app.security import require_user
    user = asyncio.run(require_user(authorization=f"Bearer {_token()}", x_internal_key=None, x_org_id=None))
    assert user.id == "user-1" and not user.is_service


def test_require_user_accepts_internal_key():
    import asyncio
    from app.security import require_user
    user = asyncio.run(require_user(authorization=None, x_internal_key="test-internal", x_org_id="org-9"))
    assert user.is_service and user.org_id == "org-9"


def test_health_stays_public(client):
    assert client.get("/health").status_code == 200


def test_signed_link_required_for_recording(client):
    assert client.get("/api/calls/abc/recording").status_code == 403
    r = client.get("/api/calls/abc/recording?exp=9999999999&sig=deadbeef")
    assert r.status_code == 403


def test_signed_link_roundtrip():
    from app.security import sign_path, verify_value
    exp, sig = sign_path("/api/calls/abc/recording", 60)
    assert verify_value(f"/api/calls/abc/recording:{exp}", sig)
    assert not verify_value(f"/api/calls/other/recording:{exp}", sig)


def test_oauth_state_is_signed():
    from app.services.calendar_service import signed_state, verify_state
    state = signed_state("interviewer-1")
    assert verify_state(state) == "interviewer-1"
    assert verify_state("interviewer-2." + state.rsplit(".", 1)[1]) is None
    assert verify_state("interviewer-1") is None


def test_twilio_webhook_requires_signature(client):
    r = client.post("/api/webhooks/twilio/status", data={"CallSid": "CA1", "CallStatus": "ringing"})
    assert r.status_code == 403


def test_twilio_webhook_accepts_valid_signature(client, monkeypatch):
    from twilio.request_validator import RequestValidator
    from app.services import db
    monkeypatch.setattr(db, "update_call_by_sid", lambda *a, **k: None)
    params = {"CallSid": "CA1", "CallStatus": "ringing"}
    sig = RequestValidator("test-twilio-token").compute_signature(
        "https://api.example.com/api/webhooks/twilio/status", params
    )
    r = client.post("/api/webhooks/twilio/status", data=params, headers={"X-Twilio-Signature": sig})
    assert r.status_code == 200
