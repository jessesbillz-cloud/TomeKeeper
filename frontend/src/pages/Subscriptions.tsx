import { useEffect, useState, type FormEvent } from "react";

import { del, get, patch, post } from "../lib/api";
import type { Subscription } from "../lib/types";

/**
 * Subscriptions page
 *
 * CRUD list for Janelle's recurring book-box / shop subscriptions. Mirrors
 * the editable list pattern used by FlashSales.tsx (sticky header with
 * Save/Cancel, single form for both Add and Edit, optimistic delete).
 *
 * Each row optionally carries "Next box" info written by the daily
 * subscription-watch scheduled function (next_known_release,
 * next_known_title, next_known_notes, last_checked_at). When a website is
 * provided the watcher will visit it and try to surface the next release;
 * if not, those fields stay null and the row just shows the basics.
 */

type Form = {
  provider: string;
  monthly_cost: string; // keep as string so the input doesn't fight users
  renewal_date: string; // YYYY-MM-DD
  website: string;
  notes: string;
};

const EMPTY: Form = {
  provider: "",
  monthly_cost: "",
  renewal_date: "",
  website: "",
  notes: "",
};

const INPUT_DARK =
  "w-full border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1 focus:outline focus:outline-2 focus:outline-pink-400 focus:-outline-offset-1";

function formatMoney(v: string | null): string {
  if (!v) return "";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return `$${n.toFixed(2)}`;
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  // Render YYYY-MM-DD as a friendly local date without timezone games —
  // these are pure DATE columns, so parse the parts directly.
  const [y, m, d] = iso.split("-").map((s) => Number(s));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Best-effort hostname extraction so the row stays compact. */
function prettyUrl(url: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  // null = "Add new". string = "Edit existing row with this id"
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await get<Subscription[]>("/subscriptions?limit=200");
      setSubs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.provider.trim()) {
      setError("Provider is required.");
      return;
    }
    let parsedCost: number | null = null;
    if (form.monthly_cost.trim()) {
      const n = Number(form.monthly_cost);
      if (Number.isNaN(n) || n < 0) {
        setError("Monthly cost must be a non-negative number.");
        return;
      }
      parsedCost = n;
    }
    setSaving(true);
    try {
      const payload = {
        provider: form.provider.trim(),
        monthly_cost: parsedCost,
        renewal_date: form.renewal_date.trim() || null,
        website: form.website.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const updated = await patch<Subscription>(
          `/subscriptions/${editingId}`,
          payload,
        );
        setSubs((prev) =>
          prev.map((s) => (s.id === editingId ? updated : s)),
        );
      } else {
        const created = await post<Subscription>("/subscriptions", payload);
        // Re-sort alphabetically by provider so Add lands in the right spot.
        setSubs((prev) =>
          [...prev, created].sort((a, b) =>
            a.provider.localeCompare(b.provider),
          ),
        );
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

  function startEdit(s: Subscription) {
    setForm({
      provider: s.provider ?? "",
      monthly_cost: s.monthly_cost ?? "",
      renewal_date: s.renewal_date ?? "",
      website: s.website ?? "",
      notes: s.notes ?? "",
    });
    setEditingId(s.id);
    setAdding(true);
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function remove(id: string) {
    const prev = subs;
    setSubs(prev.filter((s) => s.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setAdding(false);
      setForm(EMPTY);
    }
    try {
      await del(`/subscriptions/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSubs(prev);
    }
  }

  const total = subs.reduce((sum, s) => {
    const n = s.monthly_cost ? Number(s.monthly_cost) : 0;
    return Number.isNaN(n) ? sum : sum + n;
  }, 0);

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-black border-b border-zinc-800 flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-pink-200">
          {editingId ? "Edit subscription" : "Subscriptions"}
        </h1>
        <div className="flex gap-2">
          {adding && (
            <button
              type="submit"
              form="subscription-form"
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
            {adding ? "Cancel" : "+ Add subscription"}
          </button>
        </div>
      </div>

      {!adding && subs.length > 0 && (
        <div className="text-xs text-pink-400 mb-2">
          {subs.length} subscription{subs.length === 1 ? "" : "s"} · roughly{" "}
          <span className="text-pink-200">${total.toFixed(2)}</span>/mo
        </div>
      )}

      {adding && (
        <form
          id="subscription-form"
          onSubmit={onSubmit}
          className="card p-3 mb-3 grid grid-cols-2 gap-2 text-sm"
        >
          <label className="block col-span-2">
            <span className="block text-xs text-pink-400">Provider *</span>
            <input
              required
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              placeholder="e.g. Twisted Fiction Book Box"
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Monthly cost</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.monthly_cost}
              onChange={(e) =>
                setForm({ ...form, monthly_cost: e.target.value })
              }
              placeholder="55.00"
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Renewal date</span>
            <input
              type="date"
              value={form.renewal_date}
              onChange={(e) =>
                setForm({ ...form, renewal_date: e.target.value })
              }
              className={INPUT_DARK}
            />
          </label>
          <label className="block col-span-2">
            <span className="block text-xs text-pink-400">
              Website (optional — used to auto-check next box)
            </span>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
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

      {!loading && subs.length === 0 && !adding && (
        <p className="text-sm text-pink-400">
          No subscriptions yet. Click Add subscription above.
        </p>
      )}

      {subs.length > 0 && (
        <div className="card divide-y divide-zinc-800">
          {subs.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2 flex items-start gap-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <div className="font-medium text-pink-200 truncate">
                    {s.provider}
                  </div>
                  {s.monthly_cost && (
                    <div className="text-xs text-pink-300 shrink-0">
                      {formatMoney(s.monthly_cost)}/mo
                    </div>
                  )}
                </div>
                <div className="text-xs text-pink-400 flex flex-wrap gap-x-3">
                  {s.renewal_date && (
                    <span>Renews {formatDay(s.renewal_date)}</span>
                  )}
                  {s.website && (
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-300 underline truncate"
                    >
                      {prettyUrl(s.website)}
                    </a>
                  )}
                </div>
                {s.notes && (
                  <div className="text-xs text-pink-500 truncate">
                    {s.notes}
                  </div>
                )}
                {(s.next_known_release || s.next_known_title) && (
                  <div className="mt-1 text-xs text-pink-300 border-l-2 border-pink-500/60 pl-2">
                    <span className="mr-1">🔮</span>
                    <span className="text-pink-200">
                      {s.next_known_title || "Next box"}
                    </span>
                    {s.next_known_release && (
                      <span className="text-pink-400">
                        {" "}
                        — {formatDay(s.next_known_release)}
                      </span>
                    )}
                    {s.next_known_notes && (
                      <span className="block text-pink-500">
                        {s.next_known_notes}
                      </span>
                    )}
                    {s.last_checked_at && (
                      <span className="block text-pink-500/70 text-[11px]">
                        checked {formatDateTime(s.last_checked_at)}
                      </span>
                    )}
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
