from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ForwardedEmailBase(BaseModel):
    sender: str | None = None
    subject: str | None = None
    raw_body: str | None = None


class ForwardedEmailCreate(ForwardedEmailBase):
    """user_id is set server-side (from JWT for user-initiated submissions, or
    looked up from the recipient address for the Relay webhook path)."""


class ForwardedEmailUpdate(BaseModel):
    parsed: bool | None = None
    parse_attempted_at: datetime | None = None
    parse_confidence: Decimal | None = None
    parse_result: dict[str, Any] | None = None


class ForwardedEmail(ForwardedEmailBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    received_at: datetime
    parsed: bool
    parse_attempted_at: datetime | None
    parse_confidence: Decimal | None
    parse_result: dict[str, Any] | None
