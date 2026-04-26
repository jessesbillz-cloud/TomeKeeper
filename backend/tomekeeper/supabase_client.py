"""Supabase client factories.

Three flavors:
- get_anon_client()    : anon-key client, no user context. Subject to RLS as anon role.
- get_service_client() : service-role client. BYPASSES RLS. Use only for webhooks,
                         admin scripts, and operations that legitimately need to act
                         across users (e.g. parsing a forwarded email and writing to
                         the owning user's row).
- get_user_client(jwt) : anon-key client with the user's JWT attached. RLS enforced
                         as the authenticated user. This is the default for any
                         request originating from the React PWA.
"""

from __future__ import annotations

from supabase import Client, create_client

from .config import get_settings


def get_anon_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_service_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_client(jwt: str) -> Client:
    """Build a client that calls the database as the JWT's user.

    The JWT must already be validated upstream (see tomekeeper.deps.current_user).
    """
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(jwt)
    return client
