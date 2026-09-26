"""Phone number normalization to E.164."""

import phonenumbers

from app.config import settings


def to_e164(raw: str, region: str | None = None) -> str:
    """Normalize a phone number to E.164 (+919876543210).

    Numbers without a country code are read in ``region`` (default
    DEFAULT_PHONE_REGION, "IN"). Raises ValueError if it isn't a valid number.
    """
    region = (region or settings.default_phone_region or "IN").upper()
    try:
        parsed = phonenumbers.parse(raw.strip(), region)
    except phonenumbers.NumberParseException as e:
        raise ValueError(f"Invalid phone number {raw!r}: {e}") from e
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError(f"Invalid phone number {raw!r}")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
