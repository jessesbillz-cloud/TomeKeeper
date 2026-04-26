import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { del, get, patch, post } from "../lib/api";
import type {
  Edition,
  LibraryEntry,
  LibraryStatus,
  Order,
  Work,
} from "../lib/types";

const STATUS_OPTIONS: LibraryStatus[] = [
  "upcoming",
  "ordered",
  "shipped",
  "owned",
  "for_sale",
  "sold",
  "missed",
];

const STATUS_CHIP: Record<LibraryStatus, string> = {
  upcoming: "bg-amber-900/60 text-amber-200",
  ordered: "bg-sky-900/60 text-sky-200",
  shipped: "bg-violet-900/60 text-violet-200",
  owned: "bg-emerald-900/60 text-emerald-200",
  for_sale: "bg-fuchsia-900/60 text-fuchsia-200",
  sold: "bg-zinc-800 text-pink-300",
  missed: "bg-rose-900/60 text-rose-200",
};

const INPUT_DARK =
  "w-full border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1 text-sm focus:outline focus:outline-2 focus:outline-pink-400 focus:-outline-offset-1";

export function EditionDetail() {
  const { id } = useParams<{ id: string }>();
  const [edition, setEdition] = useState<Edition | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable buffer for the (single) library entry, if it exists.
  const entry = entries[0] ?? null;
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const ed = await get<Edition>(`/editions/${id}`);
        if (cancelled) return;
        setEdition(ed);
        const [wk, libs] = await Promise.all([
          get<Work>(`/works/${ed.work_id}`).catch(() => null),
          get<LibraryEntry[]>(`/library?edition_id=${id}`).catch(
            () => [] as LibraryEntry[],
          ),
        ]);
        if (cancelled) return;
        setWork(wk);
        setEntries(libs);
        setNotes(libs[0]?.notes ?? "");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function setStatus(s: LibraryStatus) {
    if (!entry) return;
    setEntries((prev) => prev.map((e) => ({ ...e, status: s })));
    try {
      await patch<LibraryEntry>(`/library/${entry.id}`, { status: s });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveNotes() {
    if (!entry) return;
    setSavingNotes(true);
    try {
      const updated = await patch<LibraryEntry>(`/library/${entry.id}`, {
        notes: notes.trim() === "" ? null : notes,
      });
      setEntries([updated, ...entries.slice(1)]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingNotes(false);
    }
  }

  const meta = useMemo(() => {
    if (!edition) return [] as Array<[string, string | null | undefined]>;
    return [
      ["Edition", edition.edition_name],
      ["Publisher / shop", edition.publisher_or_shop],
      ["Retailer", edition.retailer],
      ["Release date", edition.release_date],
      ["Edition size", edition.edition_size?.toString() ?? null],
      ["ISBN", edition.isbn],
      ["Special features", edition.special_features],
    ];
  }, [edition]);

  if (loading && !edition) {
    return <p className="text-sm text-pink-400">Loading…</p>;
  }
  if (error && !edition) {
    return (
      <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2">
        {error}
      </p>
    );
  }
  if (!edition) {
    return <p className="text-sm text-pink-400">Not found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="text-xs">
        <Link to="/library" className="text-pink-400 hover:underline">
          ← Back to library
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="w-32 h-44 bg-zinc-800 border border-zinc-700 shrink-0 overflow-hidden shadow-[0_4px_18px_rgba(255,255,255,0.08)]">
          {edition.cover_url && (
            <img
              src={edition.cover_url}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-pink-200">
            {work?.title ?? "Untitled"}
          </h1>
          {work?.author && (
            <p className="text-sm text-pink-300">{work.author}</p>
          )}
          {work?.series && (
            <p className="text-xs text-pink-400">
              {work.series}
              {work.series_number != null && ` #${work.series_number}`}
            </p>
          )}
          {entry && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-pink-400">Status:</span>
              <select
                value={entry.status}
                onChange={(e) => void setStatus(e.target.value as LibraryStatus)}
                className={[
                  "text-xs px-1.5 py-0.5 border border-transparent",
                  STATUS_CHIP[entry.status],
                ].join(" ")}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="bg-zinc-900 text-pink-100">
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2">
          {error}
        </p>
      )}

      <div className="card">
        <div className="px-3 py-2 border-b border-zinc-800 text-xs uppercase tracking-wide text-pink-400">
          Edition details
        </div>
        <dl className="divide-y divide-zinc-800">
          {meta.map(([k, v]) => (
            <div key={k} className="px-3 py-1.5 flex text-sm">
              <dt className="w-40 text-pink-400 shrink-0">{k}</dt>
              <dd className="flex-1 text-pink-200">
                {v || <span className="text-pink-500/60">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {edition && <OrdersPanel editionId={edition.id} />}

      {entry && (
        <div className="card">
          <div className="px-3 py-2 border-b border-zinc-800 text-xs uppercase tracking-wide text-pink-400">
            Your copy
          </div>
          <dl className="divide-y divide-zinc-800">
            <Row label="Condition" value={entry.condition} />
            <Row label="Purchase price" value={entry.purchase_price} />
            <Row label="Sale price" value={entry.sale_price} />
            <Row
              label="Status changed"
              value={new Date(entry.status_changed_at).toLocaleString()}
            />
          </dl>
          <div className="px-3 py-2 border-t border-zinc-800">
            <label className="block text-xs text-pink-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={INPUT_DARK}
            />
            <div className="mt-2">
              <button
                onClick={() => void saveNotes()}
                disabled={savingNotes || notes === (entry.notes ?? "")}
                className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400 disabled:opacity-50"
              >
                {savingNotes ? "Saving…" : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="px-3 py-1.5 flex text-sm">
      <dt className="w-40 text-pink-400 shrink-0">{label}</dt>
      <dd className="flex-1 text-pink-200">
        {value || <span className="text-pink-500/60">—</span>}
      </dd>
    </div>
  );
}

type OrderForm = {
  vendor: string;
  order_date: string;
  ship_date: string;
  delivery_date: string;
  tracking_number: string;
};

const EMPTY_ORDER: OrderForm = {
  vendor: "",
  order_date: "",
  ship_date: "",
  delivery_date: "",
  tracking_number: "",
};

function OrdersPanel({ editionId }: { editionId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<OrderForm>(EMPTY_ORDER);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await get<Order[]>(`/orders?edition_id=${editionId}`);
      setOrders(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const created = await post<Order>("/orders", {
        edition_id: editionId,
        vendor: form.vendor.trim() || null,
        order_date: form.order_date || null,
        ship_date: form.ship_date || null,
        delivery_date: form.delivery_date || null,
        tracking_number: form.tracking_number.trim() || null,
      });
      setOrders((prev) => [...prev, created]);
      setForm(EMPTY_ORDER);
      setAdding(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function patchOrder(id: string, patchBody: Partial<OrderForm>) {
    try {
      const updated = await patch<Order>(`/orders/${id}`, {
        vendor: patchBody.vendor ?? undefined,
        order_date: patchBody.order_date || null,
        ship_date: patchBody.ship_date || null,
        delivery_date: patchBody.delivery_date || null,
        tracking_number: patchBody.tracking_number ?? undefined,
      });
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeOrder(id: string) {
    const prev = orders;
    setOrders(prev.filter((o) => o.id !== id));
    try {
      await del(`/orders/${id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setOrders(prev);
    }
  }

  return (
    <div className="card">
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center">
        <span className="text-xs uppercase tracking-wide text-pink-400">
          Orders & shipping
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto text-xs border border-zinc-700 text-pink-300 px-2 py-0.5 hover:bg-zinc-800"
        >
          {adding ? "Cancel" : "+ Add order"}
        </button>
      </div>

      {err && (
        <p className="text-sm text-red-300 border-b border-red-800 bg-red-950/40 p-2">
          {err}
        </p>
      )}

      {loading && (
        <p className="text-sm text-pink-400 px-3 py-2">Loading orders…</p>
      )}

      {!loading && orders.length === 0 && !adding && (
        <p className="text-sm text-pink-400 px-3 py-2">
          No orders logged for this edition yet.
        </p>
      )}

      {orders.length > 0 && (
        <div className="divide-y divide-zinc-800">
          {orders.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              onPatch={(p) => void patchOrder(o.id, p)}
              onDelete={() => void removeOrder(o.id)}
            />
          ))}
        </div>
      )}

      {adding && (
        <form
          onSubmit={onAdd}
          className="border-t border-zinc-800 p-3 grid grid-cols-2 gap-2 text-sm"
        >
          <label className="block">
            <span className="block text-xs text-pink-400">Vendor</span>
            <input
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Tracking #</span>
            <input
              value={form.tracking_number}
              onChange={(e) =>
                setForm({ ...form, tracking_number: e.target.value })
              }
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Order date</span>
            <input
              type="date"
              value={form.order_date}
              onChange={(e) => setForm({ ...form, order_date: e.target.value })}
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Ship date</span>
            <input
              type="date"
              value={form.ship_date}
              onChange={(e) => setForm({ ...form, ship_date: e.target.value })}
              className={INPUT_DARK}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-pink-400">Delivery date</span>
            <input
              type="date"
              value={form.delivery_date}
              onChange={(e) =>
                setForm({ ...form, delivery_date: e.target.value })
              }
              className={INPUT_DARK}
            />
          </label>
          <div className="col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save order"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function OrderRow({
  order,
  onPatch,
  onDelete,
}: {
  order: Order;
  onPatch: (p: Partial<OrderForm>) => void;
  onDelete: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<OrderForm>({
    vendor: order.vendor ?? "",
    order_date: order.order_date ?? "",
    ship_date: order.ship_date ?? "",
    delivery_date: order.delivery_date ?? "",
    tracking_number: order.tracking_number ?? "",
  });

  if (!edit) {
    return (
      <div className="px-3 py-2 text-sm flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-pink-200">
            {order.vendor || <span className="text-pink-500/60">No vendor</span>}
          </div>
          <div className="text-xs text-pink-400 flex gap-3 flex-wrap">
            {order.order_date && <span>Ordered {order.order_date}</span>}
            {order.ship_date && <span>Shipped {order.ship_date}</span>}
            {order.delivery_date && (
              <span>Delivered {order.delivery_date}</span>
            )}
            {order.tracking_number && (
              <span>Tracking {order.tracking_number}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setEdit(true)}
          className="text-xs border border-zinc-700 text-pink-300 px-2 py-0.5 hover:bg-zinc-800"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="text-xs border border-zinc-700 text-pink-300 px-2 py-0.5 hover:bg-zinc-800"
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 grid grid-cols-2 gap-2 text-sm">
      <label className="block">
        <span className="block text-xs text-pink-400">Vendor</span>
        <input
          value={form.vendor}
          onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          className={INPUT_DARK}
        />
      </label>
      <label className="block">
        <span className="block text-xs text-pink-400">Tracking #</span>
        <input
          value={form.tracking_number}
          onChange={(e) =>
            setForm({ ...form, tracking_number: e.target.value })
          }
          className={INPUT_DARK}
        />
      </label>
      <label className="block">
        <span className="block text-xs text-pink-400">Order date</span>
        <input
          type="date"
          value={form.order_date}
          onChange={(e) => setForm({ ...form, order_date: e.target.value })}
          className={INPUT_DARK}
        />
      </label>
      <label className="block">
        <span className="block text-xs text-pink-400">Ship date</span>
        <input
          type="date"
          value={form.ship_date}
          onChange={(e) => setForm({ ...form, ship_date: e.target.value })}
          className={INPUT_DARK}
        />
      </label>
      <label className="block col-span-2">
        <span className="block text-xs text-pink-400">Delivery date</span>
        <input
          type="date"
          value={form.delivery_date}
          onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
          className={INPUT_DARK}
        />
      </label>
      <div className="col-span-2 flex gap-2">
        <button
          onClick={() => {
            onPatch(form);
            setEdit(false);
          }}
          className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
        >
          Save
        </button>
        <button
          onClick={() => setEdit(false)}
          className="border border-zinc-700 text-pink-300 px-3 py-1 text-sm hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
