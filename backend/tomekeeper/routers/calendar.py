from __future__ import annotations

from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, Query
from supabase import Client

from ..deps import user_supabase
from ..models.calendar_event import CalendarEvent
from ..services import calendar as svc

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarEvent])
def get_calendar(
    start: date_type | None = Query(None, description="Window start date (inclusive)"),
    end: date_type | None = Query(None, description="Window end date (inclusive)"),
    client: Client = Depends(user_supabase),
):
    """Aggregated calendar events. Defaults to a 90-day window starting today."""
    if start is None:
        start = date_type.today()
    if end is None:
        end = start + timedelta(days=90)
    return svc.get_calendar(client, start=start, end=end)
