"""Twilio webhook routes — voice, status, recording, and WebSocket media stream."""

import json
import traceback
from fastapi import APIRouter, Depends, Request, WebSocket, Query
from fastapi.responses import Response

from app.config import settings
from app.services import db
from app.security import verify_twilio_request, stream_token, verify_value

router = APIRouter()


@router.post("/twilio/voice", dependencies=[Depends(verify_twilio_request)])
async def twilio_voice_webhook(
    request: Request,
    call_id: str = Query(...),
    call_type: str = Query("screening"),
    candidate_id: str = Query(...),
):
    """Called by Twilio when an outbound call is answered.
    Returns TwiML to open a bidirectional media stream.
    """
    backend_url = settings.backend_url
    ws_url = backend_url.replace("https://", "wss://").replace("http://", "ws://")

    print(f"[VOICE WEBHOOK] call_id={call_id}, candidate_id={candidate_id}")
    print(f"[VOICE WEBHOOK] WebSocket URL: {ws_url}/api/webhooks/twilio/stream/{call_id}")

    # Pass candidate_id and call_type as Stream Parameters (not query params)
    # Twilio delivers these in the "start" event of the WebSocket
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Aditi" language="en-IN">Please wait while we connect you.</Say>
    <Connect>
        <Stream url="{ws_url}/api/webhooks/twilio/stream/{call_id}">
            <Parameter name="call_id" value="{call_id}" />
            <Parameter name="call_type" value="{call_type}" />
            <Parameter name="candidate_id" value="{candidate_id}" />
            <Parameter name="token" value="{stream_token(call_id)}" />
        </Stream>
    </Connect>
</Response>"""

    return Response(content=twiml, media_type="application/xml")


@router.websocket("/twilio/stream/{call_id}")
async def twilio_media_stream(websocket: WebSocket, call_id: str):
    """WebSocket endpoint for Twilio media streams.

    Twilio sends candidate_id as a Parameter in the 'start' event,
    not as a query param on the WebSocket URL.
    """
    await websocket.accept()
    print(f"[STREAM] WebSocket connected for call {call_id}")

    # First, read the 'start' event to get custom parameters
    candidate_id = ""
    call_type = "screening"

    try:
        # Wait for the connected + start events
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            event = message.get("event")

            if event == "connected":
                print(f"[STREAM] Connected event received")
                continue

            if event == "start":
                # Extract custom parameters from the start event
                custom_params = message.get("start", {}).get("customParameters", {})
                candidate_id = custom_params.get("candidate_id", "")
                call_type = custom_params.get("call_type", "screening")
                # Only streams opened from our own signed TwiML may run a call.
                if not settings.disable_auth and not verify_value(
                    f"stream:{call_id}", custom_params.get("token")
                ):
                    print(f"[STREAM] Rejected stream for {call_id}: bad token")
                    await websocket.close(code=1008)
                    return
                print(f"[STREAM] Start event: candidate_id={candidate_id}, call_type={call_type}")

                # If no candidate_id in params, look it up from the call record
                if not candidate_id:
                    call_record = db.get_call(call_id)
                    if call_record:
                        candidate_id = call_record.get("candidate_id", "")
                        print(f"[STREAM] Got candidate_id from DB: {candidate_id}")

                break

            # Safety: if we get media before start, something is wrong
            if event == "media":
                print(f"[STREAM] Got media before start, breaking")
                break

        if not candidate_id:
            print(f"[STREAM ERROR] No candidate_id found, closing")
            await websocket.close()
            return

        # Now start the actual call handler
        from app.services.call_handler import CallHandler

        handler = CallHandler(
            websocket=websocket,
            call_id=call_id,
            call_type=call_type,
            candidate_id=candidate_id,
        )
        # Pass the start message so the handler knows the stream_sid
        await handler.handle_with_start(message)

    except Exception as e:
        print(f"[STREAM ERROR] {e}")
        traceback.print_exc()

        # Mark the call as failed so the candidate isn't stuck
        try:
            db.update_call_status(call_id, "failed")
            # Look up the call to reset candidate stage
            call_record = db.get_call(call_id)
            if call_record:
                cid = call_record.get("candidate_id")
                ctype = call_record.get("call_type", "")
                supabase = db.get_supabase()
                if ctype == "screening" and cid:
                    supabase.table("candidates").update({
                        "stage": "new",
                        "scheduling_notes": "Screening call failed due to a system error. HR can retry.",
                    }).eq("id", cid).eq("stage", "screening").execute()
                elif ctype == "scheduling" and cid:
                    supabase.table("candidates").update({
                        "stage": "shortlisted",
                        "needs_manual_scheduling": True,
                        "scheduling_notes": "Scheduling call failed due to a system error.",
                    }).eq("id", cid).eq("stage", "scheduling").execute()
                print(f"[STREAM ERROR] Call {call_id} marked as failed, candidate stage reset")
        except Exception as reset_err:
            print(f"[STREAM ERROR] Failed to reset state: {reset_err}")
    finally:
        print(f"[STREAM] WebSocket closed for call {call_id}")


@router.post("/twilio/status", dependencies=[Depends(verify_twilio_request)])
async def twilio_status_webhook(request: Request):
    """Called by Twilio with call status updates."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    call_status = form.get("CallStatus", "")
    duration = form.get("CallDuration")

    print(f"[STATUS] SID={call_sid} status={call_status} duration={duration}")

    status_map = {
        "queued": "queued",
        "initiated": "queued",
        "ringing": "ringing",
        "in-progress": "in_progress",
        "completed": "completed",
        "busy": "busy",
        "no-answer": "no_answer",
        "failed": "failed",
        "canceled": "failed",
    }

    our_status = status_map.get(call_status, None)
    if not our_status:
        print(f"[STATUS] Unknown status: {call_status}, skipping")
        return Response(content="<Response/>", media_type="application/xml")

    update_data = {"status": our_status}
    if duration:
        update_data["duration_seconds"] = int(duration)

    try:
        db.update_call_by_sid(call_sid, **update_data)
    except Exception as e:
        print(f"[STATUS ERROR] {e}")

    # When a call fails or goes unanswered, reset the candidate stage so HR
    # can retry. Without this, candidates get stuck in "screening" or
    # "scheduling" with no way to trigger another call.
    if our_status in ("failed", "no_answer", "busy"):
        try:
            # Look up which candidate + call_type this was for
            supabase = db.get_supabase()
            call_row = supabase.table("calls").select(
                "id, candidate_id, call_type"
            ).eq("twilio_call_sid", call_sid).limit(1).execute()

            if call_row.data:
                cid = call_row.data[0]["candidate_id"]
                ctype = call_row.data[0]["call_type"]

                # Reset stage based on call type
                if ctype == "screening":
                    supabase.table("candidates").update({
                        "stage": "new",
                        "scheduling_notes": f"Screening call {our_status}. Candidate was not reachable. HR can retry.",
                    }).eq("id", cid).eq("stage", "screening").execute()
                    print(f"[STATUS] Screening {our_status} — candidate {cid} reset to 'new'")

                elif ctype == "scheduling":
                    supabase.table("candidates").update({
                        "stage": "shortlisted",
                        "needs_manual_scheduling": True,
                        "scheduling_notes": f"Scheduling call {our_status}. Candidate was not reachable.",
                    }).eq("id", cid).eq("stage", "scheduling").execute()
                    print(f"[STATUS] Scheduling {our_status} — candidate {cid} reset to 'shortlisted'")

                if our_status in ("no_answer", "busy") and cid:
                    from app.services import messaging
                    messaging.missed_call(cid, ctype)

        except Exception as e:
            print(f"[STATUS] Stage reset failed: {e}")

    return Response(content="<Response/>", media_type="application/xml")


@router.post("/twilio/recording", dependencies=[Depends(verify_twilio_request)])
async def twilio_recording_webhook(request: Request):
    """Called by Twilio when a call recording is ready."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    recording_url = form.get("RecordingUrl", "")

    print(f"[RECORDING] SID={call_sid} url={recording_url}")

    if call_sid and recording_url:
        try:
            db.update_call_by_sid(call_sid, recording_url=f"{recording_url}.mp3")
        except Exception as e:
            print(f"[RECORDING ERROR] {e}")

    return Response(content="<Response/>", media_type="application/xml")


# ── WhatsApp / SMS ───────────────────────────────────────────────────────

@router.post("/twilio/message", dependencies=[Depends(verify_twilio_request)])
async def twilio_inbound_message(request: Request):
    """A candidate messaged us on WhatsApp or SMS: log it and let Neha reply."""
    from xml.sax.saxutils import escape
    from app.services import messaging

    form = await request.form()
    from_raw = form.get("From", "")
    reply = await messaging.handle_inbound(
        from_raw, form.get("To", ""), form.get("Body", "") or "", form.get("MessageSid", ""),
    )
    if not reply:
        return Response(content="<Response/>", media_type="application/xml")
    # Known candidates get the reply through send() so it's logged; unknown
    # numbers get it straight back in TwiML.
    candidate = messaging._find_candidate(from_raw.replace("whatsapp:", ""))
    if candidate:
        try:
            messaging.send(candidate["id"], reply, purpose="reply")
            return Response(content="<Response/>", media_type="application/xml")
        except Exception as e:
            print(f"[MESSAGE] reply via API failed, falling back to TwiML: {e}")
    return Response(content=f"<Response><Message>{escape(reply)}</Message></Response>", media_type="application/xml")


@router.post("/twilio/message-status", dependencies=[Depends(verify_twilio_request)])
async def twilio_message_status(request: Request):
    form = await request.form()
    sid, status = form.get("MessageSid"), form.get("MessageStatus")
    if sid and status:
        update = {"status": status}
        if form.get("ErrorCode"):
            update["error"] = f"{form.get('ErrorCode')}: {form.get('ErrorMessage', '')}"
        db.get_supabase().table("messages").update(update).eq("provider_sid", sid).execute()
    return Response(content="<Response/>", media_type="application/xml")
