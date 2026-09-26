"""Client for the backend's internal agent API (/api/agent/...)."""

from __future__ import annotations

import logging

import httpx

from .config import settings

log = logging.getLogger("neha.backend")


class BackendClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        self._client = httpx.AsyncClient(
            base_url=(base_url or settings.backend_api_url).rstrip("/"),
            headers={"X-Internal-Key": api_key or settings.internal_api_key},
            timeout=httpx.Timeout(10.0, read=60.0),
        )

    async def call_context(self, call_id: str) -> dict:
        r = await self._client.get(f"/api/agent/calls/{call_id}/context")
        r.raise_for_status()
        return r.json()

    async def set_status(self, call_id: str, status: str, **fields) -> None:
        try:
            r = await self._client.post(
                f"/api/agent/calls/{call_id}/status", json={"status": status, **fields}
            )
            r.raise_for_status()
        except Exception as e:  # status updates are best effort
            log.warning("status update %s failed: %s", status, e)

    async def request_callback(self, call_id: str, when_iso: str, note: str) -> dict:
        r = await self._client.post(
            f"/api/agent/calls/{call_id}/callback", json={"when": when_iso, "note": note}
        )
        r.raise_for_status()
        return r.json()

    async def inbound(self, from_number: str, to_number: str | None, room_name: str) -> dict:
        r = await self._client.post("/api/agent/inbound", json={
            "from_number": from_number, "to_number": to_number, "room_name": room_name,
        })
        r.raise_for_status()
        return r.json()

    async def candidate_request(self, call_id: str, kind: str, details: str) -> None:
        r = await self._client.post(
            f"/api/agent/calls/{call_id}/request", json={"kind": kind, "details": details}
        )
        r.raise_for_status()

    async def complete(self, call_id: str, report: dict) -> None:
        r = await self._client.post(f"/api/agent/calls/{call_id}/complete", json=report)
        r.raise_for_status()

    async def aclose(self) -> None:
        await self._client.aclose()
