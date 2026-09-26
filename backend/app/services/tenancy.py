"""Organization scoping for the backend.

The backend talks to Supabase with the service key, which bypasses row-level
security, so it has to enforce organization boundaries itself:

* ``enforce_org_scope`` (a router dependency) rejects any request whose path,
  query or JSON body names a candidate / job / call / interview / interviewer
  that belongs to another organization.
* ``current_org()`` returns the caller's org so list endpoints can filter and
  create endpoints can stamp new rows.

A caller with no org (a database from before migration 008, or a service
call that didn't say which org) is not filtered, matching the old behaviour.
"""

from __future__ import annotations

import contextvars

from fastapi import Depends, HTTPException, Request

from app.security import CurrentUser, require_user
from app.services import db

_current_org: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_org", default=None)

# Request field name → table whose row it points at.
RESOURCE_FIELDS = {
    "candidate_id": "candidates",
    "job_id": "jobs",
    "call_id": "calls",
    "interview_id": "interviews",
    "interviewer_id": "interviewers",
}


def current_org() -> str | None:
    return _current_org.get()


def scope(query, org_id: str | None = None):
    """Add an org filter to a Supabase query when the caller has an org."""
    org = org_id or current_org()
    return query.eq("org_id", org) if org else query


def stamp(data: dict) -> dict:
    """Set org_id on a row about to be inserted."""
    org = current_org()
    if org and not data.get("org_id"):
        data = {**data, "org_id": org}
    return data


def _row_org(table: str, row_id: str) -> tuple[bool, str | None]:
    """(exists, org_id) for a row; treats lookup errors as 'not found'."""
    try:
        res = db.get_supabase().table(table).select("org_id").eq("id", row_id).limit(1).execute()
    except Exception:
        # e.g. a database without the org_id column yet — don't block.
        return True, None
    if not res.data:
        return False, None
    return True, res.data[0].get("org_id")


async def _referenced_ids(request: Request) -> list[tuple[str, str]]:
    refs: list[tuple[str, str]] = []
    sources = [request.path_params, request.query_params]
    if request.method in ("POST", "PATCH", "PUT") and "json" in request.headers.get("content-type", ""):
        try:
            body = await request.json()
            if isinstance(body, dict):
                sources.append(body)
        except Exception:
            pass
    for source in sources:
        for field, table in RESOURCE_FIELDS.items():
            value = source.get(field)
            if isinstance(value, str) and value:
                refs.append((table, value))
    return refs


async def enforce_org_scope(request: Request, user: CurrentUser = Depends(require_user)) -> CurrentUser:
    _current_org.set(user.org_id)
    if not user.org_id:
        return user
    for table, row_id in await _referenced_ids(request):
        exists, org = _row_org(table, row_id)
        # Same 404 whether it's missing or someone else's, so ids can't be probed.
        if exists and org and org != user.org_id:
            raise HTTPException(status_code=404, detail="Not found")
    return user
