"""One-shot script to create Janelle's auth user and promote her to admin.

Run once after the schema is in place:
    python scripts/bootstrap_janelle.py

Reads JANELLE_EMAIL and JANELLE_PASSWORD from .env. Uses the service-role key
to (a) create the auth user, which fires handle_new_user() and provisions her
user_profiles row, then (b) sets her role to 'admin'.

Idempotent: if the auth user already exists, only the role promotion runs.
"""

from __future__ import annotations

import sys

from tomekeeper.config import get_settings
from tomekeeper.supabase_client import get_service_client


def main() -> int:
    settings = get_settings()
    email = (
        __import__("os").environ.get("JANELLE_EMAIL")
        or input("Janelle's email: ").strip()
    )
    password = (
        __import__("os").environ.get("JANELLE_PASSWORD")
        or input("Janelle's password (won't be stored): ").strip()
    )

    if not email or not password:
        print("Email and password are required.", file=sys.stderr)
        return 1

    if not settings.supabase_service_role_key:
        print(
            "SUPABASE_SERVICE_ROLE_KEY is not set. Pull it from the Supabase "
            "dashboard (Settings -> API) and put it in .env.",
            file=sys.stderr,
        )
        return 1

    client = get_service_client()

    # 1. Create the auth user (or find existing).
    try:
        created = client.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
            }
        )
        user_id = created.user.id
        print(f"Created auth user {user_id} for {email}")
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if "already" in msg or "registered" in msg or "exists" in msg:
            # Look up the existing user.
            users = client.auth.admin.list_users()
            match = next((u for u in users if u.email == email), None)
            if not match:
                print(f"User exists but could not be located: {exc}", file=sys.stderr)
                return 1
            user_id = match.id
            print(f"Auth user already exists ({user_id}), skipping create.")
        else:
            print(f"Failed to create user: {exc}", file=sys.stderr)
            return 1

    # 2. Promote to admin in user_profiles.
    res = (
        client.table("user_profiles")
        .update({"role": "admin"})
        .eq("user_id", user_id)
        .execute()
    )
    if res.data:
        print(f"Promoted {email} to admin.")
    else:
        print(
            "user_profiles row not found. Did handle_new_user() run? "
            "If not, the trigger or the schema is missing.",
            file=sys.stderr,
        )
        return 1

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
