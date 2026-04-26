import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PhotoCaptureButton } from "../components/PhotoCaptureButton";
import { QRScanButton } from "../components/QRScanButton";
import { get } from "../lib/api";
import type { CalendarEvent, CalendarEventType } from "../lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_LABEL: Record<CalendarEventType, string> = {
  release: "Release",
  ship: "Ship",
  deliver: "Deliver",
  preorder_open: "Preorder opens",
  preorder_close: "Preorder closes",
  flash_sale: "Flash sale",
};

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

function formatTime(at: string): string {
  const d = new Date(at);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Home() {
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // null = "show all shops". Non-null = whitelist of shop keys to show.
  const [activeShops, setActiveShops] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const start = new Date(currentMonth);
    start.setDate(start.getDate() - 7);
    const end = endOfMonth(currentMonth);
    end.setDate(end.getDate() + 7);
    get<CalendarEvent[]>(
      `/calendar?start=${isoDate(start)}&end=${isoDate(end)}`,
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
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-pink-200">{monthLabel}</h1>
        <div className="flex gap-1">
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

      {/* Shop filter chips */}
      {shops.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
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
              {dayShops.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {dayShops.slice(0, 4).map((sk) => {
                    const c = shopColor(sk === UNKNOWN_SHOP ? null : sk);
                    return (
                      <span
                        key={sk}
                        className={[
                          "inline-block w-2 h-2 rounded-full",
                          c.dot,
                        ].join(" ")}
                        title={sk === UNKNOWN_SHOP ? "Other" : sk}
                      />
                    );
                  })}
                  {dayShops.length > 4 && (
                    <span className="text-[10px] text-pink-400">
                      +{dayShops.length - 4}
                    </span>
                  )}
                </span>
              )}
              {dayEvents.length > 0 && (
                <span className="mt-auto text-[11px] text-pink-400">
                  {dayEvents.length}{" "}
                  {dayEvents.length === 1 ? "event" : "events"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold mb-2 text-pink-200">
          {selectedDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h2>

        {/* Quick-add actions for the selected day. These are always visible
            so they work even when the calendar fetch fails. */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Link
            to={`/capture?release_date=${selectedKey}`}
            className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
          >
            + Release
          </Link>
          <Link
            to={`/flash-sales?starts=${selectedKey}`}
            className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
          >
            + Flash sale
          </Link>
          <PhotoCaptureButton
            to="/capture"
            searchParams={{ release_date: selectedKey }}
            label="📷 Take photo"
          />
          <QRScanButton label="📱 Scan QR / ISBN" />
        </div>

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
              const c = shopColor(ev.shop);
              return (
                <li
                  key={`${ev.type}-${ev.flash_sale_id ?? ev.library_entry_id ?? ev.order_id ?? ev.edition_id ?? i}`}
                  className="px-3 py-2 flex items-baseline gap-3"
                >
                  <span
                    className={[
                      "inline-block w-2 h-2 rounded-full mt-1.5 shrink-0",
                      c.dot,
                    ].join(" ")}
                    title={ev.shop ?? "Other"}
                  />
                  <span className="text-[11px] uppercase tracking-wide text-pink-400 w-28 shrink-0">
                    {EVENT_LABEL[ev.type]}
                  </span>
                  <span className="flex-1 text-sm text-pink-200">
                    {ev.title}
                    {ev.subtitle && (
                      <span className="text-xs text-pink-400 ml-2">
                        {ev.subtitle}
                      </span>
                    )}
                  </span>
                  {ev.at && (
                    <span className="text-xs text-pink-300 tabular-nums">
                      {formatTime(ev.at)}
                    </span>
                  )}
                  {ev.shop && (
                    <span
                      className={[
                        "text-[11px] px-1.5 py-0.5",
                        c.chip,
                      ].join(" ")}
                    >
                      {ev.shop}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
