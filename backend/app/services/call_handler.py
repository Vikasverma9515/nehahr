"""Core call loop — low-latency version.

Key optimizations:
1. UtteranceEnd-based turn detection (no blind debounce)
2. Streaming TTS via Deepgram WebSocket (audio starts ~200ms after text sent)
3. Always forward audio to Deepgram STT (keeps connection alive)
"""

import json
import base64
import asyncio
from datetime import datetime, timezone

from fastapi import WebSocket

from app.services.transcription import LiveTranscriber
from app.services.tts_service import StreamingTTS
from app.services.ai_conversation import ConversationManager
from app.services import db
from app.services.call_outcome import CallOutcome


class CallHandler(CallOutcome):
    """Handles one live phone call end-to-end (Twilio Media Streams)."""

    def __init__(self, websocket: WebSocket, call_id: str, call_type: str, candidate_id: str):
        super().__init__(call_id, call_type, candidate_id)
        self.ws = websocket

        self.stream_sid: str | None = None
        self.twilio_call_sid: str | None = None
        self.transcriber: LiveTranscriber | None = None
        self.tts: StreamingTTS | None = None
        self.conversation: ConversationManager | None = None

        self.is_speaking = False
        self._responding = False
        self._ended = False

        # Buffer for accumulated final transcripts this turn.
        # Protected by lock to prevent race between _on_transcript and _on_utterance_end.
        self._utterance_buffer = ""
        self._buffer_lock = asyncio.Lock()

    # ── CallOutcome hooks ────────────────────────────────────────────────

    def _extracted(self) -> dict:
        return self.conversation.get_extracted_data() if self.conversation else {}

    def _ended_naturally(self) -> bool:
        return bool(self.conversation and self.conversation.should_end)

    async def _summary(self) -> str | None:
        if not self.conversation:
            return None
        # get_summary() uses sync httpx — run in thread to avoid blocking event loop
        return await asyncio.to_thread(self.conversation.get_summary)

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

        extracted = self._extracted()

        # Generate summary
        summary = None
        if self.full_transcript:
            try:
                summary = await self._summary()
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

