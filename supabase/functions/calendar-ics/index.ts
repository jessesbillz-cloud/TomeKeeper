import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public iCal feed. Authenticated via a per-user `?token=` query string
// (stored in user_profiles.ical_token). Calendar subscription clients
// (iOS Calendar, Google Calendar, Outlook) can't carry an Authorization
// bearer, so we use a token-in-URL pattern.
//
// Subscribe URL pattern:
//   https://<project>.supabase.co/functions/v1/calendar-ics?token=<ical_token>
//
// This function uses the service-role key so it can read across the
// authenticated user's rows without a JWT. Once we look up which user_id
// the token belongs to, we filter all queries by that user_id.

const ICS_HEADERS: Record<string, string> = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Cache-Control": "private, max-age=300",
  "Access-Control-Allow-Origin": "*",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as the iCalendar UTC timestamp (YYYYMMDDTHHMMSSZ). */
function icsDateTime(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Format a date string (YYYY-MM-DD) as an iCalendar all-day date. */
function icsDate(s: string): string {
  return s.replace(/-/g, "");
}

/**
 * Escape per RFC 5545 §3.3.11: backslash-escape `\,;\n` and CR.
 */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Fold long lines per RFC 5545 §3.1: lines > 75 octets MUST be folded
 * with CRLF + space. We keep it simple and break by character (good
 * enough for ASCII-heavy content).
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
  }
  return out.join("\r\n");
}

interface VEventInput {
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  /** All-day event date (YYYY-MM-DD) — mutually exclusive with start/end. */
  date?: string;
  /** Timed event start (Date). */
  start?: Date;
  /** Timed event end (Date). */
  end?: Date;
  /** Reminder offsets in minutes before start (e.g. [60, 1440]). */
  alarms?: number[];
}

function buildVEvent(e: VEventInput, dtstamp: string): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${e.uid}`);
  lines.push(`DTSTAMP:${dtstamp}`);
  if (e.date) {
    // All-day event — DTSTART;VALUE=DATE
    const next = new Date(e.date + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    const endStr =
      next.getUTCFullYear().toString() +
      pad(next.getUTCMonth() + 1) +
      pad(next.getUTCDate());
    lines.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
  } else if (e.start && e.end) {
    lines.push(`DTSTART:${icsDateTime(e.start)}`);
    lines.push(`DTEND:${icsDateTime(e.end)}`);
  } else if (e.start) {
    // Treat as a 1-hour event by default
    const end = new Date(e.start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${icsDateTime(e.start)}`);
    lines.push(`DTEND:${icsDateTime(end)}`);
  }
  lines.push(fold(`SUMMARY:${icsEscape(e.summary)}`));
  if (e.description) lines.push(fold(`DESCRIPTION:${icsEscape(e.description)}`));
  if (e.url) lines.push(fold(`URL:${e.url}`));
  for (const m of e.alarms ?? []) {
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(fold(`DESCRIPTION:${icsEscape(e.summary)}`));
    lines.push(`TRIGGER:-PT${m}M`);
    lines.push("END:VALARM");
  }
  lines.push("END:VEVENT");
  return lines;
}

Deno.serve(async (req: Request) => {
  // Calendar subscribers only do GET; we don't need CORS preflight here.
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing ?token=", { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the user by token
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("user_id, username")
      .eq("ical_token", token)
      .limit(1)
      .single();

    if (profileErr || !profile) {
      return new Response("Invalid token", { status: 403 });
    }

    const userId = profile.user_id as string;

    // Pull a generous window: 30 days back, 365 days forward.
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() + 365);
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    const startDateOnly = startISO.slice(0, 10);
    const endDateOnly = endISO.slice(0, 10);

    const [
      libRes,
      flashRes,
      pubRes,
      shipRes,
      delivRes,
      preorderRes,
    ] = await Promise.all([
      // Releases the user has flagged "upcoming"
      supabase
        .from("library_entries")
        .select(
          "id, edition_id, " +
            "editions(id, edition_name, release_date, release_time, " +
            "release_timezone, publisher_or_shop, retailer, work_id, " +
            "works(title, author))",
        )
        .eq("user_id", userId)
        .eq("status", "upcoming"),

      supabase
        .from("flash_sales")
        .select("id, shop, title, url, starts_at, ends_at, notes")
        .eq("user_id", userId)
        .lte("starts_at", endISO)
        .gte("ends_at", startISO),

      supabase
        .from("publisher_sales_events")
        .select("id, publisher, title, url, starts_at, ends_at, notes")
        .eq("user_id", userId)
        .lte("starts_at", endISO)
        .gte("ends_at", startISO),

      supabase
        .from("orders")
        .select(
          "id, ship_date, vendor, " +
            "editions(id, edition_name, work_id, works(title))",
        )
        .eq("user_id", userId)
        .gte("ship_date", startDateOnly)
        .lte("ship_date", endDateOnly),

      supabase
        .from("orders")
        .select(
          "id, delivery_date, vendor, " +
            "editions(id, edition_name, work_id, works(title))",
        )
        .eq("user_id", userId)
        .gte("delivery_date", startDateOnly)
        .lte("delivery_date", endDateOnly),

      // Preorder windows for editions in the user's library
      supabase
        .from("library_entries")
        .select(
          "id, edition_id, " +
            "editions(id, edition_name, preorder_start_at, preorder_end_at, " +
            "publisher_or_shop, work_id, works(title))",
        )
        .eq("user_id", userId),
    ]);

    const dtstamp = icsDateTime(new Date());
    const out: string[] = [];
    out.push("BEGIN:VCALENDAR");
    out.push("VERSION:2.0");
    out.push("PRODID:-//TomeKeeper//Calendar//EN");
    out.push("METHOD:PUBLISH");
    out.push("X-WR-CALNAME:TomeKeeper");
    out.push("X-WR-CALDESC:Special edition releases, sales & shipments");
    out.push("X-PUBLISHED-TTL:PT1H");

    for (const row of libRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const ed = r.editions as Record<string, unknown> | null;
      if (!ed?.release_date) continue;
      const work = (ed.works as Record<string, unknown>) ?? {};
      const title =
        (work.title as string) || (ed.edition_name as string) || "Release";
      const summary = `📚 ${title} releases`;
      const desc = [
        ed.edition_name && `Edition: ${ed.edition_name}`,
        ed.publisher_or_shop && `Publisher: ${ed.publisher_or_shop}`,
        ed.retailer && `Retailer: ${ed.retailer}`,
      ]
        .filter(Boolean)
        .join("\n");
      const uid = `release-${r.id}@tomekeeper`;
      out.push(
        ...buildVEvent(
          {
            uid,
            summary,
            description: desc,
            date: ed.release_date as string,
            alarms: [60, 24 * 60], // 1 hour, 1 day
          },
          dtstamp,
        ),
      );
    }

    for (const row of flashRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const summary = `⚡ ${(r.title as string) || `Flash sale: ${r.shop}`}`;
      out.push(
        ...buildVEvent(
          {
            uid: `flash-${r.id}@tomekeeper`,
            summary,
            description:
              `Shop: ${r.shop}\n` + ((r.notes as string) ?? ""),
            url: (r.url as string) ?? undefined,
            start: new Date(r.starts_at as string),
            end: new Date(r.ends_at as string),
            alarms: [10, 60], // 10 min, 1 hour before start
          },
          dtstamp,
        ),
      );
    }

    for (const row of pubRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const summary = `🏷️ ${
        (r.title as string) || `${r.publisher} sale`
      }`;
      out.push(
        ...buildVEvent(
          {
            uid: `pub-${r.id}@tomekeeper`,
            summary,
            description:
              `Publisher: ${r.publisher}\n` + ((r.notes as string) ?? ""),
            url: (r.url as string) ?? undefined,
            start: new Date(r.starts_at as string),
            end: new Date(r.ends_at as string),
            alarms: [60, 24 * 60],
          },
          dtstamp,
        ),
      );
    }

    for (const row of shipRes.data ?? []) {
      const r = row as Record<string, unknown>;
      if (!r.ship_date) continue;
      const ed = (r.editions as Record<string, unknown>) ?? {};
      const work = (ed.works as Record<string, unknown>) ?? {};
      const t =
        (work.title as string) || (ed.edition_name as string) || "Order";
      out.push(
        ...buildVEvent(
          {
            uid: `ship-${r.id}@tomekeeper`,
            summary: `📦 ${t} ships`,
            description: r.vendor ? `Vendor: ${r.vendor}` : undefined,
            date: r.ship_date as string,
          },
          dtstamp,
        ),
      );
    }

    for (const row of delivRes.data ?? []) {
      const r = row as Record<string, unknown>;
      if (!r.delivery_date) continue;
      const ed = (r.editions as Record<string, unknown>) ?? {};
      const work = (ed.works as Record<string, unknown>) ?? {};
      const t =
        (work.title as string) || (ed.edition_name as string) || "Delivery";
      out.push(
        ...buildVEvent(
          {
            uid: `deliv-${r.id}@tomekeeper`,
            summary: `🎁 ${t} delivers`,
            description: r.vendor ? `Vendor: ${r.vendor}` : undefined,
            date: r.delivery_date as string,
            alarms: [0],
          },
          dtstamp,
        ),
      );
    }

    for (const row of preorderRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const ed = r.editions as Record<string, unknown> | null;
      if (!ed) continue;
      const work = (ed.works as Record<string, unknown>) ?? {};
      const t =
        (work.title as string) || (ed.edition_name as string) || "Preorder";

      const poStart = ed.preorder_start_at as string | null;
      const poEnd = ed.preorder_end_at as string | null;

      if (poStart) {
        const pd = new Date(poStart);
        if (pd >= start && pd <= end) {
          out.push(
            ...buildVEvent(
              {
                uid: `preorder-open-${r.id}-${ed.id}@tomekeeper`,
                summary: `🛒 ${t} preorder opens`,
                start: pd,
                alarms: [10, 60, 24 * 60],
              },
              dtstamp,
            ),
          );
        }
      }
      if (poEnd) {
        const pd = new Date(poEnd);
        if (pd >= start && pd <= end) {
          out.push(
            ...buildVEvent(
              {
                uid: `preorder-close-${r.id}-${ed.id}@tomekeeper`,
                summary: `⏳ ${t} preorder closes`,
                start: pd,
                alarms: [60, 24 * 60],
              },
              dtstamp,
            ),
          );
        }
      }
    }

    out.push("END:VCALENDAR");

    return new Response(out.join("\r\n"), {
      status: 200,
      headers: ICS_HEADERS,
    });
  } catch (e) {
    console.error("calendar-ics error:", e);
    return new Response(
      `Internal error: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    );
  }
});
