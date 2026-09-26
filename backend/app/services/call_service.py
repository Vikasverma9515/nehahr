"""Twilio voice call management — initiate, end, status."""

from twilio.rest import Client

from app.config import settings
from app.services import db


def _run_sync(coro):
    """Run a coroutine from sync code, whether or not an event loop is running here."""
    import asyncio
    import concurrent.futures

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result()


class CallService:
    def __init__(self):
        self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        self.from_number = settings.twilio_phone_number
        self.backend_url = settings.backend_url

    def initiate_call(
        self,
        candidate_id: str,
        call_type: str = "screening",
    ) -> dict:
        """Initiate an outbound call to a candidate.

        1. Look up candidate phone number
        2. Create call record in DB
        3. Ask Twilio to make the call
        4. Update call record with Twilio SID
        """
        if settings.voice_runtime == "livekit":
            from app.services import livekit_service
            return _run_sync(livekit_service.start_phone_call(candidate_id, call_type))

        candidate = db.get_candidate(candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        from app.services.phone import to_e164
        to_number = to_e164(candidate["phone"])

        # Create DB record first
        call_record = db.create_call_record(
            candidate_id=candidate_id,
            call_type=call_type,
            to_number=to_number,
        )
        call_id = call_record["id"]

        # Twilio makes the call — when answered, Twilio hits our voice webhook
        twilio_call = self.client.calls.create(
            to=to_number,
            from_=self.from_number,
            url=f"{self.backend_url}/api/webhooks/twilio/voice?call_id={call_id}&call_type={call_type}&candidate_id={candidate_id}",
            status_callback=f"{self.backend_url}/api/webhooks/twilio/status",
            status_callback_event=["initiated", "ringing", "answered", "completed", "busy", "no-answer", "failed", "canceled"],
            record=True,
            recording_status_callback=f"{self.backend_url}/api/webhooks/twilio/recording",
        )

        # Update DB with Twilio SID
        db.update_call_status(call_id, "ringing", twilio_call_sid=twilio_call.sid)

        return {
            "call_id": call_id,
            "twilio_call_sid": twilio_call.sid,
            "to_number": to_number,
            "status": "ringing",
        }

    def end_call(self, twilio_call_sid: str | None = None, room_name: str | None = None) -> None:
        """Force-end an active call (Twilio SID or LiveKit room)."""
        if room_name:
            from app.services import livekit_service
            _run_sync(livekit_service.end_room(room_name))
        if twilio_call_sid:
            self.client.calls(twilio_call_sid).update(status="completed")


call_service = CallService()
