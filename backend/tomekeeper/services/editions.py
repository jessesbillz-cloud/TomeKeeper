"""Service for the shared `editions` catalog."""

from __future__ import annotations

from uuid import UUID

from supabase import Client

from ..models import Edition, EditionCreate, EditionUpdate

TABLE = "editions"


class NotFoundError(Exception):
    pass


def list_editions(
    client: Client,
    *,
    work_id: UUID | None = None,
    isbn: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Edition]:
    q = client.table(TABLE).select("*")
    if work_id is not None:
        q = q.eq("work_id", str(work_id))
    if isbn is not None:
        q = q.eq("isbn", isbn)
    res = q.order("release_date", desc=True).range(offset, offset + limit - 1).execute()
    return [Edition.model_validate(row) for row in (res.data or [])]


def get_edition(client: Client, edition_id: UUID) -> Edition:
    res = client.table(TABLE).select("*").eq("id", str(edition_id)).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"edition {edition_id} not found")
    return Edition.model_validate(rows[0])


def create_edition(client: Client, payload: EditionCreate, *, user_id: UUID) -> Edition:
    """Insert a new edition, stamping submitted_by_user_id with the caller.

    RLS will reject if `submitted_by_user_id != auth.uid()`, but stamping it
    here means the API can never accidentally let one user submit on another's
    behalf.
    """
    row = payload.model_dump(mode="json")
    row["submitted_by_user_id"] = str(user_id)
    res = client.table(TABLE).insert(row).execute()
    return Edition.model_validate(res.data[0])


def update_edition(client: Client, edition_id: UUID, payload: EditionUpdate) -> Edition:
    patch = payload.model_dump(mode="json", exclude_unset=True)
    if not patch:
        return get_edition(client, edition_id)
    res = client.table(TABLE).update(patch).eq("id", str(edition_id)).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"edition {edition_id} not found")
    return Edition.model_validate(rows[0])
