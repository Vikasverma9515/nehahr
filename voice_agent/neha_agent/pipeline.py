"""Build the STT → LLM → TTS pipeline for one session.

Defaults are tuned for latency; the playground can override each piece per
session (``pipeline`` in the job metadata) to A/B providers:

    {"stt": "deepgram/nova-3", "llm": "claude-haiku-4-5", "tts": "cartesia" | "elevenlabs" | "deepgram"}
"""

from __future__ import annotations

import logging

from livekit.agents import inference
from livekit.plugins import anthropic, cartesia, deepgram, elevenlabs, silero

from .config import settings

log = logging.getLogger("neha.pipeline")


def _key(value: str) -> dict:
    """Pass an API key only when configured, so plugins fall back to their own env var."""
    return {"api_key": value} if value else {}


def build_stt(spec: str | None = None, *, phone: bool = False):
    model = (spec or "").split("/")[-1] or settings.stt_model
    return deepgram.STT(
        model=model,
        language=settings.stt_language,
        interim_results=True,
        smart_format=True,
        # The turn detector decides end of turn; keep STT endpointing short.
        endpointing_ms=25,
        keyterm=["Neha", "CTC", "LPA", "lakhs", "notice period"],
        **_key(settings.deepgram_api_key),
    )


def build_llm(spec: str | None = None):
    model = spec or settings.llm_model
    if settings.anthropic_api_key:
        return anthropic.LLM(
            model=model, api_key=settings.anthropic_api_key,
            temperature=0.4, max_tokens=300, caching="ephemeral",
        )
    # Claude on Bedrock with the same bearer token the backend uses.
    import anthropic as anthropic_sdk

    client = anthropic_sdk.AsyncAnthropicBedrock(
        api_key=settings.aws_bearer_token_bedrock or None,
        aws_region=settings.aws_region,
    )
    bedrock_model = settings.bedrock_llm_model if model == settings.llm_model else model
    # The plugin insists on an API key even when a client is supplied; it is unused.
    return _BedrockClaude(model=bedrock_model, client=client, api_key="bedrock",
                          temperature=0.4, max_tokens=300)


class _BedrockClaude(anthropic.LLM):
    async def _prewarm_impl(self) -> None:
        # Bedrock has no models.list; the first request warms the connection.
        return None


def build_tts(spec: str | None = None, language: str | None = None):
    """language: 'hi' / 'hinglish' switch to a Hindi-capable voice setup."""
    provider = (spec or settings.tts_provider).split("/")[0]
    hindi = language in ("hi", "hinglish")
    if provider == "elevenlabs":
        # Flash v2.5 is multilingual and handles Hindi and Hinglish.
        kwargs = {"model": "eleven_flash_v2_5", **_key(settings.elevenlabs_api_key)}
        if settings.elevenlabs_voice:
            kwargs["voice_id"] = settings.elevenlabs_voice
        return elevenlabs.TTS(**kwargs)
    if provider == "deepgram" and not hindi:
        return deepgram.TTS(model=settings.deepgram_tts_model, **_key(settings.deepgram_api_key))
    # Deepgram Aura has no Hindi voice, so Hindi calls use Cartesia (multilingual).
    kwargs = {"model": "sonic-3", "language": "hi" if hindi else "en", **_key(settings.cartesia_api_key)}
    if hindi:
        kwargs["word_timestamps"] = False   # Sonic only has word timings for en, de, es, fr
    if settings.cartesia_voice:
        kwargs["voice"] = settings.cartesia_voice
    return cartesia.TTS(**kwargs)


def build_vad():
    # Load once per worker process (see main.prewarm) and reuse.
    return silero.VAD.load(min_silence_duration=0.25, activation_threshold=0.5)


def turn_handling() -> dict:
    """Semantic end-of-turn + barge-in with false-interruption recovery."""
    return {
        "turn_detection": inference.TurnDetector(),
        "endpointing": {"min_delay": 0.3, "max_delay": 2.5},
        "interruption": {
            "enabled": True,
            "min_duration": 0.4,
            "min_words": 1,
            # A cough or "mm-hm" shouldn't kill Neha's sentence: resume it.
            "resume_false_interruption": True,
            "false_interruption_timeout": 1.0,
        },
        # Start thinking on the interim transcript; drop it if the user keeps talking.
        "preemptive_generation": {"enabled": True},
    }


def describe(stt_spec: str | None, llm_spec: str | None, tts_spec: str | None) -> dict:
    """What actually ran, saved on the call row."""
    return {
        "stt": f"deepgram/{(stt_spec or '').split('/')[-1] or settings.stt_model}",
        "llm": ("anthropic/" if settings.anthropic_api_key else "bedrock/") + (llm_spec or settings.llm_model),
        "tts": (tts_spec or settings.tts_provider),
        "turn_detector": "livekit/turn-detector",
    }
