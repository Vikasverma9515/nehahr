"""Request authentication for the backend.

Three ways in:

1. A Supabase access token (``Authorization: Bearer <jwt>``) — the dashboard's
   server actions forward the signed-in user's session token.
2. The internal service key (``X-Internal-Key``) — used by our own workers
   (the LiveKit voice agent, the Meet bot) to call the API.
3. A signed link (``?exp=...&sig=...``) — for URLs the browser opens directly,
   like call recordings and the Google OAuth start page, where no header can
   be attached. The dashboard signs them with the shared ``APP_SECRET``.

Twilio webhooks are verified separately with ``verify_twilio_request``.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, Request

from app.config import settings


@dataclass
class CurrentUser:
    id: str
    email: str | None = None
    org_id: str | None = None
    is_service: bool = False


SERVICE_USER = CurrentUser(id="service", email=None, is_service=True)


# ── Supabase JWT verification ────────────────────────────────────────────

@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
    )


def decode_supabase_jwt(token: str) -> dict:
    """Verify a Supabase access token and return its claims.

    Projects on the legacy shared secret (HS256) set SUPABASE_JWT_SECRET;
    projects on asymmetric signing keys are verified against the JWKS.
    """
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise jwt.InvalidTokenError("SUPABASE_JWT_SECRET is not configured")
        key = settings.supabase_jwt_secret
    else:
        key = _jwks_client().get_signing_key_from_jwt(token).key
    return jwt.decode(
        token,
        key,
        algorithms=[alg],
        audience="authenticated",
        options={"require": ["exp", "sub"]},
    )


def _lookup_org_id(user_id: str) -> str | None:
    """First organization the user belongs to (None before orgs exist)."""
    try:
        from app.services import db
        res = (
            db.get_supabase().table("org_members")
            .select("org_id").eq("user_id", user_id).limit(1).execute()
        )
        return res.data[0]["org_id"] if res.data else None
    except Exception:
        return None


async def require_user(
    authorization: str | None = Header(default=None),
    x_internal_key: str | None = Header(default=None),
    x_org_id: str | None = Header(default=None),
) -> CurrentUser:
    """FastAPI dependency: reject the request unless it is authenticated."""
    if settings.disable_auth:
        return SERVICE_USER

    if x_internal_key and settings.internal_api_key and hmac.compare_digest(
        x_internal_key, settings.internal_api_key
    ):
        return CurrentUser(id="service", org_id=x_org_id, is_service=True)

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")

    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_supabase_jwt(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = claims["sub"]
    return CurrentUser(id=user_id, email=claims.get("email"), org_id=_lookup_org_id(user_id))


# ── Signed links ─────────────────────────────────────────────────────────

def sign_value(value: str) -> str:
    return hmac.new(settings.app_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def verify_value(value: str, sig: str | None) -> bool:
    if not sig or not settings.app_secret:
        return False
    return hmac.compare_digest(sign_value(value), sig)


def sign_path(path: str, ttl_seconds: int = 3600) -> tuple[int, str]:
    """Return (exp, sig) for a path; append as ?exp=..&sig=.."""
    exp = int(time.time()) + ttl_seconds
    return exp, sign_value(f"{path}:{exp}")


def require_signed_link(request: Request) -> None:
    """FastAPI dependency for URLs the browser opens directly."""
    if settings.disable_auth:
        return
    exp = request.query_params.get("exp")
    sig = request.query_params.get("sig")
    try:
        exp_i = int(exp or "0")
    except ValueError:
        exp_i = 0
    if exp_i < time.time() or not verify_value(f"{request.url.path}:{exp_i}", sig):
        raise HTTPException(status_code=403, detail="This link is invalid or has expired")


# ── Twilio webhook verification ──────────────────────────────────────────

async def verify_twilio_request(request: Request) -> None:
    """Reject webhook calls that were not signed by our Twilio account.

    Twilio signs the full public URL plus the POSTed form fields, so we
    rebuild the URL from BACKEND_URL (the address Twilio was given) rather
    than from the request, which may have been rewritten by a proxy.
    """
    if settings.disable_auth or settings.skip_twilio_signature:
        return
    from twilio.request_validator import RequestValidator

    signature = request.headers.get("X-Twilio-Signature", "")
    url = settings.backend_url.rstrip("/") + request.url.path
    if request.url.query:
        url += "?" + request.url.query
    form = await request.form()
    params = {k: v for k, v in form.items()}
    if not RequestValidator(settings.twilio_auth_token).validate(url, params, signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")


def stream_token(call_id: str) -> str:
    """Token passed to Twilio's media stream so the WebSocket can be trusted."""
    return sign_value(f"stream:{call_id}")


AuthUser = Depends(require_user)
