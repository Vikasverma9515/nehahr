"""Call management API routes."""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.services.call_service import call_service
from app.services import db
from app.security import require_signed_link
from app.services.tenancy import scope

router = APIRouter()
# Opened directly by the browser's <audio> tag, so it uses a signed link.
public_router = APIRouter()


class InitiateCallRequest(BaseModel):
    candidate_id: str
    call_type: str = "screening"


@router.post("/initiate")
async def initiate_call(req: InitiateCallRequest):
    """Trigger an outbound call to a candidate.

    This is what the dashboard "Trigger Screening Call" button hits.
    """
    try:
        result = call_service.initiate_call(
            candidate_id=req.candidate_id,
            call_type=req.call_type,
        )
        # Update candidate stage
        if req.call_type == "screening":
            db.update_candidate(req.candidate_id, stage="screening")
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {e}")


@router.get("/")
async def list_calls(
    call_type: str | None = None,
    status: str | None = None,
    limit: int = 50,
):
    """List calls with optional filters."""
    supabase = db.get_supabase()
    query = scope(supabase.table("calls").select(
        "*, candidates(name)"
    )).order("created_at", desc=True).limit(limit)

    if call_type:
        query = query.eq("call_type", call_type)
    if status:
        query = query.eq("status", status)

    result = query.execute()
    return {"calls": result.data, "total": len(result.data)}


@router.get("/{call_id}")
async def get_call(call_id: str):
    """Get call detail with transcript and recording."""
    call = db.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@public_router.get("/{call_id}/recording", dependencies=[Depends(require_signed_link)])
async def get_call_recording(call_id: str):
    """Proxy the Twilio recording audio through our backend.

    Twilio recordings require HTTP Basic Auth with Account SID + Auth Token.
    We fetch them server-side and stream them to the browser so the user
    doesn't get a basic auth popup.
    """
    call = db.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    recording_url = call.get("recording_url")
    if not recording_url:
        raise HTTPException(status_code=404, detail="No recording available")

    async def stream_audio():
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "GET",
                recording_url,
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            ) as response:
                if response.status_code != 200:
                    return
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    yield chunk

    return StreamingResponse(
        stream_audio(),
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


@router.post("/{call_id}/end")
async def end_call(call_id: str):
    """Manually end an active call."""
    call = db.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if call.get("twilio_call_sid") or call.get("room_name"):
        try:
            call_service.end_call(call.get("twilio_call_sid"), call.get("room_name"))
        except Exception:
            pass

    db.update_call_status(call_id, "completed")
    return {"status": "ended"}
