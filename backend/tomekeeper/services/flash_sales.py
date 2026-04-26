"""Service for `flash_sales` (per-user)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from supabase import Client

from ..models import FlashSale, FlashSaleCreate, FlashSaleUpdate

TABLE = "flash_sales"


class NotFoundError(Exception):
    pass


def list_flash_sales(
    client: Client,
    *,
    active_only: bool = False,
    shop: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[FlashSale]:
    q = client.table(TABLE).select("*")
    if active_only:
        now = datetime.utcnow().isoformat()
        q = q.lte("starts_at", now).gte("ends_at", now)
    if shop is not None:
        q = q.eq("shop", shop)
    res = q.order("starts_at").range(offset, offset + limit - 1).execute()
    return [FlashSale.model_validate(row) for row in (res.data or [])]


def get_flash_sale(client: Client, flash_sale_id: UUID) -> FlashSale:
    res = (
        client.table(TABLE)
        .select("*")
        .eq("id", str(flash_sale_id))
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"flash sale {flash_sale_id} not found")
    return FlashSale.model_validate(rows[0])


def create_flash_sale(
    client: Client, payload: FlashSaleCreate, *, user_id: UUID
) -> FlashSale:
    row = payload.model_dump(mode="json")
    row["user_id"] = str(user_id)
    res = client.table(TABLE).insert(row).execute()
    return FlashSale.model_validate(res.data[0])


def update_flash_sale(
    client: Client, flash_sale_id: UUID, payload: FlashSaleUpdate
) -> FlashSale:
    patch = payload.model_dump(mode="json", exclude_unset=True)
    if not patch:
        return get_flash_sale(client, flash_sale_id)
    res = (
        client.table(TABLE)
        .update(patch)
        .eq("id", str(flash_sale_id))
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"flash sale {flash_sale_id} not found")
    return FlashSale.model_validate(rows[0])


def delete_flash_sale(client: Client, flash_sale_id: UUID) -> None:
    client.table(TABLE).delete().eq("id", str(flash_sale_id)).execute()
