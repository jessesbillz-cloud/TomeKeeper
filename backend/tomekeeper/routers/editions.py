from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..deps import CurrentUser, current_user, user_supabase
from ..models import Edition, EditionCreate, EditionUpdate
from ..services import editions as svc

router = APIRouter(prefix="/editions", tags=["editions"])


@router.get("", response_model=list[Edition])
def list_(
    work_id: UUID | None = None,
    isbn: str | None = None,
    limit: int = 100,
    offset: int = 0,
    client: Client = Depends(user_supabase),
):
    return svc.list_editions(
        client, work_id=work_id, isbn=isbn, limit=limit, offset=offset
    )


@router.get("/{edition_id}", response_model=Edition)
def get(edition_id: UUID, client: Client = Depends(user_supabase)):
    try:
        return svc.get_edition(client, edition_id)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post("", response_model=Edition, status_code=status.HTTP_201_CREATED)
def create(
    payload: EditionCreate,
    user: CurrentUser = Depends(current_user),
    client: Client = Depends(user_supabase),
):
    return svc.create_edition(client, payload, user_id=UUID(user.user_id))


@router.patch("/{edition_id}", response_model=Edition)
def update(
    edition_id: UUID, payload: EditionUpdate, client: Client = Depends(user_supabase)
):
    try:
        return svc.update_edition(client, edition_id, payload)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
