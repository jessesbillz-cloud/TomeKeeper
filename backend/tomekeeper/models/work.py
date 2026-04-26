from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WorkBase(BaseModel):
    title: str
    author: str | None = None
    series: str | None = None
    series_number: int | None = None
    base_description: str | None = None
    original_pub_year: int | None = None


class WorkCreate(WorkBase):
    pass


class WorkUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    series: str | None = None
    series_number: int | None = None
    base_description: str | None = None
    original_pub_year: int | None = None


class Work(WorkBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
