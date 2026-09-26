from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # Deepgram (STT + TTS)
    deepgram_api_key: str = ""

    # Claude via AWS Bedrock — single bearer token
    aws_bearer_token_bedrock: str = ""

    # Google Calendar OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # App
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # HR branding — used as the sender display for booking confirmation
    # emails so the candidate sees "Recruiting Team" instead of
    # the interviewer's personal Gmail address.
    hr_sender_name: str = "Recruiting Team"
    hr_reply_to: str = ""  # optional: reply-to for booking emails (e.g. recruiting@example.com)
    hr_company_name: str = "Our Company"

    # LiveKit (voice agent runtime)
    livekit_url: str = ""            # wss://<project>.livekit.cloud
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_agent_name: str = "neha"
    # Outbound SIP trunk created in LiveKit (Twilio Elastic SIP behind it).
    livekit_sip_trunk_id: str = ""
    # Which runtime places phone calls: "twilio" (legacy Media Streams loop)
    # or "livekit" (the voice agent in voice_agent/).
    voice_runtime: str = "twilio"

    # Room recordings (LiveKit Egress → S3-compatible storage). Optional.
    egress_s3_bucket: str = ""
    egress_s3_region: str = ""
    egress_s3_access_key: str = ""
    egress_s3_secret: str = ""
    egress_s3_endpoint: str = ""        # set for R2 / Supabase Storage / MinIO
    egress_public_base_url: str = ""    # e.g. https://<bucket>.r2.dev

    # Security
    # SUPABASE_JWT_SECRET: only for projects on the legacy HS256 secret; newer
    # projects are verified against the project's JWKS automatically.
    supabase_jwt_secret: str = ""
    # Shared with the dashboard; signs browser links (recordings, OAuth start).
    app_secret: str = ""
    # Our own workers (voice agent, Meet bot) send this as X-Internal-Key.
    internal_api_key: str = ""
    # Dev only: accept every request without a session. Never in production.
    disable_auth: bool = False
    # Dev only: skip Twilio signature checks (e.g. behind a rewriting tunnel).
    skip_twilio_signature: bool = False

    # Country used for phone numbers entered without a +country code.
    default_phone_region: str = "IN"

    # Error reporting (optional)
    sentry_dsn: str = ""
    log_level: str = "INFO"

    # Run the background-task worker inside the web process.
    run_queue_worker: bool = True

    model_config = {"env_file": "../.env", "extra": "ignore"}


settings = Settings()
