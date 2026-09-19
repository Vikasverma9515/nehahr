"""Deepgram WebSocket streaming TTS service.

Uses Deepgram's WebSocket TTS API to stream audio chunks as they're
generated, rather than waiting for the full audio file. This reduces
time-to-first-byte from ~500-1000ms to ~150-300ms.
"""

import json
import asyncio
from typing import Callable, Awaitable

from app.config import settings

# Deepgram WebSocket TTS endpoint
DEEPGRAM_TTS_WS_URL = (
    "wss://api.deepgram.com/v1/speak"
    "?model=aura-asteria-en"
    "&encoding=mulaw"
    "&sample_rate=8000"
    "&container=none"
)


class StreamingTTS:
    """Streaming TTS via Deepgram WebSocket."""

    def __init__(self, on_audio_chunk: Callable[[bytes], Awaitable[None]]):
        self.on_audio_chunk = on_audio_chunk
        self._ws = None
        self._listen_task = None
        self._connected = False
        self._flushed = asyncio.Event()

    async def connect(self):
        """Open persistent WebSocket to Deepgram TTS with timeout."""
        import websockets

        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(
                    DEEPGRAM_TTS_WS_URL,
                    additional_headers={"Authorization": f"Token {settings.deepgram_api_key}"},
                ),
                timeout=10.0,
            )
            self._connected = True
            self._listen_task = asyncio.create_task(self._listen())
        except asyncio.TimeoutError:
            print("[TTS] Deepgram TTS connection timed out (10s)")
            raise
        except Exception as e:
            print(f"[TTS] Deepgram TTS connection failed: {e}")
            raise

    async def speak(self, text: str):
        """Send text to be synthesized and streamed back as audio."""
        if not self._ws or not self._connected:
            return

        self._flushed.clear()
        try:
            await self._ws.send(json.dumps({"type": "Speak", "text": text}))
            await self._ws.send(json.dumps({"type": "Flush"}))
        except Exception as e:
            if self._connected:
                print(f"[TTS] speak error — connection lost: {e}")
                self._connected = False

    async def wait_for_flush(self, timeout: float = 15.0):
        """Wait until Deepgram signals it finished generating audio for the last Flush.

        Returns True if flushed, False if timed out.
        """
        try:
            await asyncio.wait_for(self._flushed.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def close(self):
        """Close the TTS WebSocket with timeout."""
        self._connected = False
        if self._ws:
            try:
                await asyncio.wait_for(self._ws.close(), timeout=5.0)
            except Exception:
                pass
        if self._listen_task:
            self._listen_task.cancel()

    async def _listen(self):
        """Listen for audio chunks and control messages from Deepgram."""
        try:
            async for message in self._ws:
                if isinstance(message, bytes):
                    # Binary audio chunk — forward immediately
                    await self.on_audio_chunk(message)
                else:
                    try:
                        data = json.loads(message)
                        msg_type = data.get("type", "")
                        if msg_type == "Flushed":
                            self._flushed.set()
                    except Exception:
                        pass
        except Exception as e:
            if self._connected:
                print(f"[TTS] Deepgram TTS listen error — disconnected: {e}")
                self._connected = False
