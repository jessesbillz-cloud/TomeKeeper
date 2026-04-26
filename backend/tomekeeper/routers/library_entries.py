from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..deps import CurrentUser, current_user, user_supabase
from ..models import LibraryEntry, LibraryEntryCreate, LibraryEntryUpdate
from ..models.library_entry import LibraryStatus
from ..services import library_entries as svc

router = APIRouter(prefix="/library", tags=["library"])


@router.get("", response_model=list[LibraryEntry])
def list_(
    status_filter: LibraryStatus | None = None,
    edition_id: UUID | None = None,
    limit: int = 200,
    offset: int = 0,
    client: Client = Depends(user_supabase),
):
    return svc.list_entries(
        client,
        status=status_filter,
        edition_id=edition_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{entry_id}", response_model=LibraryEntry)
def get(entry_id: UUID, client: Client = Depends(user_supabase)):
    try:
        return svc.get_entry(client, entry_id)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.post("", response_model=LibraryEntry, status_code=status.HTTP_201_CREATED)
def create(
    payload: LibraryEntryCreate,
    user: CurrentUser = Depends(current_user),
    client: Client = Depends(user_supabase),
):
    return svc.create_entry(client, payload, user_id=UUID(user.user_id))


@router.patch("/{entry_id}", response_model=LibraryEntry)
def update(
    entry_id: UUID,
    payload: LibraryEntryUpdate,
    client: Client = Depends(user_supabase),
):
    try:
        return svc.update_entry(client, entry_id, payload)
    except svc.NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(entry_id: UUID, client: Client = Depends(user_supabase)):
    svc.delete_entry(client, entry_id)
    return None
