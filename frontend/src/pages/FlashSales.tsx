import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { del, get, patch, post } from "../lib/api";
import type { FlashSale } from "../lib/types";

type Form = {
  shop: string;
  title: string;
  url: string;
  /** ISO local datetime string `YYYY-MM-DDTHH:MM` (datetime-local). */
  starts_at: string;
  /** ISO local datetime string `YYYY-MM-DDTHH:MM` (datetime-local). */
  ends_at: string;
  /** YYYY-MM-DD when in `all_day` mode — the single calendar day the sale runs. */
  day: string;
  /** When true, hide the time pickers and treat the sale as a 1-day event
   *  that runs from local midnight to 23:59:59 on `day`. This avoids the
   *  "ends tomorrow" bleed Janelle was hitting when she set an evening end
   *  time and the UTC date rolled over. */
  all_day: boolean;
  notes: string;
};

const EMPTY: Form = {
  shop: "",
  title: "",
  url: "",
  starts_at: "",
  ends_at: "",
  day: "",
  all_day: false,
  notes: "",
};

const INPUT_DARK =
  "w-full border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1 focus:outline focus:outline-2 focus:outline-pink-400 focus:-outline-offset-1";

function toISO(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fromISO(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Display formatter — `Mon DD, H:MM AM/PM` in the user's local
 * timezone (e.g. "May 15, 2:00 PM"). Year is intentionally dropped
 * so the row stays compact and matches the calendar day-detail
 * panel byte-for-byte.
 */
function fromISODisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Strip the time component of a datetime-local string -> "YYYY-MM-DD". */
function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Heuristic: a saved row is a "1-day sale" if both the start and the end
 * fall on the same local calendar day AND the start is at/very near
 * 00:00 and the end is at/very near 23:59. We surface that in the Edit
 * form by pre-checking the all_day toggle.
 */
function looksAllDay(s: FlashSale): boolean {
  const a = new Date(s.starts_at);
  const b = new Date(s.ends_at);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  const sameDay =
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (!sameDay) return false;
  const startMins = a.getHours() * 60 + a.getMinutes();
  const endMins = b.getHours() * 60 + b.getMinutes();
  return startMins <= 5 && endMins >= 23 * 60 + 55;
}

export function FlashSales() {
  const [searchParams] = useSearchParams();
  const initialStarts = searchParams.get("starts") ?? "";
  const highlightId = searchParams.get("id");

  const [sales, setSales] = useState<FlashSale[]>([]);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(() =>
    initialStarts
      ? {
          ...EMPTY,
          // Default a Home-quick-add to an all-day single-date sale on the
          // selected day so the user gets the no-bleed behavior by default.
          all_day: true,
          day: initialStarts,
          starts_at: `${initialStarts}T12:00`,
          ends_at: `${initialStarts}T20:00`,
        }
      : EMPTY,
  );
  // null = "Add new". string = "Edit existing row with this id" — adding/
  // editing share the same form so the same Save flow works for both.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(Boolean(initialStarts));
  const [saving, setSaving] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const path = showActiveOnly
        ? "/flash-sales?active_only=true&limit=200"
        : "/flash-sales?limit=200";
      const data = await get<FlashSale[]>(path);
      setSales(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showActiveOnly]);

  // After data loads, if we arrived with ?id=<flash_sale_id> (e.g. by
  // tapping the flash-sale event on the home calendar), scroll that row
  // into view. The row's CSS handles the brief highlight ring.
  useEffect(() => {
    if (!highlightId || sales.length === 0) return;
    const el = rowRefs.current.get(highlightId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, sales]);

  /**
   * Build the timestamps to POST/PATCH from the current form state. In
   * `all_day` mode we ignore the time pickers and synthesize a local
   * 00:00 -> 23:59:59.999 window on `day`, which lands on a single day
   * in the user's local timezone (and therefore on a single calendar
   * cell, no bleed).
   */
  function resolveTimestamps(): { startsISO: string; endsISO: string } | null {
    if (form.all_day) {
      const day = form.day;
      if (!day) return null;
      const startLocal = `${day}T00:00:00`;
      const endLocal = `${day}T23:59:59.999`;
      const a = new Date(startLocal);
      const b = new Date(endLocal);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
      return { startsISO: a.toISOString(), endsISO: b.toISOString() };
    }
    const startsISO = toISO(form.starts_at);
    const endsISO = toISO(form.ends_at);
    if (!startsISO || !endsISO) return null;
    return { startsISO, endsISO };
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.shop.trim()) {
      setError("Shop is required.");
      return;
    }
    const ts = resolveTimestamps();
    if (!ts) {
      setError(
        form.all_day
          ? "Pick the day the sale runs."
          : "Both start and end times are required.",
      );
      return;
    }
    if (new Date(ts.endsISO) < new Date(ts.startsISO)) {
      setError("End must be after start.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        shop: form.shop.trim(),
        title: form.title.trim() || null,
        url: form.url.trim() || null,
        starts_at: ts.startsISO,
        ends_at: ts.endsISO,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const updated = await patch<FlashSale>(
          `/flash-sales/${editingId}`,
          payload,
        );
        setSales((prev) =>
          prev.map((s) => (s.id === editingId ? updated : s)),
        );
      } else {
        const created = await post<FlashSale>("/flash-sales", {
          ...payload,
          edition_id: null,
        });
        setSales((prev) => [created, ...prev]);
      }
      setForm(EMPTY);
      setAdding(false);
      setEditingId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  /** Open the form prefilled with an existing row so it can be edited. */
  function startEdit(s: FlashSale) {
    const allDay = looksAllDay(s);
    const startsLocal = fromISO(s.starts_at);
    setForm({
      shop: s.shop ?? "",
      title: s.title ?? "",
      url: s.url ?? "",
      starts_at: startsLocal,
      ends_at: fromISO(s.ends_at),
      day: allDay ? localDay(s.starts_at) : "",
      all_day: allDay,
      notes: s.notes ?? "",
    });
    setEditingId(s.id);
    setAdding(true);
    // Scroll the form into view so the user sees the prefilled fields.
    queueMicrotask(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  async function remove(id: string) {
    const prev = sales;
    setSales(prev.filter((s) => s.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setAdding(false);
      setForm(EMPTY);
    }
    try {
      await del(`/flash-sales/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSales(prev);
    }
  }

  return (
    <div>
      {/* Sticky page header. When the iOS datetime-local picker pops up it
          covers the bottom half of the viewport — by sticking this row to
          the top, the Save button (mounted here when the form is open)
          stays tappable regardless of which input is focused or how far
          the user has scrolled inside the form. */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-black border-b border-zinc-800 flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-pink-200">
          {editingId ? "Edit flash sale" : "Flash sales"}
        </h1>
        <div className="flex gap-2">
          {adding && (
            <button
              type="submit"
              form="flash-sale-form"
              disabled={saving}
              className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          <button
            onClick={() => {
              if (adding) {
                setAdding(false);
                setEditingId(null);
                setForm(EMPTY);
              } else {
                setAdding(true);
              }
            }}
            className={[
              "px-3 py-1 text-sm",
              adding
                ? "border border-zinc-700 text-pink-300 hover:bg-zinc-800"
                : "bg-pink-500 text-black hover:bg-pink-400",
            ].join(" ")}
          >
            {adding ? "Cancel" : "+ Add flash sale"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowActiveOnly(false)}
          className={[
            "text-xs px-2 py-0.5 border",
            !showActiveOnly
              ? "border-pink-400 bg-pink-500 text-black"
              : "bg-zinc-900 text-pink-300 border-zinc-700 hover:bg-zinc-800",
          ].join(" ")}
        >
          All
        </button>
        <button
          onClick={() => setShowActiveOnly(true)}
          className={[
            "text-xs px-2 py-0.5 border",
            showActiveOnly
              ? "border-pink-400 bg-pink-500 text-black"
              : "bg-zinc-900 text-pink-300 border-zinc-700 hover:bg-zinc-800",
          ].join(" ")}
        >
          Active now
        </button>
      </div>

      {adding && (
        <form
          id="flash-sale-form"
          onSubmit={onAdd}
          className="card p-3 mb-3 grid grid-cols-2 gap-2 text-sm"
        >
          <label className="block">
            <span className="block text-xs text-pink-400">Shop *</span>
            <input
              required
              value={form.shop}
              onChange={(e) => setForm({ ...form, shop: e.target.value })}
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={INPUT_DARK}
            />
          </label>
          {/* Single-day toggle — when ON, the sale is treated as one
              calendar day (midnight to 23:59 in the user's local time)
              and shows up on a single day on the calendar. */}
          <label className="col-span-2 flex items-center gap-2 text-xs text-pink-300">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => {
                const next = e.target.checked;
                setForm((f) => {
                  if (next) {
                    // Switching to all-day: prefer the date out of starts_at if
                    // we have one, else today.
                    const day =
                      f.day ||
                      (f.starts_at ? f.starts_at.slice(0, 10) : "") ||
                      new Date().toISOString().slice(0, 10);
                    return { ...f, all_day: true, day };
                  }
                  // Switching off all-day: seed start/end from the day so the
                  // user doesn't see two empty time pickers.
                  if (f.day && !f.starts_at) {
                    return {
                      ...f,
                      all_day: false,
                      starts_at: `${f.day}T12:00`,
                      ends_at: `${f.day}T20:00`,
                    };
                  }
                  return { ...f, all_day: false };
                });
              }}
              className="accent-pink-500"
            />
            <span>1-day sale (no times — runs for that whole day)</span>
          </label>
          {form.all_day ? (
            <label className="block col-span-2">
              <span className="block text-xs text-pink-400">Day *</span>
              <input
                type="date"
                required
                value={form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value })}
                className={INPUT_DARK}
              />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="block text-xs text-pink-400">Starts *</span>
                <input
                  type="datetime-local"
                  required
                  value={form.starts_at}
                  onChange={(e) =>
                    setForm({ ...form, starts_at: e.target.value })
                  }
                  className={INPUT_DARK}
                />
              </label>
              <label className="block">
                <span className="block text-xs text-pink-400">Ends *</span>
                <input
                  type="datetime-local"
                  required
                  value={form.ends_at}
                  onChange={(e) =>
                    setForm({ ...form, ends_at: e.target.value })
                  }
                  className={INPUT_DARK}
                />
              </label>
            </>
          )}
          <label className="block col-span-2">
            <span className="block text-xs text-pink-400">URL</span>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
              className={INPUT_DARK}
            />
          </label>
          <label className="block col-span-2">
            <span className="block text-xs text-pink-400">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className={INPUT_DARK}
            />
          </label>
          <div className="col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2 mb-3">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-pink-400">Loading…</p>}

      {!loading && sales.length === 0 && !adding && (
        <p className="text-sm text-pink-400">
          No flash sales logged yet. Click Add flash sale above.
        </p>
      )}

      {sales.length > 0 && (
        <div className="card divide-y divide-zinc-800">
          {sales.map((s) => (
            <div
              key={s.id}
              ref={(el) => {
                if (el) rowRefs.current.set(s.id, el);
                else rowRefs.current.delete(s.id);
              }}
              className={[
                "px-3 py-2 flex items-center gap-3 text-sm",
                highlightId === s.id
                  ? "ring-2 ring-pink-400 ring-inset bg-zinc-900"
                  : "",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-pink-200">{s.title ?? s.shop}</div>
                <div className="text-xs text-pink-400 flex flex-wrap gap-x-3">
                  <span>{s.shop}</span>
                  <span>
                    {fromISODisplay(s.starts_at)} →{" "}
                    {fromISODisplay(s.ends_at)}
                  </span>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-300 underline"
                    >
                      link
                    </a>
                  )}
                </div>
                {s.notes && (
                  <div className="text-xs text-pink-500 truncate">
                    {s.notes}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(s)}
                  className="text-xs border border-pink-400 text-pink-200 px-2 py-0.5 hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => void remove(s.id)}
                  className="text-xs border border-zinc-700 text-pink-300 px-2 py-0.5 hover:bg-zinc-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
