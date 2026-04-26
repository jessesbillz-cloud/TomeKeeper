"""Service for the shared `works` catalog."""

from __future__ import annotations

from uuid import UUID

from supabase import Client

from ..models import Work, WorkCreate, WorkUpdate

TABLE = "works"


class NotFoundError(Exception):
    pass


def list_works(client: Client, *, limit: int = 100, offset: int = 0) -> list[Work]:
    res = (
        client.table(TABLE)
        .select("*")
        .order("title")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [Work.model_validate(row) for row in (res.data or [])]


def get_work(client: Client, work_id: UUID) -> Work:
    res = client.table(TABLE).select("*").eq("id", str(work_id)).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"work {work_id} not found")
    return Work.model_validate(rows[0])


def create_work(client: Client, payload: WorkCreate) -> Work:
    res = client.table(TABLE).insert(payload.model_dump(mode="json")).execute()
    return Work.model_validate(res.data[0])


def update_work(client: Client, work_id: UUID, payload: WorkUpdate) -> Work:
    patch = payload.model_dump(mode="json", exclude_unset=True)
    if not patch:
        return get_work(client, work_id)
    res = client.table(TABLE).update(patch).eq("id", str(work_id)).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"work {work_id} not found")
    return Work.model_validate(rows[0])
