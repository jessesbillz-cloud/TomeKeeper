from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..deps import user_supabase
from ..models import Work, WorkCreate, WorkUpdate
from ..services import works as svc

router = APIRouter(prefix="/works", tags=["works"])


@router.get("", response_model=list[Work])
def list_(limit: int = 100, offset: int = 0, client: Client = Depends(user_supabase)):
    return svc.list_works(client, limit=limit, offset=offset)


@router.get("/{work_id}", response_model=Work)
def get(work_id: UUID, client: Client = Depends(user_supabase)):
    try:
        return svc.get_work(client, work_id)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post("", response_model=Work, status_code=status.HTTP_201_CREATED)
def create(payload: WorkCreate, client: Client = Depends(user_supabase)):
    return svc.create_work(client, payload)


@router.patch("/{work_id}", response_model=Work)
def update(work_id: UUID, payload: WorkUpdate, client: Client = Depends(user_supabase)):
    try:
        return svc.update_work(client, work_id, payload)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
