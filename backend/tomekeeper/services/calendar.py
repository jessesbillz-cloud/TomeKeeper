"""Calendar service.

Aggregates events into a single time-ordered feed:
  - release       : edition.release_date for upcoming library entries
  - preorder_open : edition.preorder_start_at  (drop-style, has `at`)
  - preorder_close: edition.preorder_end_at    (drop-style, has `at`)
  - flash_sale    : one per active day in a flash_sales row's window
  - ship          : orders.ship_date
  - deliver       : orders.delivery_date

Every event also carries `shop` (publisher_or_shop / vendor / flash-sale shop)
so the frontend can color-code and filter by website.

Uses PostgREST resource embedding to fetch related rows in one round trip.
RLS on every base table still applies via the user-scoped client.
"""

from __future__ import annotations

from datetime import date as date_type, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from supabase import Client

from ..models.calendar_event import CalendarEvent

# Default IANA timezone used when the client doesn't pass `?tz=...`.
# Janelle is on Pacific time, so an event recorded at 7pm PDT lands on
# the calendar day she actually picked, not the next UTC day.
DEFAULT_TZ = "America/Los_Angeles"


def _resolve_zone(tz: str | None) -> ZoneInfo:
    name = tz or DEFAULT_TZ
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo(DEFAULT_TZ)


def _safe_date(value: str | None) -> date_type | None:
    if not value:
        return None
    try:
        return date_type.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _safe_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # PostgREST returns RFC3339 with 'Z' or '+00:00'; fromisoformat handles
        # both on Python 3.11+.
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _local_date(dt: datetime, zone: ZoneInfo) -> date_type:
    """Pick the calendar bucket for a timestamp, in the user's local TZ.

    PostgREST returns RFC3339 timestamps with a UTC offset; we convert to
    the requested zone (Pacific by default) before extracting the date so
    that a 7pm PDT event lands on the same calendar day Janelle picked,
    not the next UTC day.
    """
    if dt.tzinfo is None:
        # PostgREST always returns aware timestamps; defensively treat
        # any naive datetime as UTC rather than raising.
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(zone).date()


def get_calendar(
    client: Client,
    *,
    start: date_type,
    end: date_type,
    tz: str | None = None,
) -> list[CalendarEvent]:
    zone = _resolve_zone(tz)
    events: list[CalendarEvent] = []

    # --- 1. Releases (from upcoming library entries) ------------------------
    res = (
        client.table("library_entries")
        .select(
            "id, status, edition_id, "
            "editions(id, edition_name, release_date, publisher_or_shop, "
            "retailer, work_id, works(title, author))"
        )
        .eq("status", "upcoming")
        .execute()
    )
    for row in res.data or []:
        ed = row.get("editions") or {}
        rd = _safe_date(ed.get("release_date"))
        if rd is None or rd < start or rd > end:
            continue
        work = ed.get("works") or {}
        title = work.get("title") or ed.get("edition_name") or "Untitled"
        events.append(
            CalendarEvent(
                date=rd,
                type="release",
                title=title,
                subtitle=ed.get("edition_name"),
                shop=ed.get("publisher_or_shop") or ed.get("retailer"),
                edition_id=ed.get("id"),
                library_entry_id=row["id"],
            )
        )

    # --- 2. Preorder windows (open + close) ---------------------------------
    # We pull every edition with a preorder window that overlaps [start, end]
    # at all, then emit at most two events per edition (open / close), each
    # gated to the window. Editions that have neither timestamp set are
    # skipped by Postgres because both filters are OR'd via .or_().
    #
    # The SQL prefilter is widened by one day on each side so a timestamp
    # that lives in UTC just outside the window but maps to a local-TZ day
    # inside the window (e.g. 2026-07-01T03:00Z = 2026-06-30 20:00 PDT)
    # still gets picked up. The local-date check below clamps it back.
    start_dt = datetime.combine(start - timedelta(days=1), datetime.min.time())
    end_dt = datetime.combine(end + timedelta(days=1), datetime.max.time())

    res_pre = (
        client.table("editions")
        .select(
            "id, edition_name, publisher_or_shop, retailer, "
            "preorder_start_at, preorder_end_at, work_id, "
            "works(title, author)"
        )
        .or_(
            f"and(preorder_start_at.gte.{start_dt.isoformat()},"
            f"preorder_start_at.lte.{end_dt.isoformat()}),"
            f"and(preorder_end_at.gte.{start_dt.isoformat()},"
            f"preorder_end_at.lte.{end_dt.isoformat()})"
        )
        .execute()
    )
    for row in res_pre.data or []:
        work = row.get("works") or {}
        title = work.get("title") or row.get("edition_name") or "Preorder"
        shop = row.get("publisher_or_shop") or row.get("retailer")

        po_start = _safe_dt(row.get("preorder_start_at"))
        if po_start is not None:
            d = _local_date(po_start, zone)
            if start <= d <= end:
                events.append(
                    CalendarEvent(
                        date=d,
                        type="preorder_open",
                        title=title,
                        subtitle=row.get("edition_name"),
                        shop=shop,
                        at=po_start,
                        edition_id=row.get("id"),
                    )
                )

        po_end = _safe_dt(row.get("preorder_end_at"))
        if po_end is not None:
            d = _local_date(po_end, zone)
            if start <= d <= end:
                events.append(
                    CalendarEvent(
                        date=d,
                        type="preorder_close",
                        title=title,
                        subtitle=row.get("edition_name"),
                        shop=shop,
                        at=po_end,
                        edition_id=row.get("id"),
                    )
                )

    # --- 3. Flash sales: one event per active day ---------------------------
    # We want every day a flash sale is live to light up on the grid, so we
    # expand the [starts_at, ends_at] window into per-day events clipped to
    # the requested calendar window.
    res_fs = (
        client.table("flash_sales")
        .select("id, shop, title, url, starts_at, ends_at, edition_id, notes")
        .lte("starts_at", end_dt.isoformat())
        .gte("ends_at", start_dt.isoformat())
        .execute()
    )
    for row in res_fs.data or []:
        s = _safe_dt(row.get("starts_at"))
        e = _safe_dt(row.get("ends_at"))
        if s is None or e is None:
            continue
        s_local = _local_date(s, zone)
        e_local = _local_date(e, zone)
        day = max(s_local, start)
        last = min(e_local, end)
        title = row.get("title") or f"Flash sale ({row.get('shop')})"
        while day <= last:
            events.append(
                CalendarEvent(
                    date=day,
                    type="flash_sale",
                    title=title,
                    shop=row.get("shop"),
                    # Carry `at` only on the first day so the UI can show
                    # the precise opening time without repeating it.
                    at=s if day == s_local else None,
                    # Carry the full window + url + notes on every day of
                    # the sale so the day-detail card on Home can render
                    # the same row layout the Flash Sales list uses.
                    starts_at=s,
                    ends_at=e,
                    url=row.get("url"),
                    notes=row.get("notes"),
                    edition_id=row.get("edition_id"),
                    flash_sale_id=row.get("id"),
                )
            )
            day += timedelta(days=1)

    # --- 4. Ships ------------------------------------------------------------
    res2 = (
        client.table("orders")
        .select(
            "id, ship_date, vendor, edition_id, "
            "editions(id, edition_name, publisher_or_shop, retailer, "
            "work_id, works(title))"
        )
        .gte("ship_date", start.isoformat())
        .lte("ship_date", end.isoformat())
        .execute()
    )
    for row in res2.data or []:
        sd = _safe_date(row.get("ship_date"))
        if sd is None:
            continue
        ed = row.get("editions") or {}
        work = ed.get("works") or {}
        title = work.get("title") or row.get("vendor") or "Order"
        events.append(
            CalendarEvent(
                date=sd,
                type="ship",
                title=title,
                subtitle=row.get("vendor"),
                shop=row.get("vendor")
                or ed.get("publisher_or_shop")
                or ed.get("retailer"),
                edition_id=ed.get("id"),
                order_id=row["id"],
            )
        )

    # --- 5. Deliveries -------------------------------------------------------
    res3 = (
        client.table("orders")
        .select(
            "id, delivery_date, vendor, edition_id, "
            "editions(id, edition_name, publisher_or_shop, retailer, "
            "work_id, works(title))"
        )
        .gte("delivery_date", start.isoformat())
        .lte("delivery_date", end.isoformat())
        .execute()
    )
    for row in res3.data or []:
        dd = _safe_date(row.get("delivery_date"))
        if dd is None:
            continue
        ed = row.get("editions") or {}
        work = ed.get("works") or {}
        title = work.get("title") or row.get("vendor") or "Delivery"
        events.append(
            CalendarEvent(
                date=dd,
                type="deliver",
                title=title,
                subtitle=row.get("vendor"),
                shop=row.get("vendor")
                or ed.get("publisher_or_shop")
                or ed.get("retailer"),
                edition_id=ed.get("id"),
                order_id=row["id"],
            )
        )

    # Stable sort: by day, then by time-of-day (events with `at` come in
    # chronological order within a day), then by type.
    events.sort(
        key=lambda e: (
            e.date,
            e.at.timestamp() if e.at else 0,
            e.type,
        )
    )
    return events
