"""Core call loop — low-latency version.

Key optimizations:
1. UtteranceEnd-based turn detection (no blind debounce)
2. Streaming TTS via Deepgram WebSocket (audio starts ~200ms after text sent)
3. Always forward audio to Deepgram STT (keeps connection alive)
"""

import json
import base64
import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import WebSocket

from app.services.transcription import LiveTranscriber
from app.services.tts_service import StreamingTTS
from app.services.ai_conversation import ConversationManager
from app.services import db


class CallHandler:
    """Handles one live phone call end-to-end."""

    def __init__(self, websocket: WebSocket, call_id: str, call_type: str, candidate_id: str):
        self.ws = websocket
        self.call_id = call_id
        self.call_type = call_type
        self.candidate_id = candidate_id

        self.stream_sid: str | None = None
        self.twilio_call_sid: str | None = None
        self.transcriber: LiveTranscriber | None = None
        self.tts: StreamingTTS | None = None
        self.conversation: ConversationManager | None = None

        self.full_transcript: list[dict] = []
        self.is_speaking = False
        self._responding = False
        self._ended = False

        # Buffer for accumulated final transcripts this turn.
        # Protected by lock to prevent race between _on_transcript and _on_utterance_end.
        self._utterance_buffer = ""
        self._buffer_lock = asyncio.Lock()

        # Scheduling-call specific state
        self._interview_id: str | None = None
        self._offered_slots: list[dict] = []
        self._confirmed_slot_id: int | None = None
        self._booking_result: dict | None = None
        self._scheduling_finalized: bool = False

    async def handle_with_start(self, start_message: dict):
        """Main call loop."""
        candidate = db.get_candidate(self.candidate_id)
        if not candidate:
            print(f"[HANDLER] Candidate {self.candidate_id} not found")
            return

        print(f"[HANDLER] Starting call with {candidate.get('name', 'unknown')}")

        try:
            # Build per-call context (scheduling calls need slot info)
            context = self._build_call_context()
            self.conversation = ConversationManager(
                call_type=self.call_type,
                candidate=candidate,
                context=context,
            )
        except Exception as e:
            print(f"[HANDLER] ConversationManager init FAILED: {e}")
            import traceback; traceback.print_exc()
            raise

        # STT
        self.transcriber = LiveTranscriber(
            on_transcript=self._on_transcript,
            on_utterance_end=self._on_utterance_end,
        )
        await self.transcriber.connect()
        print(f"[HANDLER] Deepgram STT connected")

        # Streaming TTS
        self.tts = StreamingTTS(on_audio_chunk=self._on_tts_audio)
        await self.tts.connect()
        print(f"[HANDLER] Deepgram TTS connected")

        db.update_call_status(self.call_id, "in_progress")

        start_block = start_message.get("start", {}) or {}
        self.stream_sid = start_block.get("streamSid")
        self.twilio_call_sid = start_block.get("callSid")
        print(f"[HANDLER] Stream SID: {self.stream_sid}, Twilio Call SID: {self.twilio_call_sid}")

        # Speak greeting
        greeting = self.conversation.get_greeting()
        self.full_transcript.append({
            "speaker": "neha", "text": greeting,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        self.is_speaking = True
        await self.tts.speak(greeting)
        # Mark when audio playback is done (we estimate from text length)
        asyncio.create_task(self._finish_speaking_after(greeting))

        try:
            async for raw_message in self.ws.iter_text():
                message = json.loads(raw_message)
                event = message.get("event")

                if event == "media":
                    # Always forward audio to Deepgram STT
                    payload = message["media"]["payload"]
                    audio_bytes = base64.b64decode(payload)
                    if self.transcriber:
                        await self.transcriber.send_audio(audio_bytes)

                elif event == "mark":
                    # Twilio mark callback — could use for tracking playback
                    pass

                elif event == "stop":
                    break

        except Exception as e:
            print(f"Call {self.call_id} error: {e}")
        finally:
            await self._cleanup()

    async def _on_transcript(self, text: str, is_final: bool):
        """Called for each transcript chunk."""
        if self.is_speaking or self._responding or self._ended:
            return
        if self.conversation and self.conversation.should_end:
            return

        if is_final and text.strip():
            print(f"[STT FINAL] {text}")
            async with self._buffer_lock:
                if self._utterance_buffer:
                    self._utterance_buffer += " " + text.strip()
                else:
                    self._utterance_buffer = text.strip()

    async def _on_utterance_end(self):
        """Called when Deepgram detects the user has finished their turn."""
        if self.is_speaking or self._responding or self._ended:
            return

        # Don't respond after Neha has said goodbye — the call is ending
        if self.conversation and self.conversation.should_end:
            return

        async with self._buffer_lock:
            utterance = self._utterance_buffer.strip()
            self._utterance_buffer = ""

        if not utterance:
            return

        print(f"[HANDLER] Candidate said: {utterance}")
        self.full_transcript.append({
            "speaker": "candidate", "text": utterance,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Get AI response
        self._responding = True
        try:
            ai_response = await self.conversation.respond(utterance)
        except Exception as e:
            print(f"[HANDLER] Claude error: {e}")
            ai_response = "I'm sorry, could you repeat that?"
        finally:
            self._responding = False

        if self.conversation and self.conversation.should_end:
            self._ended = True

        if ai_response:
            print(f"[HANDLER] Neha says: {ai_response}")
            self.full_transcript.append({
                "speaker": "neha", "text": ai_response,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            self.is_speaking = True
            if self.tts:
                await self.tts.speak(ai_response)
            asyncio.create_task(self._finish_speaking_after(ai_response))

        # For scheduling calls, track the slot choice. The actual booking is
        # deferred to _finalize_scheduling_call (which runs on natural call
        # end) so that a mid-call disconnect can't create an orphan booking.
        if self.call_type == "scheduling":
            extracted = self.conversation.extracted_data
            slot_id = extracted.get("confirmed_slot_id")
            if slot_id and self._confirmed_slot_id is None:
                try:
                    self._confirmed_slot_id = int(slot_id)
                    print(f"[HANDLER] Candidate tentatively confirmed slot {self._confirmed_slot_id} — will book at call end if conversation completes")
                except (ValueError, TypeError):
                    pass

        if self.conversation.should_end and not self._ended:
            self._ended = True
            # Wait for Neha's closing line to finish playing, then hang up.
            # _finish_speaking_after flips is_speaking=False once TTS playback
            # is estimated complete; we wait on that, plus a small trailing
            # pause so the audio isn't cut off mid-word.
            asyncio.create_task(self._schedule_hangup())

    async def _on_tts_audio(self, audio_chunk: bytes):
        """Called with each audio chunk from Deepgram TTS. Stream to Twilio."""
        if not self.stream_sid:
            return

        try:
            payload = base64.b64encode(audio_chunk).decode("ascii")
            await self.ws.send_text(json.dumps({
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {"payload": payload},
            }))
        except Exception as e:
            print(f"[TTS] send error: {e}")

    async def _finish_speaking_after(self, text: str):
        """Mark speaking as done when TTS finishes generating audio.

        Uses the Deepgram 'Flushed' event for accurate timing instead of
        guessing from text length. Falls back to estimate if flush times out.
        """
        if self.tts:
            flushed = await self.tts.wait_for_flush(timeout=12.0)
            if flushed:
                # Audio generation done — add a small buffer for Twilio playback lag
                await asyncio.sleep(0.5)
            else:
                # Fallback: estimate from text length
                duration = len(text) / 15.0 + 0.5
                await asyncio.sleep(duration)
        else:
            await asyncio.sleep(len(text) / 15.0 + 0.5)

        self.is_speaking = False
        print(f"[HANDLER] Neha done speaking, listening...")

    async def _schedule_hangup(self):
        """Wait for Neha's current utterance to finish, then end the call."""
        # Wait for is_speaking to clear (max 12s)
        for _ in range(60):
            if not self.is_speaking:
                break
            await asyncio.sleep(0.2)
        # Trailing pause so the final word isn't clipped
        await asyncio.sleep(1.0)

        await self._end_call()
        await self._hangup_twilio_call()

    async def _hangup_twilio_call(self):
        """Force-end the active Twilio call so the candidate's phone stops ringing."""
        if not self.twilio_call_sid:
            print("[HANDLER] No Twilio call SID; cannot force hangup")
            return
        try:
            from app.services.call_service import call_service
            # call_service.end_call is sync (twilio REST is blocking) — run in a thread
            # so we don't block the event loop on network IO.
            await asyncio.to_thread(call_service.end_call, self.twilio_call_sid)
            print(f"[HANDLER] Twilio call {self.twilio_call_sid} hung up")
        except Exception as e:
            print(f"[HANDLER] Twilio hangup failed: {e}")

    def _build_call_context(self) -> dict:
        """Load per-call context depending on call type."""
        if self.call_type == "reminder":
            return self._build_reminder_context()
        if self.call_type == "result":
            return self._build_result_context()
        if self.call_type in ("pre_joining", "engagement"):
            return self._build_pre_joining_context()
        if self.call_type != "scheduling":
            return {}

        # Find the pending interview row linked to this call
        supabase = db.get_supabase()
        result = (
            supabase.table("interviews")
            .select("id, offered_slots, interview_type, duration_minutes, interviewer_id, interviewers(name, email)")
            .eq("scheduling_call_id", self.call_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            # Fallback: grab the most recent pending interview for this candidate
            result = (
                supabase.table("interviews")
                .select("id, offered_slots, interview_type, duration_minutes, interviewer_id, interviewers(name, email)")
                .eq("candidate_id", self.candidate_id)
                .is_("confirmed_slot", "null")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

        if not result.data:
            print(f"[HANDLER] No pending interview row for scheduling call {self.call_id}")
            return {}

        interview = result.data[0]
        self._interview_id = interview["id"]
        self._offered_slots = interview.get("offered_slots") or []

        interviewer_info = interview.get("interviewers") or {}
        if isinstance(interviewer_info, list):
            interviewer_info = interviewer_info[0] if interviewer_info else {}

        return {
            "slots": self._offered_slots,
            "interviewer_name": interviewer_info.get("name", "our interviewer"),
            "interview_type": interview.get("interview_type", "video"),
            "duration_minutes": interview.get("duration_minutes", 60),
        }

    async def _should_auto_retry(self, delay_minutes: int = 5) -> bool:
        """Check if we should auto-retry this call type.

        Returns True if a retry was scheduled (first attempt failed).
        Returns False if this IS already the retry (don't loop forever).

        Logic: count how many calls of this type were made to this candidate
        in the last 30 minutes. If only 1 (this call), schedule a retry.
        If 2+, this is already a retry — give up and let HR handle it.
        """
        supabase = db.get_supabase()
        thirty_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()

        recent = supabase.table("calls").select(
            "id", count="exact", head=True
        ).eq(
            "candidate_id", self.candidate_id
        ).eq(
            "call_type", self.call_type
        ).gte(
            "created_at", thirty_min_ago
        ).execute()

        recent_count = recent.count or 0

        if recent_count >= 2:
            # Already retried — don't loop
            print(f"[RETRY] {self.call_type}: already {recent_count} attempts in 30m — giving up")
            return False

        # Durable retry: survives restarts and redeploys.
        from app.workers.queue import enqueue
        enqueue(
            "call.initiate",
            {"candidate_id": self.candidate_id, "call_type": self.call_type},
            delay_seconds=delay_minutes * 60,
            dedupe_key=f"retry:{self.call_id}",
        )
        print(f"[RETRY] {self.call_type}: scheduling retry in {delay_minutes}m")
        return True

    def _build_pre_joining_context(self) -> dict:
        """Load joining date + engagement score for pre-joining/engagement calls."""
        supabase = db.get_supabase()
        result = (
            supabase.table("candidates")
            .select("joining_date, engagement_score")
            .eq("id", self.candidate_id)
            .single()
            .execute()
        )
        if not result.data:
            return {}
        return {
            "joining_date": result.data.get("joining_date", "your joining date"),
            "engagement_score": result.data.get("engagement_score") or "N/A",
        }

    def _build_reminder_context(self) -> dict:
        """Load interview details for a reminder call."""
        from zoneinfo import ZoneInfo

        supabase = db.get_supabase()
        result = (
            supabase.table("interviews")
            .select("id, scheduled_at, interview_type, duration_minutes, interviewers(timezone)")
            .eq("candidate_id", self.candidate_id)
            .eq("status", "scheduled")
            .order("scheduled_at", desc=False)
            .limit(1)
            .execute()
        )
        if not result.data:
            return {}
        iv = result.data[0]
        scheduled_at = iv.get("scheduled_at", "")
        interviewer_info = iv.get("interviewers") or {}
        tz_name = interviewer_info.get("timezone", "Asia/Kolkata") if isinstance(interviewer_info, dict) else "Asia/Kolkata"
        try:
            dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
            local_dt = dt.astimezone(ZoneInfo(tz_name))
            time_str = f"today at {local_dt.strftime('%-I:%M %p')}"
        except Exception:
            time_str = "today"
        return {
            "interview_time": time_str,
            "interview_type": iv.get("interview_type", "video"),
            "duration_minutes": iv.get("duration_minutes", 60),
        }

    def _build_result_context(self) -> dict:
        """Load interview result for a result call."""
        supabase = db.get_supabase()
        result = (
            supabase.table("interviews")
            .select("id, result")
            .eq("candidate_id", self.candidate_id)
            .eq("status", "completed")
            .eq("feedback_status", "submitted")
            .order("scheduled_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return {"result": "hold"}
        return {"result": result.data[0].get("result", "hold")}

    async def _book_confirmed_slot(self):
        """Book the confirmed slot in Google Calendar + update interview row."""
        if not self._interview_id or self._confirmed_slot_id is None:
            return

        # Validate slot index (1-based from Claude)
        idx = self._confirmed_slot_id - 1
        if idx < 0 or idx >= len(self._offered_slots):
            print(f"[HANDLER] Invalid slot id {self._confirmed_slot_id}, only {len(self._offered_slots)} slots")
            return

        slot = self._offered_slots[idx]

        # Load candidate + interviewer details
        supabase = db.get_supabase()
        interview_result = (
            supabase.table("interviews")
            .select("interviewer_id, interview_type")
            .eq("id", self._interview_id)
            .single()
            .execute()
        )
        if not interview_result.data:
            print(f"[HANDLER] Interview {self._interview_id} not found")
            return

        interviewer_id = interview_result.data["interviewer_id"]
        interview_type = interview_result.data.get("interview_type", "video")

        candidate = db.get_candidate(self.candidate_id)
        if not candidate:
            return

        candidate_name = candidate.get("name", "Candidate")
        candidate_email = candidate.get("email")
        job = candidate.get("jobs") or {}
        job_title = job.get("title", "the role") if isinstance(job, dict) else "the role"

        # Create the event
        from app.services import calendar_service
        booking = await calendar_service.create_interview_event(
            interviewer_id=interviewer_id,
            start_iso=slot["start"],
            end_iso=slot["end"],
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            job_title=job_title,
            interview_type=interview_type,
        )

        if not booking:
            print(f"[HANDLER] Calendar booking failed for interview {self._interview_id}")
            return

        self._booking_result = booking

        # Update interviews row
        supabase.table("interviews").update({
            "confirmed_slot": slot,
            "scheduled_at": slot["start"],
            "google_event_id": booking.get("event_id"),
            "meeting_link": booking.get("meet_link"),
            "status": "scheduled",
        }).eq("id", self._interview_id).execute()

        # Update candidate stage: scheduling → scheduled
        supabase.table("candidates").update({
            "stage": "scheduled",
            "last_contact_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", self.candidate_id).execute()

        print(f"[HANDLER] Booked: {slot['label']} with Meet {booking.get('meet_link')}")

        # Send confirmation email via Gmail API to both the candidate and the
        # interviewer. This is independent of Google Calendar's invite-email
        # logic (which can silently drop self-invites and has inconsistent
        # delivery), giving us reliable notification of the booked slot.
        meet_link = booking.get("meet_link")
        if meet_link:
            try:
                from app.services import calendar_service
                await calendar_service.send_booking_email(
                    interviewer_id=interviewer_id,
                    candidate_name=candidate_name,
                    candidate_email=candidate_email,
                    job_title=job_title,
                    slot=slot,
                    meet_link=meet_link,
                    interview_type=interview_type,
                )
            except Exception as e:
                print(f"[HANDLER] Booking email send failed: {e}")

    async def _end_call(self):
        """End the call gracefully — save transcript, score candidate, update stage.

        Idempotent — the WebSocket cleanup path may also invoke this flow, so
        we check whether a transcript has already been saved and bail early.
        """
        existing = db.get_call(self.call_id)
        if existing and existing.get("transcript"):
            return

        transcript_text = "\n".join(
            f"{'Neha' if t['speaker'] == 'neha' else 'Candidate'}: {t['text']}"
            for t in self.full_transcript
        )

        summary = None
        extracted = self.conversation.get_extracted_data() if self.conversation else {}
        try:
            # get_summary() uses sync httpx — run in thread to avoid blocking event loop
            if self.conversation:
                summary = await asyncio.to_thread(self.conversation.get_summary)
        except Exception as e:
            print(f"[SUMMARY ERROR] {e}")

        call_record = db.get_call(self.call_id)
        duration = None
        if call_record and call_record.get("started_at"):
            start = datetime.fromisoformat(call_record["started_at"])
            duration = int((datetime.now(timezone.utc) - start).total_seconds())

        db.complete_call(
            call_id=self.call_id, transcript=transcript_text,
            ai_summary=summary, extracted_data=extracted, duration_seconds=duration,
        )

        # Score the candidate (only for screening calls)
        scorecard = None
        if self.call_type == "screening" and extracted:
            try:
                candidate = db.get_candidate(self.candidate_id)
                if candidate:
                    from app.services.scoring import score_candidate
                    scorecard = await score_candidate(candidate, extracted)
                    print(f"[HANDLER] Scorecard: {scorecard.get('score')}/100 - {scorecard.get('reason', '')[:80]}")
            except Exception as e:
                print(f"[SCORING ERROR] {e}")

        # For screening calls: copy demographics + scorecard to candidate
        if self.call_type == "screening":
            turns = len(self.full_transcript)
            if turns < 6 and not scorecard:
                if await self._should_auto_retry(delay_minutes=5):
                    print(f"[HANDLER] Screening: INCOMPLETE ({turns} turns) — auto-retrying in 5m")
                else:
                    supabase = db.get_supabase()
                    supabase.table("candidates").update({
                        "scheduling_notes": f"Screening call failed twice ({turns} exchanges). Call disconnected before scoring. HR should trigger another call manually.",
                        "last_contact_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", self.candidate_id).execute()
                    print(f"[HANDLER] Screening: INCOMPLETE after retry — HR flagged")
            await self._apply_extracted_to_candidate(extracted, scorecard)

        # For scheduling calls: handle the manual-scheduling fallback
        if self.call_type == "scheduling":
            await self._finalize_scheduling_call(extracted)

        # For reminder calls: handle dropout
        if self.call_type == "reminder":
            await self._finalize_reminder_call(extracted)

        # For result calls: mark result as communicated
        if self.call_type == "result":
            await self._finalize_result_call()

        # For pre-joining/engagement calls: update candidate status
        if self.call_type in ("pre_joining", "engagement"):
            await self._finalize_pre_joining_call(extracted)

        print(f"[HANDLER] Call {self.call_id} ended and saved")

    async def _finalize_scheduling_call(self, extracted: dict):
        """Handle the end of a scheduling call.

        Booking is gated on the conversation actually completing — we require
        (a) Claude set should_end=True (i.e. Neha said goodbye), (b) enough
        exchanges happened to plausibly confirm a slot, and (c) a minimum
        duration. Any disconnect, short call, or ambiguous end routes to
        manual scheduling instead of creating a possibly-unconfirmed booking.

        Outcomes:
        1. Completed naturally + slot confirmed → book now, stage=scheduled
        2. Completed naturally, candidate rejected all → flag for manual
        3. Dropped/short/ambiguous → flag for manual, cancel pending interview
        """
        # Idempotency: _cleanup may also call this if _end_call didn't run
        if self._scheduling_finalized:
            return
        self._scheduling_finalized = True

        supabase = db.get_supabase()

        # Gate 1: Did the conversation end naturally? should_end=True means
        # Claude delivered a closing line (either after confirming a slot or
        # after manual-fallback). If the websocket dropped mid-conversation,
        # should_end will still be False and we must NOT book.
        ended_naturally = bool(self.conversation and self.conversation.should_end)

        # Gate 2: Enough back-and-forth to plausibly confirm a slot? A real
        # scheduling flow is: greeting → offer slots → candidate picks → Neha
        # confirms → close. That's at least 4 transcript entries (2 from each
        # side). Any less and we can't trust the "confirmation".
        turn_count = len(self.full_transcript)
        enough_exchanges = turn_count >= 4

        # Gate 3: Minimum call duration. An 8-second call can't have confirmed
        # anything, even if the AI extracted a slot_id from noise or a stray
        # greeting. Require at least 20s of actual conversation.
        duration_seconds = 0
        call_record = db.get_call(self.call_id)
        if call_record and call_record.get("started_at"):
            try:
                start = datetime.fromisoformat(call_record["started_at"])
                duration_seconds = int((datetime.now(timezone.utc) - start).total_seconds())
            except Exception:
                pass
        long_enough = duration_seconds >= 20

        manual_needed = extracted.get("manual_scheduling_needed") if extracted else False
        has_slot = self._confirmed_slot_id is not None

        # Decide: book, or flag for manual?
        should_book = (
            has_slot
            and ended_naturally
            and enough_exchanges
            and long_enough
            and not manual_needed
        )

        if should_book:
            print(f"[HANDLER] Scheduling confirmed — booking slot {self._confirmed_slot_id} "
                  f"(turns={turn_count}, duration={duration_seconds}s, ended_naturally=True)")
            try:
                await self._book_confirmed_slot()
            except Exception as e:
                print(f"[HANDLER] Booking failed: {e} — flagging for manual")

            if self._booking_result:
                return  # success path; _book_confirmed_slot already updated DB

            # Booking threw or returned no result — fall through to manual
            print(f"[HANDLER] Booking did not complete — flagging for manual")

        # Anything else → manual scheduling
        reason_bits = []
        if not has_slot:
            reason_bits.append("no slot was confirmed")
        if not ended_naturally:
            reason_bits.append("call disconnected before the conversation ended")
        if not enough_exchanges:
            reason_bits.append(f"only {turn_count} turn(s) exchanged")
        if not long_enough:
            reason_bits.append(f"call lasted only {duration_seconds}s")
        if manual_needed:
            reason_bits.append("candidate couldn't commit to offered slots")
        reason = "; ".join(reason_bits) or "call ended before confirmation"

        supabase.table("candidates").update({
            "stage": "shortlisted",
            "needs_manual_scheduling": True,
            "scheduling_notes": f"Auto-scheduling did not complete: {reason}. HR should reach out to schedule manually.",
            "last_contact_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", self.candidate_id).execute()

        if self._interview_id:
            supabase.table("interviews").update({
                "status": "cancelled",
            }).eq("id", self._interview_id).execute()

        print(f"[HANDLER] Scheduling call NOT booked — {reason}")

    async def _apply_extracted_to_candidate(self, extracted: dict, scorecard: dict | None = None):
        """Copy extracted fields + scorecard onto the candidate row.

        Determines the next stage based on the scorecard:
        - qualified: stage → 'screened' (awaiting HR shortlist)
        - unqualified: stage → 'rejected'
        - no scorecard: stage → 'screened'
        """
        update_fields: dict = {
            "last_contact_at": datetime.now(timezone.utc).isoformat(),
        }

        # Whitelist of candidate columns that map 1:1 to extracted keys
        CANDIDATE_FIELDS = {
            "current_location", "open_to_relocation", "work_model_preference",
            "employment_status", "notice_period_days", "current_ctc", "expected_ctc",
            "reason_for_leaving", "role_specific_answers",
        }

        if extracted:
            for key, value in extracted.items():
                if key in CANDIDATE_FIELDS and value is not None and value != "":
                    update_fields[key] = value

        # Apply scorecard
        if scorecard and scorecard.get("score") is not None:
            update_fields["score"] = scorecard["score"]
            update_fields["score_breakdown"] = scorecard.get("breakdown")

            if scorecard.get("qualified"):
                update_fields["qualification_status"] = "qualified"
                update_fields["stage"] = "screened"
                update_fields["disqualification_reason"] = None
            else:
                update_fields["qualification_status"] = "unqualified"
                update_fields["stage"] = "rejected"
                update_fields["disqualification_reason"] = scorecard.get("reason", "")
        else:
            # No scorecard — still mark as screened so HR can review manually
            update_fields["stage"] = "screened"
            update_fields["disqualification_reason"] = None

        db.update_candidate(self.candidate_id, **update_fields)
        print(f"[HANDLER] Candidate updated: stage={update_fields.get('stage')}, score={update_fields.get('score', 'n/a')}")
        print(f"[HANDLER] Candidate updated with {len(update_fields)} fields")

    async def _cleanup(self):
        """Clean up resources when the WebSocket closes.

        Always save transcript/extracted/scorecard if we have any data AND
        the call record doesn't already have a transcript saved. This handles
        the race condition where Twilio's status webhook sets status=completed
        before our cleanup runs.
        """
        if self.transcriber:
            await self.transcriber.close()
        if self.tts:
            await self.tts.close()

        # Check if _end_call already saved data. If transcript is already
        # populated, skip — _end_call was cleaner. Otherwise save what we have.
        call_record = db.get_call(self.call_id)
        if not call_record:
            return

        already_saved = bool(call_record.get("transcript"))
        if already_saved:
            print(f"[HANDLER] Call {self.call_id} already saved by _end_call, skipping cleanup save")
            return

        if not self.full_transcript:
            print(f"[HANDLER] No transcript data to save for {self.call_id}")
            return

        transcript_text = "\n".join(
            f"{'Neha' if t['speaker'] == 'neha' else 'Candidate'}: {t['text']}"
            for t in self.full_transcript
        )

        extracted = self.conversation.get_extracted_data() if self.conversation else {}

        # Generate summary
        summary = None
        if self.conversation and self.full_transcript:
            try:
                summary = self.conversation.get_summary()
            except Exception as e:
                print(f"[SUMMARY ERROR] {e}")

        # Calculate duration from started_at
        duration = None
        if call_record.get("started_at"):
            try:
                start = datetime.fromisoformat(call_record["started_at"])
                duration = int((datetime.now(timezone.utc) - start).total_seconds())
            except Exception:
                pass

        db.complete_call(
            call_id=self.call_id,
            transcript=transcript_text,
            ai_summary=summary,
            extracted_data=extracted,
            duration_seconds=duration,
        )

        # Score the candidate
        scorecard = None
        if self.call_type == "screening" and extracted:
            try:
                candidate = db.get_candidate(self.candidate_id)
                if candidate:
                    from app.services.scoring import score_candidate
                    scorecard = await score_candidate(candidate, extracted)
                    print(f"[HANDLER] Scorecard from cleanup: {scorecard.get('score')}/100")
            except Exception as e:
                print(f"[SCORING ERROR] {e}")

        await self._apply_extracted_to_candidate(extracted, scorecard)

        # For calls that dropped before _end_call could run, route through
        # the same per-type finalize so state like candidate_reminded or
        # result_communicated gets set (or safely gated for scheduling).
        if self.call_type == "scheduling":
            await self._finalize_scheduling_call(extracted)
        elif self.call_type == "reminder":
            try:
                await self._finalize_reminder_call(extracted)
            except Exception as e:
                print(f"[HANDLER] Reminder finalize failed in cleanup: {e}")
        elif self.call_type == "result":
            try:
                await self._finalize_result_call()
            except Exception as e:
                print(f"[HANDLER] Result finalize failed in cleanup: {e}")
        elif self.call_type in ("pre_joining", "engagement"):
            try:
                await self._finalize_pre_joining_call(extracted)
            except Exception as e:
                print(f"[HANDLER] Pre-joining finalize failed in cleanup: {e}")

        print(f"[HANDLER] Call {self.call_id} data saved via cleanup path")

    async def _finalize_reminder_call(self, extracted: dict):
        """Handle reminder call outcomes.

        Three possible outcomes:
        1. Candidate confirmed → mark reminded
        2. Candidate explicitly dropping → cancel interview, flag HR
        3. Inconclusive (call cut, unclear) → flag HR, don't cancel
        """
        supabase = db.get_supabase()
        candidate_dropping = extracted.get("candidate_dropping", False) if extracted else False

        # Check if the call was too short to be conclusive
        turns = len(self.full_transcript)
        is_inconclusive = turns < 4 and not candidate_dropping

        if candidate_dropping:
            # ── OUTCOME: Candidate dropping out ──────────────────────
            interviews_result = (
                supabase.table("interviews")
                .select("id, google_event_id, interviewer_id")
                .eq("candidate_id", self.candidate_id)
                .eq("status", "scheduled")
                .order("scheduled_at", desc=True)
                .limit(1)
                .execute()
            )
            if interviews_result.data:
                iv = interviews_result.data[0]
                supabase.table("interviews").update({
                    "status": "cancelled",
                }).eq("id", iv["id"]).execute()

                # Cancel Google Calendar event
                if iv.get("google_event_id") and iv.get("interviewer_id"):
                    try:
                        from app.services import calendar_service
                        access_token = await calendar_service.get_valid_access_token(iv["interviewer_id"])
                        if access_token:
                            import httpx
                            async with httpx.AsyncClient(timeout=10.0) as client:
                                await client.delete(
                                    f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{iv['google_event_id']}",
                                    headers={"Authorization": f"Bearer {access_token}"},
                                )
                            print(f"[HANDLER] Cancelled Google Calendar event {iv['google_event_id']}")
                    except Exception as e:
                        print(f"[HANDLER] Calendar cancel failed: {e}")

            supabase.table("candidates").update({
                "stage": "shortlisted",
                "needs_manual_scheduling": True,
                "scheduling_notes": "Candidate dropped out during reminder call. Interview cancelled. HR to decide: reschedule or close.",
                "last_contact_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", self.candidate_id).execute()

            print(f"[HANDLER] Reminder: candidate DROPPED — interview cancelled, HR flagged")

        elif is_inconclusive:
            # ── OUTCOME: Call cut / inconclusive ─────────────────────
            if await self._should_auto_retry(delay_minutes=10):
                print(f"[HANDLER] Reminder: INCONCLUSIVE ({turns} turns) — auto-retrying in 10m")
            else:
                # Retry already failed — flag HR
                supabase.table("candidates").update({
                    "scheduling_notes": f"Reminder call failed twice ({turns} exchanges). Couldn't reach candidate. HR should verify attendance manually.",
                    "last_contact_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", self.candidate_id).execute()

                # Mark as reminded so scheduler doesn't keep trying
                supabase.table("interviews").update({
                    "candidate_reminded": True,
                }).eq("candidate_id", self.candidate_id).eq("status", "scheduled").execute()

                print(f"[HANDLER] Reminder: INCONCLUSIVE after retry — HR flagged")

        else:
            # ── OUTCOME: Candidate confirmed ─────────────────────────
            supabase.table("interviews").update({
                "candidate_reminded": True,
            }).eq("candidate_id", self.candidate_id).eq("status", "scheduled").execute()

            # Clear any stale scheduling notes
            supabase.table("candidates").update({
                "scheduling_notes": None,
                "last_contact_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", self.candidate_id).execute()

            print(f"[HANDLER] Reminder: candidate CONFIRMED attendance")

    async def _finalize_result_call(self):
        """Mark the interview result as communicated — but only if the
        conversation actually reached the result phase.

        If the call was too short (cut mid-conversation), flag it as
        inconclusive so the scheduler can retry or HR can handle manually.
        """
        supabase = db.get_supabase()
        turns = len(self.full_transcript)

        result = (
            supabase.table("interviews")
            .select("id, result")
            .eq("candidate_id", self.candidate_id)
            .eq("status", "completed")
            .order("scheduled_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return

        iv = result.data[0]

        if turns >= 4:
            # Conversation was long enough — result was likely delivered
            supabase.table("interviews").update({
                "result_communicated": True,
                "result_communicated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", iv["id"]).execute()
            print(f"[HANDLER] Result call: result COMMUNICATED ({turns} turns)")
        else:
            # Call was too short — result may not have been delivered
            if await self._should_auto_retry(delay_minutes=15):
                print(f"[HANDLER] Result call: INCONCLUSIVE ({turns} turns) — auto-retrying in 15m")
            else:
                supabase.table("candidates").update({
                    "scheduling_notes": f"Result call failed twice ({turns} exchanges). Candidate may not have heard the result. HR should follow up manually.",
                    "last_contact_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", self.candidate_id).execute()
                print(f"[HANDLER] Result call: INCONCLUSIVE after retry — HR flagged")

    async def _finalize_pre_joining_call(self, extracted: dict):
        """Handle pre-joining (Track A) and engagement (Track B) call outcomes.

        Updates the candidate's pre-joining status, engagement score, and
        flags HR if the candidate is dropping out or at risk.
        """
        supabase = db.get_supabase()
        update: dict = {
            "last_engagement_call_at": datetime.now(timezone.utc).isoformat(),
            "last_contact_at": datetime.now(timezone.utc).isoformat(),
        }

        candidate_dropped = extracted.get("candidate_dropped", False) if extracted else False
        at_risk = extracted.get("at_risk", False) if extracted else False
        engagement_score = extracted.get("engagement_score") if extracted else None
        notes = extracted.get("notes") or extracted.get("drop_reason") or ""

        if candidate_dropped:
            # Candidate dropped out — update stage + flag HR
            update["pre_joining_status"] = "dropped"
            update["stage"] = "withdrawn"
            update["scheduling_notes"] = f"Candidate dropped during pre-joining call. Reason: {notes or 'not specified'}"
            print(f"[HANDLER] Pre-joining: candidate DROPPED — {notes}")

        elif at_risk:
            update["pre_joining_status"] = "at_risk"
            update["scheduling_notes"] = f"Pre-joining check-in: candidate flagged as AT RISK. {notes}"
            print(f"[HANDLER] Pre-joining: candidate AT RISK")

        else:
            update["pre_joining_status"] = "confirmed"
            update["scheduling_notes"] = None  # Clear any old flags
            print(f"[HANDLER] Pre-joining: candidate CONFIRMED")

        if engagement_score is not None:
            try:
                update["engagement_score"] = int(engagement_score)
            except (ValueError, TypeError):
                pass

        if notes:
            update["engagement_notes"] = notes

        # Handle joining date change
        if extracted and extracted.get("joining_date_changed"):
            new_date = extracted.get("new_joining_date")
            if new_date:
                update["joining_date"] = new_date
                update["scheduling_notes"] = f"Joining date changed to {new_date} during pre-joining call."

        supabase.table("candidates").update(update).eq("id", self.candidate_id).execute()
