from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrderBase(BaseModel):
    edition_id: UUID | None = None
    library_entry_id: UUID | None = None
    vendor: str | None = None
    order_date: date | None = None
    ship_date: date | None = None
    delivery_date: date | None = None
    tracking_number: str | None = None
    receipt_photo_url: str | None = None
    raw_email_id: UUID | None = None
    parse_confidence: Decimal | None = None


class OrderCreate(OrderBase):
    """user_id is set server-side from the authenticated user."""


class OrderUpdate(BaseModel):
    edition_id: UUID | None = None
    library_entry_id: UUID | None = None
    vendor: str | None = None
    order_date: date | None = None
    ship_date: date | None = None
    delivery_date: date | None = None
    tracking_number: str | None = None
    receipt_photo_url: str | None = None
    raw_email_id: UUID | None = None
    parse_confidence: Decimal | None = None


class Order(OrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
