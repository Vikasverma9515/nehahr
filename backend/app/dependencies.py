"""Shared dependencies for FastAPI routes."""

from functools import lru_cache

from supabase import create_client, Client

from app.config import settings


@lru_cache
def get_supabase() -> Client:
    """Get Supabase client (singleton). Uses service key for full access."""
    return create_client(settings.supabase_url, settings.supabase_service_key)
