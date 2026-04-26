"""Service for `forwarded_emails` (per-user)."""

from __future__ import annotations

from uuid import UUID

from supabase import Client

from ..models import ForwardedEmail, ForwardedEmailCreate, ForwardedEmailUpdate

TABLE = "forwarded_emails"


class NotFoundError(Exception):
    pass


def list_emails(
    client: Client,
    *,
    parsed: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ForwardedEmail]:
    q = client.table(TABLE).select("*")
    if parsed is not None:
        q = q.eq("parsed", parsed)
    res = q.order("received_at", desc=True).range(offset, offset + limit - 1).execute()
    return [ForwardedEmail.model_validate(row) for row in (res.data or [])]


def get_email(client: Client, email_id: UUID) -> ForwardedEmail:
    res = client.table(TABLE).select("*").eq("id", str(email_id)).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"forwarded_email {email_id} not found")
    return ForwardedEmail.model_validate(rows[0])


def create_email(
    client: Client, payload: ForwardedEmailCreate, *, user_id: UUID
) -> ForwardedEmail:
    """Used by the user-initiated path. The Relay webhook should use the
    service-role client and pass user_id resolved from the recipient address.
    """
    row = payload.model_dump(mode="json")
    row["user_id"] = str(user_id)
    res = client.table(TABLE).insert(row).execute()
    return ForwardedEmail.model_validate(res.data[0])


def update_email(
    client: Client, email_id: UUID, payload: ForwardedEmailUpdate
) -> ForwardedEmail:
    patch = payload.model_dump(mode="json", exclude_unset=True)
    if not patch:
        return get_email(client, email_id)
    res = client.table(TABLE).update(patch).eq("id", str(email_id)).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"forwarded_email {email_id} not found")
    return ForwardedEmail.model_validate(rows[0])
