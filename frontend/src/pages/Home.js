import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_LABEL = {
    release: "Release",
    ship: "Ship",
    deliver: "Deliver",
    preorder_open: "Preorder opens",
    preorder_close: "Preorder closes",
    flash_sale: "Flash sale",
};
// A shop with no name (orphan events) all share this slot. "_none" sorts last.
const UNKNOWN_SHOP = "_none";
// A small, deterministic palette. Each is `[bg, dot, text]` Tailwind classes.
// We pick by hashing the shop name -> stable index so colors don't shuffle
// between renders.
const SHOP_PALETTE = [
    { bg: "bg-rose-100", dot: "bg-rose-500", chip: "bg-rose-100 text-rose-900", ring: "ring-rose-400" },
    { bg: "bg-amber-100", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-900", ring: "ring-amber-400" },
    { bg: "bg-emerald-100", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900", ring: "ring-emerald-400" },
    { bg: "bg-sky-100", dot: "bg-sky-500", chip: "bg-sky-100 text-sky-900", ring: "ring-sky-400" },
    { bg: "bg-violet-100", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-900", ring: "ring-violet-400" },
    { bg: "bg-fuchsia-100", dot: "bg-fuchsia-500", chip: "bg-fuchsia-100 text-fuchsia-900", ring: "ring-fuchsia-400" },
    { bg: "bg-teal-100", dot: "bg-teal-500", chip: "bg-teal-100 text-teal-900", ring: "ring-teal-400" },
    { bg: "bg-orange-100", dot: "bg-orange-500", chip: "bg-orange-100 text-orange-900", ring: "ring-orange-400" },
];
const NEUTRAL = {
    bg: "bg-zinc-100",
    dot: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-700",
    ring: "ring-zinc-400",
};
function shopKey(shop) {
    return shop && shop.trim() ? shop : UNKNOWN_SHOP;
}
function shopColor(shop) {
    if (!shop || !shop.trim())
        return NEUTRAL;
    // djb2-ish hash, stable across runs.
    let h = 5381;
    for (let i = 0; i < shop.length; i++) {
        h = ((h << 5) + h + shop.charCodeAt(i)) >>> 0;
    }
    return SHOP_PALETTE[h % SHOP_PALETTE.length];
}
function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d, n) {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isoDate(d) {
    // YYYY-MM-DD in local time. Calendar is local-day oriented.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function sameDay(a, b) {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
function buildGrid(month) {
    const first = startOfMonth(month);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
}
function formatTime(at) {
    // "Tue 8:00 PM PT"-ish, but TZ comes from the user's browser. Backend may
    // later send a release_timezone we can override with.
    const d = new Date(at);
    return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });
}
export function Home() {
    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // null = "show all shops". Non-null = whitelist of shop keys to show.
    const [activeShops, setActiveShops] = useState(null);
    // Fetch events for the visible month (with a one-week buffer on each side
    // so leading/trailing days from adjacent months light up too).
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        const start = new Date(currentMonth);
        start.setDate(start.getDate() - 7);
        const end = endOfMonth(currentMonth);
        end.setDate(end.getDate() + 7);
        get(`/calendar?start=${isoDate(start)}&end=${isoDate(end)}`)
            .then((data) => {
            if (!cancelled)
                setEvents(data);
        })
            .catch((e) => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : String(e));
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [currentMonth]);
    // Every distinct shop seen this month, sorted alphabetically. Drives the
    // filter chip strip.
    const shops = useMemo(() => {
        const seen = new Set();
        for (const ev of events)
            seen.add(shopKey(ev.shop));
        return Array.from(seen).sort((a, b) => {
            // Unknown shop sorts last.
            if (a === UNKNOWN_SHOP)
                return 1;
            if (b === UNKNOWN_SHOP)
                return -1;
            return a.localeCompare(b);
        });
    }, [events]);
    const isShopActive = (key) => activeShops === null ? true : activeShops.has(key);
    const toggleShop = (key) => {
        setActiveShops((prev) => {
            // First toggle from "all" -> isolate just the unclicked ones.
            const base = prev ?? new Set(shops);
            const next = new Set(base);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            // If everything is on again, collapse back to "all" (null).
            if (next.size === shops.length)
                return null;
            // If nothing is on, treat it as "all" so we never blank the calendar.
            if (next.size === 0)
                return null;
            return next;
        });
    };
    const filteredEvents = useMemo(() => events.filter((ev) => isShopActive(shopKey(ev.shop))), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, activeShops]);
    const eventsByDay = useMemo(() => {
        const map = new Map();
        for (const ev of filteredEvents) {
            const key = ev.date;
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(ev);
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
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h1", { className: "text-base font-semibold", children: monthLabel }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => setCurrentMonth((m) => addMonths(m, -1)), className: "border border-zinc-300 px-2 py-0.5 text-sm hover:bg-zinc-100", children: "\u2039 Prev" }), _jsx("button", { onClick: () => {
                                    const now = new Date();
                                    setCurrentMonth(startOfMonth(now));
                                    setSelectedDate(now);
                                }, className: "border border-zinc-300 px-2 py-0.5 text-sm hover:bg-zinc-100", children: "Today" }), _jsx("button", { onClick: () => setCurrentMonth((m) => addMonths(m, 1)), className: "border border-zinc-300 px-2 py-0.5 text-sm hover:bg-zinc-100", children: "Next \u203A" })] })] }), shops.length > 0 && (_jsxs("div", { className: "flex flex-wrap gap-1 mb-3", children: [_jsx("button", { onClick: () => setActiveShops(null), className: [
                            "text-xs px-2 py-0.5 border",
                            activeShops === null
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                        ].join(" "), children: "All shops" }), shops.map((key) => {
                        const c = shopColor(key === UNKNOWN_SHOP ? null : key);
                        const on = isShopActive(key);
                        return (_jsxs("button", { onClick: () => toggleShop(key), className: [
                                "text-xs px-2 py-0.5 border flex items-center gap-1.5",
                                on
                                    ? `${c.chip} border-transparent`
                                    : "bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50",
                            ].join(" "), children: [_jsx("span", { className: [
                                        "inline-block w-2 h-2 rounded-full",
                                        on ? c.dot : "bg-zinc-300",
                                    ].join(" ") }), key === UNKNOWN_SHOP ? "Other" : key] }, key));
                    })] })), _jsxs("div", { className: "grid grid-cols-7 border border-zinc-300 bg-white", children: [WEEKDAYS.map((d) => (_jsx("div", { className: "border-b border-zinc-300 px-2 py-1 text-xs text-zinc-500 uppercase tracking-wide", children: d }, d))), grid.map((d) => {
                        const inMonth = d.getMonth() === currentMonth.getMonth();
                        const isToday = sameDay(d, today);
                        const isSelected = sameDay(d, selectedDate);
                        const dayEvents = eventsByDay.get(isoDate(d)) ?? [];
                        // Distinct shops touching this day -> dot row.
                        const dayShops = Array.from(new Set(dayEvents.map((ev) => shopKey(ev.shop))));
                        return (_jsxs("button", { onClick: () => setSelectedDate(d), className: [
                                "min-h-[72px] border-t border-l border-zinc-200 px-2 py-1 text-left flex flex-col",
                                "hover:bg-zinc-50",
                                inMonth ? "bg-white" : "bg-zinc-50 text-zinc-400",
                                isSelected ? "ring-1 ring-inset ring-zinc-900" : "",
                            ].join(" "), children: [_jsx("span", { className: [
                                        "text-xs",
                                        isToday ? "font-semibold text-zinc-900" : "",
                                    ].join(" "), children: d.getDate() }), dayShops.length > 0 && (_jsxs("span", { className: "mt-1 flex flex-wrap gap-1", children: [dayShops.slice(0, 4).map((sk) => {
                                            const c = shopColor(sk === UNKNOWN_SHOP ? null : sk);
                                            return (_jsx("span", { className: [
                                                    "inline-block w-2 h-2 rounded-full",
                                                    c.dot,
                                                ].join(" "), title: sk === UNKNOWN_SHOP ? "Other" : sk }, sk));
                                        }), dayShops.length > 4 && (_jsxs("span", { className: "text-[10px] text-zinc-500", children: ["+", dayShops.length - 4] }))] })), dayEvents.length > 0 && (_jsxs("span", { className: "mt-auto text-[11px] text-zinc-500", children: [dayEvents.length, " ", dayEvents.length === 1 ? "event" : "events"] }))] }, d.toISOString()));
                    })] }), _jsxs("div", { className: "mt-4", children: [_jsx("h2", { className: "text-sm font-semibold mb-2", children: selectedDate.toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                        }) }), loading && _jsx("p", { className: "text-sm text-zinc-500", children: "Loading events\u2026" }), error && (_jsx("p", { className: "text-sm text-red-700 border border-red-300 bg-red-50 p-2", children: error })), !loading && !error && selectedEvents.length === 0 && (_jsx("p", { className: "text-sm text-zinc-500", children: "No events." })), selectedEvents.length > 0 && (_jsx("ul", { className: "border border-zinc-300 divide-y divide-zinc-200 bg-white", children: selectedEvents.map((ev, i) => {
                            const c = shopColor(ev.shop);
                            return (_jsxs("li", { className: "px-3 py-2 flex items-baseline gap-3", children: [_jsx("span", { className: [
                                            "inline-block w-2 h-2 rounded-full mt-1.5 shrink-0",
                                            c.dot,
                                        ].join(" "), title: ev.shop ?? "Other" }), _jsx("span", { className: "text-[11px] uppercase tracking-wide text-zinc-500 w-28 shrink-0", children: EVENT_LABEL[ev.type] }), _jsxs("span", { className: "flex-1 text-sm", children: [ev.title, ev.subtitle && (_jsx("span", { className: "text-xs text-zinc-500 ml-2", children: ev.subtitle }))] }), ev.at && (_jsx("span", { className: "text-xs text-zinc-700 tabular-nums", children: formatTime(ev.at) })), ev.shop && (_jsx("span", { className: [
                                            "text-[11px] px-1.5 py-0.5",
                                            c.chip,
                                        ].join(" "), children: ev.shop }))] }, `${ev.type}-${ev.flash_sale_id ?? ev.library_entry_id ?? ev.order_id ?? ev.edition_id ?? i}`));
                        }) }))] })] }));
}
