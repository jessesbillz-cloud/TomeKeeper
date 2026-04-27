import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { del, get, post } from "../lib/api";
import type { PublisherSalesEvent } from "../lib/types";

type Form = {
  publisher: string;
  title: string;
  url: string;
  starts_at: string;
  ends_at: string;
  notes: string;
};

const EMPTY: Form = {
  publisher: "",
  title: "",
  url: "",
  starts_at: "",
  ends_at: "",
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

export function PublisherSalesEvents() {
  const [searchParams] = useSearchParams();
  const initialStarts = searchParams.get("starts") ?? "";

  const [events, setEvents] = useState<PublisherSalesEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(() =>
    initialStarts
      ? {
          ...EMPTY,
          // Default to a multi-day window: starts at 00:00, ends a week later
          starts_at: `${initialStarts}T00:00`,
          ends_at: `${initialStarts}T23:59`,
        }
      : EMPTY,
  );
  const [adding, setAdding] = useState(Boolean(initialStarts));
  const [saving, setSaving] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const path = showActiveOnly
        ? "/publisher-sales-events?active_only=true&limit=200"
        : "/publisher-sales-events?limit=200";
      const data = await get<PublisherSalesEvent[]>(path);
      setEvents(data);
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

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.publisher.trim()) {
      setError("Publisher is required.");
      return;
    }
    const startsISO = toISO(form.starts_at);
    const endsISO = toISO(form.ends_at);
    if (!startsISO || !endsISO) {
      setError("Both start and end times are required.");
      return;
    }
    if (new Date(endsISO) < new Date(startsISO)) {
      setError("End must be after start.");
      return;
    }
    setSaving(true);
    try {
      const created = await post<PublisherSalesEvent>(
        "/publisher-sales-events",
        {
          publisher: form.publisher.trim(),
          title: form.title.trim() || null,
          url: form.url.trim() || null,
          edition_id: null,
          starts_at: startsISO,
          ends_at: endsISO,
          notes: form.notes.trim() || null,
        },
      );
      setEvents((prev) => [created, ...prev]);
      setForm(EMPTY);
      setAdding(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const prev = events;
    setEvents(prev.filter((s) => s.id !== id));
    try {
      await del(`/publisher-sales-events/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setEvents(prev);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-pink-200">
          Publisher sales events
        </h1>
        <button
          onClick={() => setAdding((v) => !v)}
          className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
        >
          {adding ? "Cancel" : "+ Add event"}
        </button>
      </div>

      <p className="text-xs text-pink-400 mb-3">
        Multi-day publisher promotions (e.g. spring sale, holiday window).
        These show on your calendar with start &amp; end markers and sync to
        your subscribed iCal feed.
      </p>

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
          onSubmit={onAdd}
          className="card p-3 mb-3 grid grid-cols-2 gap-2 text-sm"
        >
          <label className="block">
            <span className="block text-xs text-pink-400">Publisher *</span>
            <input
              required
              value={form.publisher}
              onChange={(e) => setForm({ ...form, publisher: e.target.value })}
              placeholder="e.g. Illumicrate"
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Spring sale"
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Starts *</span>
            <input
              type="datetime-local"
              required
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Ends *</span>
            <input
              type="datetime-local"
              required
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              className={INPUT_DARK}
            />
          </label>
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

      {!loading && events.length === 0 && !adding && (
        <p className="text-sm text-pink-400">
          No publisher sales events yet. Click + Add event above.
        </p>
      )}

      {events.length > 0 && (
        <div className="card divide-y divide-zinc-800">
          {events.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2 flex items-center gap-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-pink-200">
                  {s.title ?? s.publisher}
                </div>
                <div className="text-xs text-pink-400 flex flex-wrap gap-x-3">
                  <span>{s.publisher}</span>
                  <span>
                    {fromISO(s.starts_at).replace("T", " ")} →{" "}
                    {fromISO(s.ends_at).replace("T", " ")}
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
              <button
                onClick={() => void remove(s.id)}
                className="text-xs border border-zinc-700 text-pink-300 px-2 py-0.5 hover:bg-zinc-800"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
