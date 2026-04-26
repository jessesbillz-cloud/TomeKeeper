from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..deps import CurrentUser, current_user, user_supabase
from ..models import Order, OrderCreate, OrderUpdate
from ..services import orders as svc

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[Order])
def list_(
    upcoming_only: bool = False,
    edition_id: UUID | None = None,
    limit: int = 200,
    offset: int = 0,
    client: Client = Depends(user_supabase),
):
    return svc.list_orders(
        client,
        upcoming_only=upcoming_only,
        edition_id=edition_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{order_id}", response_model=Order)
def get(order_id: UUID, client: Client = Depends(user_supabase)):
    try:
        return svc.get_order(client, order_id)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post("", response_model=Order, status_code=status.HTTP_201_CREATED)
def create(
    payload: OrderCreate,
    user: CurrentUser = Depends(current_user),
    client: Client = Depends(user_supabase),
):
    return svc.create_order(client, payload, user_id=UUID(user.user_id))


@router.patch("/{order_id}", response_model=Order)
def update(
    order_id: UUID, payload: OrderUpdate, client: Client = Depends(user_supabase)
):
    try:
        return svc.update_order(client, order_id, payload)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(order_id: UUID, client: Client = Depends(user_supabase)):
    svc.delete_order(client, order_id)
    return None
