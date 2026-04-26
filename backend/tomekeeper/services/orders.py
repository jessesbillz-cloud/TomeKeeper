"""Service for `orders` (per-user)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from supabase import Client

from ..models import Order, OrderCreate, OrderUpdate

TABLE = "orders"


class NotFoundError(Exception):
    pass


def list_orders(
    client: Client,
    *,
    upcoming_only: bool = False,
    edition_id: UUID | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[Order]:
    q = client.table(TABLE).select("*")
    if upcoming_only:
        q = q.gte("ship_date", date.today().isoformat())
    if edition_id is not None:
        q = q.eq("edition_id", str(edition_id))
    res = q.order("ship_date").range(offset, offset + limit - 1).execute()
    return [Order.model_validate(row) for row in (res.data or [])]


def get_order(client: Client, order_id: UUID) -> Order:
    res = client.table(TABLE).select("*").eq("id", str(order_id)).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"order {order_id} not found")
    return Order.model_validate(rows[0])


def create_order(client: Client, payload: OrderCreate, *, user_id: UUID) -> Order:
    row = payload.model_dump(mode="json")
    row["user_id"] = str(user_id)
    res = client.table(TABLE).insert(row).execute()
    return Order.model_validate(res.data[0])


def update_order(client: Client, order_id: UUID, payload: OrderUpdate) -> Order:
    patch = payload.model_dump(mode="json", exclude_unset=True)
    if not patch:
        return get_order(client, order_id)
    res = client.table(TABLE).update(patch).eq("id", str(order_id)).execute()
    rows = res.data or []
    if not rows:
        raise NotFoundError(f"order {order_id} not found")
    return Order.model_validate(rows[0])


def delete_order(client: Client, order_id: UUID) -> None:
    client.table(TABLE).delete().eq("id", str(order_id)).execute()
