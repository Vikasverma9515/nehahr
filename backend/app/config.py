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

    model_config = {"env_file": "../.env", "extra": "ignore"}


settings = Settings()
