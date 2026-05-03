import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { PhotoCaptureButton } from "../components/PhotoCaptureButton";
import { ProcessingBanner } from "../components/ProcessingBanner";
import { QRScanButton } from "../components/QRScanButton";
import { get } from "../lib/api";
import { lookupIsbn } from "../lib/isbnLookup";
import type { CalendarEvent } from "../lib/types";

/**
 * Pull a likely ISBN out of a scanned QR/barcode payload.
 *  - EAN-13 / ISBN-13 → 13 digits, usually starting with 978/979
 *  - ISBN-10 → 10 digits or 9 digits + "X"
 *  - URL containing /isbn/<digits> → extract
 * Returns the cleaned ISBN, or null if we don't recognize it.
 */
function extractIsbn(text: string): string | null {
  const trimmed = text.trim();
  // Match an ISBN inside a URL path (Goodreads, Amazon, etc.)
  const urlMatch = trimmed.match(/(?:isbn[/:= ]?)(\d{9,13}[Xx]?)/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  // Strip dashes / spaces and check raw digits
  const cleaned = trimmed.replace(/[\s-]/g, "");
  if (/^(?:97[89])?\d{9}[\dXx]$/.test(cleaned)) return cleaned.toUpperCase();
  return null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A shop with no name (orphan events) all share this slot. "_none" sorts last.
const UNKNOWN_SHOP = "_none";

// Shop palette tuned for a black background. Each entry has the dot color
// (used on the calendar tile) and a chip pair for the filter strip / event
// list. Backgrounds are darkened so they don't blow out on black.
const SHOP_PALETTE: Array<{ dot: string; chip: string; ring: string }> = [
  { dot: "bg-rose-400",    chip: "bg-rose-900/60 text-rose-200",       ring: "ring-rose-300" },
  { dot: "bg-amber-400",   chip: "bg-amber-900/60 text-amber-200",     ring: "ring-amber-300" },
  { dot: "bg-emerald-400", chip: "bg-emerald-900/60 text-emerald-200", ring: "ring-emerald-300" },
  { dot: "bg-sky-400",     chip: "bg-sky-900/60 text-sky-200",         ring: "ring-sky-300" },
  { dot: "bg-violet-400",  chip: "bg-violet-900/60 text-violet-200",   ring: "ring-violet-300" },
  { dot: "bg-fuchsia-400", chip: "bg-fuchsia-900/60 text-fuchsia-200", ring: "ring-fuchsia-300" },
  { dot: "bg-teal-400",    chip: "bg-teal-900/60 text-teal-200",       ring: "ring-teal-300" },
  { dot: "bg-orange-400",  chip: "bg-orange-900/60 text-orange-200",   ring: "ring-orange-300" },
];
const NEUTRAL = {
  dot: "bg-zinc-500",
  chip: "bg-zinc-800 text-pink-300",
  ring: "ring-zinc-500",
};

function shopKey(shop: string | null): string {
  return shop && shop.trim() ? shop : UNKNOWN_SHOP;
}

function shopColor(shop: string | null) {
  if (!shop || !shop.trim()) return NEUTRAL;
  // djb2-ish hash, stable across runs.
  let h = 5381;
  for (let i = 0; i < shop.length; i++) {
    h = ((h << 5) + h + shop.charCodeAt(i)) >>> 0;
  }
  return SHOP_PALETTE[h % SHOP_PALETTE.length];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isoDate(d: Date): string {
  // YYYY-MM-DD in local time. Calendar is local-day oriented.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Format an ISO timestamp as `Mon DD, H:MM AM/PM` in the user's local
 * timezone (e.g. "May 15, 2:00 PM"). Year is intentionally omitted —
 * the day-detail header above already shows the full date, so the meta
 * line just needs month, day, and time.
 */
function fromISOLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Where should tapping a calendar event take the user?
 *  - releases / preorders / ships / deliveries → the edition detail page,
 *    which is the canonical place to view + edit a book and its order.
 *  - flash sales / publisher sales → their list pages, with `?id=` so the
 *    target row can scroll-into-view + highlight on arrival.
 * Returns null if we don't have enough identifying info to route anywhere
 * useful (in which case the row is rendered as a non-clickable display).
 */
function eventDetailHref(ev: CalendarEvent): string | null {
  switch (ev.type) {
    case "release":
    case "preorder_open":
    case "preorder_close":
    case "ship":
    case "deliver":
      return ev.edition_id ? `/editions/${ev.edition_id}` : null;
    case "flash_sale":
      return ev.flash_sale_id
        ? `/flash-sales?id=${ev.flash_sale_id}`
        : "/flash-sales";
    case "publisher_sale_start":
    case "publisher_sale_end":
      return ev.publisher_sale_event_id
        ? `/publisher-sales-events?id=${ev.publisher_sale_event_id}`
        : "/publisher-sales-events";
    default:
      return null;
  }
}

export function Home() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  // Background work shown via the global ProcessingBanner. Empty = hide.
  const [bannerStatus, setBannerStatus] = useState<string>("");

  // null = "show all shops". Non-null = whitelist of shop keys to show.
  const [activeShops, setActiveShops] = useState<Set<string> | null>(null);

  // Read ?added=N&addedErrors=M off the URL — set by PhotoCaptureButton
  // after a multi-item screenshot bulk-save. We surface a one-shot success
  // banner the first time the user lands here with that param, then clear
  // it on dismiss.
  const [searchParams, setSearchParams] = useSearchParams();
  const addedCountStr = searchParams.get("added");
  const addedErrorsStr = searchParams.get("addedErrors");
  const addedCount = addedCountStr ? parseInt(addedCountStr, 10) : null;
  const addedErrors = addedErrorsStr ? parseInt(addedErrorsStr, 10) : null;
  function dismissAddedBanner() {
    const next = new URLSearchParams(searchParams);
    next.delete("added");
    next.delete("addedErrors");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const start = new Date(currentMonth);
    start.setDate(start.getDate() - 7);
    const end = endOfMonth(currentMonth);
    end.setDate(end.getDate() + 7);
    // Forward the browser's IANA timezone so the calendar function can
    // place each sale on the user's local calendar day, not UTC. Without
    // this, evening sales bleed into "tomorrow" on the grid.
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    get<CalendarEvent[]>(
      `/calendar?start=${isoDate(start)}&end=${isoDate(end)}&tz=${encodeURIComponent(tz)}`,
    )
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentMonth]);

  const shops = useMemo(() => {
    const seen = new Set<string>();
    for (const ev of events) seen.add(shopKey(ev.shop));
    return Array.from(seen).sort((a, b) => {
      if (a === UNKNOWN_SHOP) return 1;
      if (b === UNKNOWN_SHOP) return -1;
      return a.localeCompare(b);
    });
  }, [events]);

  const isShopActive = (key: string) =>
    activeShops === null ? true : activeShops.has(key);

  const toggleShop = (key: string) => {
    setActiveShops((prev) => {
      const base = prev ?? new Set(shops);
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (next.size === shops.length) return null;
      if (next.size === 0) return null;
      return next;
    });
  };

  const filteredEvents = useMemo(
    () => events.filter((ev) => isShopActive(shopKey(ev.shop))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, activeShops],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of filteredEvents) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [filteredEvents]);

  // When the user taps a calendar day, scroll the day-detail panel
  // below the grid into view so they don't have to thumb-scroll. We
  // skip the very first render so opening the page doesn't auto-jump.
  const dayDetailRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    dayDetailRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedDate]);

  const grid = useMemo(() => buildGrid(currentMonth), [currentMonth]);
  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const today = new Date();
  const selectedKey = isoDate(selectedDate);
  const selectedEvents = eventsByDay.get(selectedKey) ?? [];

  return (
    <div>
      <ProcessingBanner show={Boolean(bannerStatus)} message={bannerStatus} />

      {/* One-shot success banner after a multi-item AI screenshot scan
          drops the user back here with ?added=N. Shows a count plus, if
          any rows failed during the bulk save, a soft warning so Janelle
          knows to spot-check the calendar. Dismissible via × — the URL is
          rewritten to drop the query so a refresh doesn't bring it back. */}
      {addedCount !== null && addedCount > 0 && (
        <div
          role="status"
          className="mb-3 flex items-start gap-2 border border-pink-400 bg-pink-950/40 text-pink-100 px-3 py-2 text-sm"
        >
          <span aria-hidden>✨</span>
          <div className="flex-1">
            <div className="font-medium">
              Added {addedCount} event{addedCount === 1 ? "" : "s"} to your
              calendar.
            </div>
            {addedErrors !== null && addedErrors > 0 && (
              <div className="text-xs text-amber-200 mt-0.5">
                {addedErrors} item{addedErrors === 1 ? "" : "s"} couldn't be
                saved — check the screenshot and add anything missing by hand.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={dismissAddedBanner}
            aria-label="Dismiss"
            className="text-pink-300 hover:text-pink-100 text-base leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Calendar header row: month label + prev/today/next nav. The
          calendar-subscribe surface used to live here; it has been
          retired in favor of putting the day-action buttons in the
          banner slot above the grid. */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h1 className="text-base font-semibold text-pink-200">{monthLabel}</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
            className="border border-zinc-700 px-2 py-0.5 text-sm text-pink-300 hover:bg-zinc-800"
          >
            ‹ Prev
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setCurrentMonth(startOfMonth(now));
              setSelectedDate(now);
            }}
            className="border border-zinc-700 px-2 py-0.5 text-sm text-pink-300 hover:bg-zinc-800"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="border border-zinc-700 px-2 py-0.5 text-sm text-pink-300 hover:bg-zinc-800"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Shop filter — collapsed by default into a tiny disclosure. The
          per-shop chip strip used to live here always-on, but with a
          dozen shops it cluttered the top of the home screen. The
          chips now hide behind a "Filter shops" toggle; open state is
          local DOM (<details>) so we don't need extra React state. The
          summary shows "(N/M)" when a filter is active so the user can
          tell at a glance whether something's hidden. */}
      {shops.length > 0 && (
        <details className="mb-3 group">
          <summary className="list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-1.5 cursor-pointer text-xs px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-pink-300 hover:bg-zinc-800 select-none">
            <span
              aria-hidden
              className="inline-block transition-transform group-open:rotate-90"
            >
              ›
            </span>
            <span>
              Filter shops
              {activeShops !== null && (
                <span className="text-pink-200">
                  {" "}
                  ({activeShops.size}/{shops.length})
                </span>
              )}
            </span>
          </summary>
          <div className="flex flex-wrap gap-1 mt-2">
            <button
              onClick={() => setActiveShops(null)}
              className={[
                "text-xs px-2 py-0.5 border",
                activeShops === null
                  ? "border-pink-400 bg-pink-500 text-black"
                  : "border-zinc-700 bg-zinc-900 text-pink-300 hover:bg-zinc-800",
              ].join(" ")}
            >
              All shops
            </button>
            {shops.map((key) => {
              const c = shopColor(key === UNKNOWN_SHOP ? null : key);
              const on = isShopActive(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleShop(key)}
                  className={[
                    "text-xs px-2 py-0.5 border flex items-center gap-1.5",
                    on
                      ? `${c.chip} border-transparent`
                      : "bg-zinc-900 text-pink-500 border-zinc-700 hover:bg-zinc-800",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block w-2 h-2 rounded-full",
                      on ? c.dot : "bg-zinc-600",
                    ].join(" ")}
                  />
                  {key === UNKNOWN_SHOP ? "Other" : key}
                </button>
              );
            })}
          </div>
        </details>
      )}

      {/* Banner-slot quick-add actions. These used to live below the
          calendar grid (under the day-detail header); they were lifted
          here, into the spot the old subscribe banner occupied, so the
          most-used actions sit above the grid art. They still operate
          on whatever day is currently selected via `selectedKey`. */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Link
          to={`/flash-sales?starts=${selectedKey}`}
          className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
        >
          + Flash sale
        </Link>
        <Link
          to={`/publisher-sales-events?starts=${selectedKey}`}
          className="border border-pink-400 text-pink-200 px-3 py-1 text-sm hover:bg-zinc-800"
        >
          🏷️ Publisher sale event
        </Link>
        <PhotoCaptureButton
          to="/capture"
          searchParams={{ release_date: selectedKey }}
          mode="library"
          label="✨ Scan screenshot (AI)"
          aiScan
        />
        <QRScanButton
          label="📱 Scan QR / ISBN"
          onResult={(text) => {
            const isbn = extractIsbn(text);
            if (!isbn) {
              setScanError(
                `Couldn't read an ISBN from "${text.slice(0, 40)}${
                  text.length > 40 ? "…" : ""
                }". Try the barcode on the back cover.`,
              );
              return;
            }
            setScanError(null);
            // Fire-and-forget the lookup so the QR modal closes
            // immediately and the user gets a "looking up…" banner
            // while we hit Open Library / Google Books. Whatever we
            // find (or don't) gets forwarded into Capture's location
            // state so the form lands prefilled — no extra tap.
            setBannerStatus("🔎 Looking up ISBN…");
            void (async () => {
              try {
                const result = await lookupIsbn(isbn);
                const params = new URLSearchParams({
                  isbn,
                  from: "scan",
                  release_date: selectedKey,
                });
                // Mirror the AI flow's location.state shape so Capture
                // can use the same prefill code path.
                const scanFields = result
                  ? {
                      title: result.title,
                      author: result.author,
                      series: result.series,
                      series_number: result.series_number,
                      edition_name: result.edition_name,
                      publisher_or_shop: result.publisher_or_shop,
                      retailer: result.retailer,
                      release_date: result.release_date,
                      isbn: result.isbn ?? isbn,
                      edition_size: result.edition_size,
                      special_features: result.special_features,
                      preorder_start_at: result.preorder_start_at,
                      preorder_end_at: result.preorder_end_at,
                      notes: result.notes,
                    }
                  : null;
                navigate(`/capture?${params.toString()}`, {
                  state: {
                    // Carry the cover the lookup found (if any) into
                    // Capture so it lands as cover_url.
                    photoDataUrl: result?.cover_url ?? undefined,
                    scanFields,
                    scanError:
                      result && result.title
                        ? null
                        : "Couldn't find this ISBN online. Fill in the rest by hand.",
                  },
                });
              } catch (e) {
                // Network / parse failures land on Capture with just
                // the ISBN prefilled; user can keep going.
                const params = new URLSearchParams({
                  isbn,
                  from: "scan",
                  release_date: selectedKey,
                });
                navigate(`/capture?${params.toString()}`, {
                  state: {
                    scanFields: null,
                    scanError:
                      e instanceof Error ? e.message : String(e),
                  },
                });
              } finally {
                setBannerStatus("");
              }
            })();
          }}
        />
      </div>
      {scanError && (
        <p className="text-xs text-red-300 border border-red-800 bg-red-950/40 p-2 mb-3">
          {scanError}
        </p>
      )}

      {/* Month grid */}
      <div className="grid grid-cols-7 card">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-b border-zinc-800 px-2 py-1 text-xs text-pink-400 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
        {grid.map((d) => {
          const inMonth = d.getMonth() === currentMonth.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selectedDate);
          const dayEvents = eventsByDay.get(isoDate(d)) ?? [];

          const dayShops = Array.from(
            new Set(dayEvents.map((ev) => shopKey(ev.shop))),
          );

          return (
            <button
              key={d.toISOString()}
              onClick={() => setSelectedDate(d)}
              className={[
                "min-h-[72px] border-t border-l border-zinc-800 px-2 py-1 text-left flex flex-col",
                "hover:bg-zinc-800",
                inMonth ? "bg-zinc-900 text-pink-200" : "bg-black text-pink-500/60",
                isSelected ? "ring-1 ring-inset ring-pink-400" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "text-xs",
                  isToday ? "font-semibold text-pink-300" : "",
                ].join(" ")}
              >
                {d.getDate()}
              </span>
              {/* Bottom-anchored stack of full-width shop-color bars. One
                  thin line per shop with events that day. No counts, no
                  labels — the lines are the entire signal. */}
              {dayShops.length > 0 && (
                <span className="mt-auto -mx-2 flex flex-col gap-0.5 pb-0.5">
                  {dayShops.slice(0, 5).map((sk) => {
                    const c = shopColor(sk === UNKNOWN_SHOP ? null : sk);
                    return (
                      <span
                        key={sk}
                        className={["block h-1 w-full", c.dot].join(" ")}
                        title={sk === UNKNOWN_SHOP ? "Other" : sk}
                      />
                    );
                  })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail */}
      <div ref={dayDetailRef} className="mt-4 scroll-mt-2">
        <h2 className="text-sm font-semibold mb-2 text-pink-200">
          {selectedDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h2>

        {loading && <p className="text-sm text-pink-400">Loading events…</p>}
        {error && (
          <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2">
            {error}
          </p>
        )}
        {!loading && !error && selectedEvents.length === 0 && (
          <p className="text-sm text-pink-400">No events on this day.</p>
        )}
        {selectedEvents.length > 0 && (
          <ul className="card divide-y divide-zinc-800">
            {selectedEvents.map((ev, i) => {
              const target = eventDetailHref(ev);
              const Tag = target ? "button" : "div";
              return (
                <li
                  key={`${ev.type}-${ev.flash_sale_id ?? ev.publisher_sale_event_id ?? ev.library_entry_id ?? ev.order_id ?? ev.edition_id ?? i}`}
                >
                  {/* Row layout mirrored EXACTLY from FlashSales.tsx so a
                      day-detail row reads identically to a flash-sale row:
                      bold title on top, then a flex-wrap meta line with
                      shop and the date/time (range when we have one,
                      otherwise the single `at` timestamp), then a notes
                      line. No event-type label, no "Other" placeholder,
                      no chevron — just title, shop, time, notes. */}
                  <Tag
                    onClick={target ? () => navigate(target) : undefined}
                    type={target ? "button" : undefined}
                    className={[
                      "w-full px-3 py-2 flex items-center gap-3 text-sm text-left",
                      target ? "hover:bg-zinc-800 active:bg-zinc-800" : "",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-pink-200">
                        {ev.title}
                      </div>
                      <div className="text-xs text-pink-400 flex flex-wrap gap-x-3">
                        {ev.shop && <span>{ev.shop}</span>}
                        {ev.starts_at && ev.ends_at ? (
                          <span>
                            {fromISOLocal(ev.starts_at)} →{" "}
                            {fromISOLocal(ev.ends_at)}
                          </span>
                        ) : ev.at ? (
                          <span>{fromISOLocal(ev.at)}</span>
                        ) : null}
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-pink-300 underline"
                          >
                            link
                          </a>
                        )}
                      </div>
                      {(ev.notes ?? ev.subtitle) && (
                        <div className="text-xs text-pink-500 truncate">
                          {ev.notes ?? ev.subtitle}
                        </div>
                      )}
                    </div>
                  </Tag>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
