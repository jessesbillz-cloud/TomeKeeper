import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase.ts";
import { json, badRequest, methodNotAllowed } from "../_shared/response.ts";
import { getQueryParam } from "../_shared/parse.ts";

interface CalendarEvent {
  date: string;
  type: string;
  title: string;
  subtitle?: string | null;
  shop?: string | null;
  at?: string | null;
  /** Range-style events (flash sales, publisher sales) carry the full
   *  window so the day-detail card can render the same `start → end`
   *  row the FlashSales list page uses. Null on point events. */
  starts_at?: string | null;
  ends_at?: string | null;
  url?: string | null;
  notes?: string | null;
  edition_id?: string | null;
  library_entry_id?: string | null;
  order_id?: string | null;
  flash_sale_id?: string | null;
  publisher_sale_event_id?: string | null;
}

/**
 * For values that are date-only strings in the DB (release_date,
 * ship_date, delivery_date), we just want the YYYY-MM-DD prefix. No
 * timezone math is needed — the user typed a calendar date and that's
 * the only thing we have.
 */
function safeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : value.slice(0, 10);
}

/**
 * For full timestamps (starts_at / ends_at / preorder_*_at), we need to
 * convert the UTC timestamp to the user's local calendar date. Without
 * this, a flash sale that ends Monday 8 PM EST (Tuesday 00:00 UTC) gets
 * stamped as Tuesday on the calendar grid, which makes it look like a
 * 2-day event when it's really just a Monday-evening sale.
 *
 * `tz` should be an IANA zone like "America/New_York". If anything goes
 * wrong (invalid value, missing) we fall back to the UTC date so we
 * never explode the response.
 */
function localDate(
  value: string | null | undefined,
  tz: string | null,
): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  if (!tz) return value.slice(0, 10);
  try {
    // en-CA gives YYYY-MM-DD format directly with a 2-digit month/day.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return value.slice(0, 10);
  }
}

function toDateStr(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") return methodNotAllowed();

  const url = new URL(req.url);
  const supabase = createUserClient(req);

  const startParam = getQueryParam(url, "start") ?? toDateStr(new Date());
  const endParam = getQueryParam(url, "end") ?? addDays(startParam, 90);
  // `tz` is the user's IANA timezone (e.g. "America/New_York") forwarded
  // by the frontend so we can map UTC timestamps to the user's local
  // calendar day. Falls back to UTC if missing/invalid.
  const tzParam = getQueryParam(url, "tz") ?? null;

  const startDt = startParam + "T00:00:00.000Z";
  const endDt = endParam + "T23:59:59.999Z";

  const events: CalendarEvent[] = [];

  // Run all 6 queries in parallel
  const [
    resLibrary,
    resPreorders,
    resFlashSales,
    resPublisherEvents,
    resShips,
    resDeliveries,
  ] = await Promise.all([
      // 1. Releases from upcoming library entries
      supabase
        .from("library_entries")
        .select(
          "id, status, edition_id, " +
            "editions(id, edition_name, release_date, publisher_or_shop, " +
            "retailer, work_id, works(title, author))",
        )
        .eq("status", "upcoming"),

      // 2. Preorder windows
      supabase
        .from("editions")
        .select(
          "id, edition_name, publisher_or_shop, retailer, " +
            "preorder_start_at, preorder_end_at, work_id, " +
            "works(title, author)",
        )
        .or(
          `and(preorder_start_at.gte.${startDt},preorder_start_at.lte.${endDt}),` +
            `and(preorder_end_at.gte.${startDt},preorder_end_at.lte.${endDt})`,
        ),

      // 3. Flash sales overlapping the window
      supabase
        .from("flash_sales")
        .select("id, shop, title, url, starts_at, ends_at, notes, edition_id")
        .lte("starts_at", endDt)
        .gte("ends_at", startDt),

      // 4. Publisher sales events overlapping the window
      supabase
        .from("publisher_sales_events")
        .select(
          "id, publisher, title, url, starts_at, ends_at, notes, edition_id",
        )
        .lte("starts_at", endDt)
        .gte("ends_at", startDt),

      // 5. Ships
      supabase
        .from("orders")
        .select(
          "id, ship_date, vendor, edition_id, " +
            "editions(id, edition_name, publisher_or_shop, retailer, " +
            "work_id, works(title))",
        )
        .gte("ship_date", startParam)
        .lte("ship_date", endParam),

      // 6. Deliveries
      supabase
        .from("orders")
        .select(
          "id, delivery_date, vendor, edition_id, " +
            "editions(id, edition_name, publisher_or_shop, retailer, " +
            "work_id, works(title))",
        )
        .gte("delivery_date", startParam)
        .lte("delivery_date", endParam),
    ]);

  // 1. Releases
  for (const row of resLibrary.data ?? []) {
    const ed = (row as Record<string, unknown>).editions as Record<string, unknown> | null;
    if (!ed) continue;
    const rd = safeDate(ed.release_date as string);
    if (!rd || rd < startParam || rd > endParam) continue;
    const work = (ed.works as Record<string, unknown>) ?? {};
    events.push({
      date: rd,
      type: "release",
      title: (work.title as string) || (ed.edition_name as string) || "Untitled",
      subtitle: ed.edition_name as string,
      shop: (ed.publisher_or_shop as string) || (ed.retailer as string) || null,
      edition_id: ed.id as string,
      library_entry_id: row.id as string,
    });
  }

  // 2. Preorder open/close
  for (const row of resPreorders.data ?? []) {
    const r = row as Record<string, unknown>;
    const work = (r.works as Record<string, unknown>) ?? {};
    const title = (work.title as string) || (r.edition_name as string) || "Preorder";
    const shop = (r.publisher_or_shop as string) || (r.retailer as string) || null;

    const poStart = r.preorder_start_at as string | null;
    if (poStart) {
      const d = localDate(poStart, tzParam);
      if (d && d >= startParam && d <= endParam) {
        events.push({
          date: d,
          type: "preorder_open",
          title,
          subtitle: r.edition_name as string,
          shop,
          at: poStart,
          edition_id: r.id as string,
        });
      }
    }

    const poEnd = r.preorder_end_at as string | null;
    if (poEnd) {
      const d = localDate(poEnd, tzParam);
      if (d && d >= startParam && d <= endParam) {
        events.push({
          date: d,
          type: "preorder_close",
          title,
          subtitle: r.edition_name as string,
          shop,
          at: poEnd,
          edition_id: r.id as string,
        });
      }
    }
  }

  // 3. Flash sales — one event per active day
  for (const row of resFlashSales.data ?? []) {
    const r = row as Record<string, unknown>;
    const sAt = r.starts_at as string | null;
    const eAt = r.ends_at as string | null;
    if (!sAt || !eAt) continue;

    // Use the user's local timezone here so a sale that ends at 8 PM
    // local doesn't bleed into "tomorrow" because UTC midnight has
    // already passed.
    const sDate = localDate(sAt, tzParam)!;
    const eDate = localDate(eAt, tzParam)!;
    const fsTitle = (r.title as string) || `Flash sale (${r.shop})`;

    // Clip to requested window
    let day = sDate < startParam ? startParam : sDate;
    const last = eDate > endParam ? endParam : eDate;

    while (day <= last) {
      events.push({
        date: day,
        type: "flash_sale",
        title: fsTitle,
        subtitle: r.shop as string,
        shop: r.shop as string,
        at: day === sDate ? sAt : null,
        // Carry the full window + url + notes through so the day-detail
        // panel can render the exact same row the FlashSales list page
        // shows (title / shop / start → end / link / notes).
        starts_at: sAt,
        ends_at: eAt,
        url: (r.url as string) || null,
        notes: (r.notes as string) || null,
        edition_id: (r.edition_id as string) || null,
        flash_sale_id: r.id as string,
      });
      day = addDays(day, 1);
    }
  }

  // 4. Publisher sales events — start + end markers (long sales would
  //    visually overwhelm the day grid if we expanded to one chip per day,
  //    so we just mark the start and end and the iCal feed renders them
  //    as proper multi-day events).
  for (const row of resPublisherEvents.data ?? []) {
    const r = row as Record<string, unknown>;
    const sAt = r.starts_at as string | null;
    const eAt = r.ends_at as string | null;
    if (!sAt || !eAt) continue;
    const sDate = localDate(sAt, tzParam)!;
    const eDate = localDate(eAt, tzParam)!;
    const peTitle =
      (r.title as string) ||
      `${r.publisher as string} sale`;
    if (sDate >= startParam && sDate <= endParam) {
      events.push({
        date: sDate,
        type: "publisher_sale_start",
        title: peTitle,
        subtitle: r.publisher as string,
        shop: r.publisher as string,
        at: sAt,
        starts_at: sAt,
        ends_at: eAt,
        url: (r.url as string) || null,
        notes: (r.notes as string) || null,
        edition_id: (r.edition_id as string) || null,
        publisher_sale_event_id: r.id as string,
      });
    }
    if (eDate >= startParam && eDate <= endParam && eDate !== sDate) {
      events.push({
        date: eDate,
        type: "publisher_sale_end",
        title: peTitle,
        subtitle: r.publisher as string,
        shop: r.publisher as string,
        at: eAt,
        starts_at: sAt,
        ends_at: eAt,
        url: (r.url as string) || null,
        notes: (r.notes as string) || null,
        edition_id: (r.edition_id as string) || null,
        publisher_sale_event_id: r.id as string,
      });
    }
  }

  // 5. Ships
  for (const row of resShips.data ?? []) {
    const r = row as Record<string, unknown>;
    const sd = safeDate(r.ship_date as string);
    if (!sd) continue;
    const ed = (r.editions as Record<string, unknown>) ?? {};
    const work = (ed.works as Record<string, unknown>) ?? {};
    events.push({
      date: sd,
      type: "ship",
      title: (work.title as string) || (r.vendor as string) || "Order",
      subtitle: r.vendor as string,
      shop:
        (r.vendor as string) ||
        (ed.publisher_or_shop as string) ||
        (ed.retailer as string) ||
        null,
      edition_id: (ed.id as string) || null,
      order_id: r.id as string,
    });
  }

  // 6. Deliveries
  for (const row of resDeliveries.data ?? []) {
    const r = row as Record<string, unknown>;
    const dd = safeDate(r.delivery_date as string);
    if (!dd) continue;
    const ed = (r.editions as Record<string, unknown>) ?? {};
    const work = (ed.works as Record<string, unknown>) ?? {};
    events.push({
      date: dd,
      type: "deliver",
      title: (work.title as string) || (r.vendor as string) || "Delivery",
      subtitle: r.vendor as string,
      shop:
        (r.vendor as string) ||
        (ed.publisher_or_shop as string) ||
        (ed.retailer as string) ||
        null,
      edition_id: (ed.id as string) || null,
      order_id: r.id as string,
    });
  }

  // Sort: by date, then by timestamp (if present), then by type
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const aTs = a.at ? new Date(a.at).getTime() : 0;
    const bTs = b.at ? new Date(b.at).getTime() : 0;
    if (aTs !== bTs) return aTs - bTs;
    return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
  });

  return json(events);
});
