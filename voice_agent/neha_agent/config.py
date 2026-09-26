"""Settings for the voice agent worker (read from the environment / ../.env)."""

from pydantic_settings import BaseSettings


class AgentSettings(BaseSettings):
    # LiveKit (the worker also reads LIVEKIT_URL / _API_KEY / _API_SECRET itself)
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_agent_name: str = "neha"

    # Backend API (internal endpoints)
    backend_api_url: str = "http://localhost:8000"
    internal_api_key: str = ""

    # Models. Anthropic API is used when ANTHROPIC_API_KEY is set (lowest
    # latency); otherwise Claude on Bedrock with AWS_BEARER_TOKEN_BEDROCK.
    anthropic_api_key: str = ""
    aws_bearer_token_bedrock: str = ""
    aws_region: str = "us-east-1"
    llm_model: str = "claude-haiku-4-5"
    bedrock_llm_model: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

    deepgram_api_key: str = ""
    stt_model: str = "nova-3"
    # "multi" = Deepgram's code-switching model (English + Hindi + more).
    stt_language: str = "multi"

    # TTS: "cartesia" | "elevenlabs" | "deepgram"
    tts_provider: str = "cartesia"
    cartesia_api_key: str = ""
    cartesia_voice: str = ""          # voice id; empty = provider default
    elevenlabs_api_key: str = ""
    elevenlabs_voice: str = ""
    deepgram_tts_model: str = "aura-2-asteria-en"

    # Tavus face (video channels only)
    tavus_api_key: str = ""
    tavus_face_id: str = ""           # a.k.a. replica id
    tavus_pal_id: str = ""            # a.k.a. persona id (echo mode + LiveKit transport)

    # Phone
    hr_transfer_number: str = ""      # warm transfer target, E.164
    max_call_seconds: int = 900

    model_config = {"env_file": ("../.env", ".env"), "extra": "ignore"}


settings = AgentSettings()
