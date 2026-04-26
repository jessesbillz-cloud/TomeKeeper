from __future__ import annotations

from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EditionBase(BaseModel):
    work_id: UUID
    edition_name: str
    publisher_or_shop: str | None = None
    retailer: str | None = None
    cover_url: str | None = None
    release_date: date | None = None
    release_time: time | None = None
    release_timezone: str | None = None
    edition_size: int | None = None
    special_features: str | None = None
    isbn: str | None = None
    preorder_start_at: datetime | None = None
    preorder_end_at: datetime | None = None


class EditionCreate(EditionBase):
    """submitted_by_user_id is set server-side from the authenticated user."""


class EditionUpdate(BaseModel):
    edition_name: str | None = None
    publisher_or_shop: str | None = None
    retailer: str | None = None
    cover_url: str | None = None
    release_date: date | None = None
    release_time: time | None = None
    release_timezone: str | None = None
    edition_size: int | None = None
    special_features: str | None = None
    isbn: str | None = None
    preorder_start_at: datetime | None = None
    preorder_end_at: datetime | None = None
    verified: bool | None = None


class Edition(EditionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    submitted_by_user_id: UUID | None
    verified: bool
    created_at: datetime
    updated_at: datetime
