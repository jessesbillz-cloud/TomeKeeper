import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { get, patch } from "../lib/api";
import type {
  Edition,
  LibraryEntry,
  LibraryStatus,
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

type Row = {
  entry: LibraryEntry;
  edition: Edition | null;
  work: Work | null;
};

export function Library() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryStatus | "all">("all");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const entries = await get<LibraryEntry[]>("/library?limit=500");
      const editionIds = Array.from(new Set(entries.map((e) => e.edition_id)));
      const editions = await Promise.all(
        editionIds.map((id) =>
          get<Edition>(`/editions/${id}`).catch(() => null),
        ),
      );
      const editionById = new Map<string, Edition | null>();
      editionIds.forEach((id, i) => editionById.set(id, editions[i]));
      const workIds = Array.from(
        new Set(
          editions.filter((e): e is Edition => !!e).map((e) => e.work_id),
        ),
      );
      const works = await Promise.all(
        workIds.map((id) => get<Work>(`/works/${id}`).catch(() => null)),
      );
      const workById = new Map<string, Work | null>();
      workIds.forEach((id, i) => workById.set(id, works[i]));
      setRows(
        entries.map((entry) => {
          const edition = editionById.get(entry.edition_id) ?? null;
          const work = edition ? workById.get(edition.work_id) ?? null : null;
          return { entry, edition, work };
        }),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(entryId: string, status: LibraryStatus) {
    setRows((prev) =>
      prev.map((r) =>
        r.entry.id === entryId ? { ...r, entry: { ...r.entry, status } } : r,
      ),
    );
    try {
      await patch<LibraryEntry>(`/library/${entryId}`, { status });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      void load();
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.entry.status !== filter) return false;
      if (!q) return true;
      const hay = [
        r.work?.title,
        r.work?.author,
        r.work?.series,
        r.edition?.edition_name,
        r.edition?.publisher_or_shop,
        r.edition?.retailer,
        r.entry.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of STATUS_OPTIONS) c[s] = 0;
    for (const r of rows) c[r.entry.status] = (c[r.entry.status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-pink-200">Library</h1>
        <Link
          to="/capture"
          className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
        >
          + Add edition
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Chip
          on={filter === "all"}
          onClick={() => setFilter("all")}
          label={`All (${counts.all})`}
        />
        {STATUS_OPTIONS.map((s) => (
          <Chip
            key={s}
            on={filter === s}
            onClick={() => setFilter(s)}
            label={`${s.replace("_", " ")} (${counts[s] ?? 0})`}
            chipClass={STATUS_CHIP[s]}
          />
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, author, shop…"
          className="ml-auto border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1 text-sm w-64"
        />
      </div>

      {loading && <p className="text-sm text-pink-400">Loading…</p>}
      {error && (
        <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2 mb-3">
          {error}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-pink-400">
          {rows.length === 0
            ? "No editions yet. Click Add edition to capture your first."
            : "Nothing matches that filter."}
        </p>
      )}

      {filtered.length > 0 && (
        <div className="card divide-y divide-zinc-800">
          {filtered.map((row) => (
            <LibraryRow
              key={row.entry.id}
              row={row}
              onSetStatus={(s) => void setStatus(row.entry.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryRow({
  row,
  onSetStatus,
}: {
  row: Row;
  onSetStatus: (s: LibraryStatus) => void;
}) {
  const { entry, edition, work } = row;
  const [open, setOpen] = useState(false);

  return (
    <div className="hover:bg-zinc-800/40">
      {/* Collapsed header — clickable area toggles open. The status select
          and detail link sit outside the clickable region so they don't
          accidentally toggle when used. */}
      <div className="px-3 py-2 flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-start gap-3 flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <span
            className={[
              "mt-2 inline-block transition-transform shrink-0 text-pink-400",
              open ? "rotate-90" : "",
            ].join(" ")}
            aria-hidden
          >
            ▸
          </span>
          <div className="w-10 h-14 bg-zinc-800 border border-zinc-700 shrink-0 overflow-hidden">
            {edition?.cover_url && (
              <img
                src={edition.cover_url}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {/* Title — full, wrapping; never truncated. */}
            <div className="text-sm font-medium text-pink-200 break-words">
              {work?.title ?? "Unknown title"}
              {work?.series && (
                <span className="text-pink-400 font-normal">
                  {" "}
                  — {work.series}
                  {work.series_number != null && ` #${work.series_number}`}
                </span>
              )}
            </div>
            {work?.author && (
              <div className="text-xs text-pink-300 break-words">
                {work.author}
              </div>
            )}
          </div>
        </button>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <select
            value={entry.status}
            onChange={(e) => onSetStatus(e.target.value as LibraryStatus)}
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
          {edition?.release_date && (
            <span className="text-[11px] text-pink-400 tabular-nums">
              {edition.release_date}
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="px-3 pb-3 pl-12 text-xs text-pink-200 space-y-1">
          {edition?.edition_name && (
            <div>
              <span className="text-pink-400">Edition: </span>
              {edition.edition_name}
            </div>
          )}
          {edition?.publisher_or_shop && (
            <div>
              <span className="text-pink-400">Shop: </span>
              {edition.publisher_or_shop}
            </div>
          )}
          {edition?.retailer && (
            <div>
              <span className="text-pink-400">Retailer: </span>
              {edition.retailer}
            </div>
          )}
          {edition?.isbn && (
            <div>
              <span className="text-pink-400">ISBN: </span>
              {edition.isbn}
            </div>
          )}
          {edition?.special_features && (
            <div>
              <span className="text-pink-400">Features: </span>
              {edition.special_features}
            </div>
          )}
          {entry.condition && (
            <div>
              <span className="text-pink-400">Condition: </span>
              {entry.condition}
            </div>
          )}
          {entry.purchase_price && (
            <div>
              <span className="text-pink-400">Paid: </span>
              {entry.purchase_price}
            </div>
          )}
          {entry.notes && (
            <div className="text-pink-300 break-words">
              <span className="text-pink-400">Notes: </span>
              {entry.notes}
            </div>
          )}
          <div className="pt-1">
            <Link
              to={`/editions/${entry.edition_id}`}
              className="text-pink-300 underline text-xs"
            >
              Open full details →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  on,
  onClick,
  label,
  chipClass,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  chipClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "text-xs px-2 py-0.5 border",
        on
          ? chipClass
            ? `${chipClass} border-transparent`
            : "border-pink-400 bg-pink-500 text-black"
          : "bg-zinc-900 text-pink-300 border-zinc-700 hover:bg-zinc-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
