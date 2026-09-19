"""Deepgram real-time speech-to-text service.

Handles WebSocket connection to Deepgram for live transcription.
Uses UtteranceEnd events for accurate turn detection — only triggers
a response when the candidate genuinely finishes speaking.
"""

import json
import asyncio
from typing import Callable, Awaitable

from app.config import settings

DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"

# Params tuned for low-latency phone calls:
# - utterance_end_ms=1000: Deepgram requires >= 1000ms. 1s silence = turn complete.
# - endpointing=500: Tighter mid-sentence pause detection.
# - interim_results=true: Show early transcripts for debugging.
DEEPGRAM_PARAMS = {
    "model": "nova-2",
    "language": "en-IN",
    "smart_format": "true",
    "interim_results": "true",
    "utterance_end_ms": "1000",
    "vad_events": "true",
    "endpointing": "500",
    "encoding": "mulaw",
    "sample_rate": "8000",
    "channels": "1",
}


class LiveTranscriber:
    """Manages a real-time Deepgram WebSocket connection for one call."""

    def __init__(
        self,
        on_transcript: Callable[[str, bool], Awaitable[None]],
        on_utterance_end: Callable[[], Awaitable[None]],
    ):
        self.on_transcript = on_transcript
        self.on_utterance_end = on_utterance_end
        self._ws = None
        self._listen_task = None
        self._connected = False

    async def connect(self):
        """Open WebSocket to Deepgram with timeout."""
        import websockets

        params = "&".join(f"{k}={v}" for k, v in DEEPGRAM_PARAMS.items())
        url = f"{DEEPGRAM_WS_URL}?{params}"

        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(
                    url,
                    additional_headers={"Authorization": f"Token {settings.deepgram_api_key}"},
                ),
                timeout=10.0,
            )
            self._connected = True
            self._listen_task = asyncio.create_task(self._listen())
        except asyncio.TimeoutError:
            print("[STT] Deepgram connection timed out (10s)")
            raise
        except Exception as e:
            print(f"[STT] Deepgram connection failed: {e}")
            raise

    async def send_audio(self, audio_bytes: bytes):
        """Send raw audio bytes to Deepgram."""
        if self._ws and self._connected:
            try:
                await self._ws.send(audio_bytes)
            except Exception as e:
                if self._connected:
                    print(f"[STT] Send failed — connection lost: {e}")
                    self._connected = False

    async def close(self):
        """Close the Deepgram connection with timeout."""
        self._connected = False
        if self._ws:
            try:
                await asyncio.wait_for(self._ws.close(), timeout=5.0)
            except Exception:
                pass
        if self._listen_task:
            self._listen_task.cancel()

    async def _listen(self):
        """Listen for transcript results from Deepgram."""
        try:
            async for message in self._ws:
                data = json.loads(message)
                msg_type = data.get("type", "")

                if msg_type == "Results":
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if alternatives:
                        transcript = alternatives[0].get("transcript", "")
                        is_final = data.get("is_final", False)
                        if transcript.strip():
                            await self.on_transcript(transcript, is_final)

                elif msg_type == "UtteranceEnd":
                    await self.on_utterance_end()

        except Exception as e:
            if self._connected:
                print(f"[STT] Deepgram listen error — disconnected: {e}")
                self._connected = False
