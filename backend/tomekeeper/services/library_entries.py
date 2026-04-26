"""Service for `library_entries` (per-user)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from supabase import Client

from ..models import LibraryEntry, LibraryEntryCreate, LibraryEntryUpdate
from ..models.library_entry import LibraryStatus

TABLE = "library_entries"


class NotFoundError(Exception):
    pass


def list_entries(
    client: Client,
    *,
    status: LibraryStatus | None = None,
    edition_id: UUID | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[LibraryEntry]:
    q = client.table(TABLE).select("*")
    if status is not None:
        q = q.eq("status", status)
    if edition_id is not None:
        q = q.eq("edition_id", str(edition_id))
    res = (
        q.order("status_changed_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [LibraryEntry.model_validate(row) for row in (res.data or [])]


def get_entry(client: Client, entry_id: UUID) -> LibraryEntry:
    res = client.table(TABLE).select("*").eq("id", str(entry_id)).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"library_entry {entry_id} not found")
    return LibraryEntry.model_validate(rows[0])


def create_entry(
    client: Client, payload: LibraryEntryCreate, *, user_id: UUID
) -> LibraryEntry:
    row = payload.model_dump(mode="json")
    row["user_id"] = str(user_id)
    res = client.table(TABLE).insert(row).execute()
    return LibraryEntry.model_validate(res.data[0])


def update_entry(
    client: Client, entry_id: UUID, payload: LibraryEntryUpdate
) -> LibraryEntry:
    patch = payload.model_dump(mode="json", exclude_unset=True)
    if not patch:
        return get_entry(client, entry_id)
    # If status is changing, bump status_changed_at server-side.
    if "status" in patch:
        patch["status_changed_at"] = datetime.now(timezone.utc).isoformat()
    res = client.table(TABLE).update(patch).eq("id", str(entry_id)).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"library_entry {entry_id} not found")
    return LibraryEntry.model_validate(rows[0])


def delete_entry(client: Client, entry_id: UUID) -> None:
    client.table(TABLE).delete().eq("id", str(entry_id)).execute()
