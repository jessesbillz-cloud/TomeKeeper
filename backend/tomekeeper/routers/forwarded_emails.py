from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..deps import CurrentUser, current_user, user_supabase
from ..models import ForwardedEmail, ForwardedEmailCreate, ForwardedEmailUpdate
from ..services import forwarded_emails as svc

router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("", response_model=list[ForwardedEmail])
def list_(
    parsed: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    client: Client = Depends(user_supabase),
):
    return svc.list_emails(client, parsed=parsed, limit=limit, offset=offset)


@router.get("/{email_id}", response_model=ForwardedEmail)
def get(email_id: UUID, client: Client = Depends(user_supabase)):
    try:
        return svc.get_email(client, email_id)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post("", response_model=ForwardedEmail, status_code=status.HTTP_201_CREATED)
def create(
    payload: ForwardedEmailCreate,
    user: CurrentUser = Depends(current_user),
    client: Client = Depends(user_supabase),
):
    return svc.create_email(client, payload, user_id=UUID(user.user_id))


@router.patch("/{email_id}", response_model=ForwardedEmail)
def update(
    email_id: UUID,
    payload: ForwardedEmailUpdate,
    client: Client = Depends(user_supabase),
):
    try:
        return svc.update_email(client, email_id, payload)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
