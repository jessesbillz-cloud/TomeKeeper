from __future__ import annotations

from datetime import date as date_type, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

CalendarEventType = Literal[
    "release",
    "ship",
    "deliver",
    "preorder_open",
    "preorder_close",
    "flash_sale",
]


class CalendarEvent(BaseModel):
    """A single event on the calendar grid.

    `date` is the local-day key the UI uses to bucket the event onto the grid.
    `at` is the precise instant when the event happens (if known) so the UI
    can show "Tue 8:00 PM PT". Drop-style events (release/preorder open/close)
    set `at`; ship/deliver/flash_sale (which span a day or longer) usually
    leave it null.

    For range-style events (flash sales), `starts_at` and `ends_at` carry the
    full window so the day-detail card on the home calendar can render the
    same `start → end · url · notes` layout the Flash Sales list page uses.
    For point events these stay null.

    `shop` carries the publisher_or_shop / vendor / flash-sale shop string so
    the frontend can color-code and filter by website. The frontend hashes
    this string to a stable color.
    """

    date: date_type
    type: CalendarEventType
    title: str
    subtitle: str | None = None
    shop: str | None = None
    at: datetime | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    url: str | None = None
    notes: str | None = None
    edition_id: UUID | None = None
    library_entry_id: UUID | None = None
    order_id: UUID | None = None
    flash_sale_id: UUID | None = None
