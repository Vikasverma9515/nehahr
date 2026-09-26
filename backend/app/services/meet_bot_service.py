"""Send Neha into a Google Meet interview.

1. Create a call row (channel=meet) linked to the interview.
2. Dispatch the voice agent into a LiveKit room with Neha's role.
3. Ask the Meet bot service to open the Meet link in Chrome and bridge it
   into that room.
"""

from __future__ import annotations

import httpx

from app.config import settings
from app.services import db, livekit_service

ROLES = ("notetaker", "co_interviewer", "lead")


def is_configured() -> bool:
    return bool(settings.meet_bot_url and settings.meet_bot_secret and livekit_service.is_configured())


async def launch_for_interview(interview_id: str) -> dict:
    if not is_configured():
        raise RuntimeError("Meet bot is not configured (MEET_BOT_URL, MEET_BOT_SECRET, LiveKit)")
    supabase = db.get_supabase()
    iv = supabase.table("interviews").select(
        "id, candidate_id, meeting_link, neha_role, duration_minutes, org_id, round_number"
    ).eq("id", interview_id).single().execute().data
    if not iv:
        raise ValueError("Interview not found")
    if iv.get("neha_role") not in ROLES:
        raise ValueError("Neha has no role in this interview")
    link = iv.get("meeting_link") or ""
    if "meet.google.com" not in link:
        raise ValueError("This interview has no Google Meet link")

    call = db.create_call_record(candidate_id=iv["candidate_id"], call_type="interview")
    room = f"meet-{call['id']}"
    db.update_call_status(
        call["id"], "queued", runtime="livekit", channel="meet", room_name=room, interview_id=iv["id"],
    )
    await livekit_service.dispatch_agent(room, {
        "call_id": call["id"],
        "call_type": "interview",
        "candidate_id": iv["candidate_id"],
        "channel": "meet",
        "neha_role": iv["neha_role"],
        "interview_id": iv["id"],
        "pipeline": {"avatar": True},
    })
    bridge_token = livekit_service.participant_token(
        room, identity="meet-bridge", name="Google Meet",
        ttl_minutes=(iv.get("duration_minutes") or 60) + 60,
        attributes={"role": "meeting"},
    )
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            f"{settings.meet_bot_url.rstrip('/')}/bots",
            headers={"Authorization": f"Bearer {settings.meet_bot_secret}"},
            json={
                "call_id": call["id"],
                "meet_url": link,
                "livekit_url": settings.livekit_url,
                "token": bridge_token,
                "bot_name": settings.meet_bot_name,
                "max_minutes": (iv.get("duration_minutes") or 60) + 15,
            },
        )
        r.raise_for_status()
        bot_id = r.json().get("bot_id")
    supabase.table("interviews").update({"bot_status": "joining", "bot_id": bot_id}).eq("id", iv["id"]).execute()
    return {"call_id": call["id"], "room": room, "bot_id": bot_id}


async def recall(interview_id: str) -> None:
    """Ask the bot to leave now."""
    iv = db.get_supabase().table("interviews").select("bot_id").eq("id", interview_id).single().execute().data
    if not iv or not iv.get("bot_id") or not settings.meet_bot_url:
        return
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.delete(
            f"{settings.meet_bot_url.rstrip('/')}/bots/{iv['bot_id']}",
            headers={"Authorization": f"Bearer {settings.meet_bot_secret}"},
        )
