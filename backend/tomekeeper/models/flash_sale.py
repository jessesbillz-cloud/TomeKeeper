from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


class FlashSaleBase(BaseModel):
    shop: str
    title: str | None = None
    url: str | None = None
    edition_id: UUID | None = None
    starts_at: datetime
    ends_at: datetime
    notes: str | None = None

    @model_validator(mode="after")
    def _ends_after_starts(self) -> "FlashSaleBase":
        if self.ends_at < self.starts_at:
            raise ValueError("ends_at must be on or after starts_at")
        return self


class FlashSaleCreate(FlashSaleBase):
    """user_id is set server-side from the authenticated user."""


class FlashSaleUpdate(BaseModel):
    shop: str | None = None
    title: str | None = None
    url: str | None = None
    edition_id: UUID | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    notes: str | None = None


class FlashSale(FlashSaleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
