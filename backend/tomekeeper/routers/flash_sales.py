from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..deps import CurrentUser, current_user, user_supabase
from ..models import FlashSale, FlashSaleCreate, FlashSaleUpdate
from ..services import flash_sales as svc

router = APIRouter(prefix="/flash-sales", tags=["flash_sales"])


@router.get("", response_model=list[FlashSale])
def list_(
    active_only: bool = False,
    shop: str | None = None,
    limit: int = 200,
    offset: int = 0,
    client: Client = Depends(user_supabase),
):
    return svc.list_flash_sales(
        client, active_only=active_only, shop=shop, limit=limit, offset=offset
    )


@router.get("/{flash_sale_id}", response_model=FlashSale)
def get(flash_sale_id: UUID, client: Client = Depends(user_supabase)):
    try:
        return svc.get_flash_sale(client, flash_sale_id)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post("", response_model=FlashSale, status_code=status.HTTP_201_CREATED)
def create(
    payload: FlashSaleCreate,
    user: CurrentUser = Depends(current_user),
    client: Client = Depends(user_supabase),
):
    return svc.create_flash_sale(client, payload, user_id=UUID(user.user_id))


@router.patch("/{flash_sale_id}", response_model=FlashSale)
def update(
    flash_sale_id: UUID,
    payload: FlashSaleUpdate,
    client: Client = Depends(user_supabase),
):
    try:
        return svc.update_flash_sale(client, flash_sale_id, payload)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.delete("/{flash_sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(flash_sale_id: UUID, client: Client = Depends(user_supabase)):
    svc.delete_flash_sale(client, flash_sale_id)
    return None
