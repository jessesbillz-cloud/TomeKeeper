from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

LibraryStatus = Literal[
    "upcoming",
    "ordered",
    "shipped",
    "owned",
    "for_sale",
    "sold",
    "missed",
]


class LibraryEntryBase(BaseModel):
    edition_id: UUID
    status: LibraryStatus
    condition: str | None = None
    personal_photo_url: str | None = None
    purchase_price: Decimal | None = None
    sale_price: Decimal | None = None
    sale_notes: str | None = None
    buyer_info: str | None = None
    notes: str | None = None


class LibraryEntryCreate(LibraryEntryBase):
    """user_id is set server-side from the authenticated user."""


class LibraryEntryUpdate(BaseModel):
    status: LibraryStatus | None = None
    condition: str | None = None
    personal_photo_url: str | None = None
    purchase_price: Decimal | None = None
    sale_price: Decimal | None = None
    sale_notes: str | None = None
    buyer_info: str | None = None
    notes: str | None = None


class LibraryEntry(LibraryEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    status_changed_at: datetime
    created_at: datetime
    updated_at: datetime
