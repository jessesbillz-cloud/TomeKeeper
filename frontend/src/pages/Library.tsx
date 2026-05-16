import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { del, get, patch } from "../lib/api";
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

// Server-side limit for a single search response. The library can hold
// unlimited books — we just never load them all into the browser. If a
// search hits this ceiling we tell the user to refine.
const PAGE_LIMIT = 100;

// The /library edge function now returns each entry with its edition
// and work embedded inline, so a single GET hydrates everything we
// need to render a row.
type LibraryEntryWithEmbeds = LibraryEntry & {
  edition: (Edition & { work: Work | null }) | null;
};

type Row = {
  entry: LibraryEntry;
  edition: Edition | null;
  work: Work | null;
};

function rowFromEmbed(item: LibraryEntryWithEmbeds): Row {
  // Pull the embedded edition + work apart so each shape matches the
  // plain types LibraryRow expects.
  const { edition: embedded, ...entry } = item;
  if (!embedded) {
    return { entry: entry as LibraryEntry, edition: null, work: null };
  }
  const { work, ...edition } = embedded;
  return {
    entry: entry as LibraryEntry,
    edition: edition as Edition,
    work: work ?? null,
  };
}

export function Library() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LibraryStatus | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  // Tracks whether we actually ran a search. Used to distinguish
  // "empty state — type to search" from "we searched and got 0 hits".
  const [hasSearched, setHasSearched] = useState(false);
  const [truncated, setTruncated] = useState(false);

  // Bumped on every status change / remove so the search effect can
  // ignore late responses from cancelled requests.
  const requestSeq = useRef(0);

  /**
   * Run a server-side search. The library can be arbitrarily large
   * (3000+ books), so we never bulk-load — only what matches `q` and/or
   * `statusFilter`, capped at PAGE_LIMIT. The endpoint embeds
   * edition + work in each row so this is a single round trip.
   */
  async function runSearch(q: string, status: LibraryStatus | "all") {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "all") params.set("status_filter", status);
      params.set("limit", String(PAGE_LIMIT));
      const data = await get<LibraryEntryWithEmbeds[]>(
        `/library?${params.toString()}`,
      );
      // Drop the response if a newer search has already been kicked off.
      if (seq !== requestSeq.current) return;
      setRows(data.map(rowFromEmbed));
      setTruncated(data.length >= PAGE_LIMIT);
      setHasSearched(true);
    } catch (e: unknown) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  // Debounced search: refire 300ms after the user stops typing / changes
  // the status filter. If both inputs are empty we clear results and
  // show the prompt-to-search empty state — no fetch at all.
  useEffect(() => {
    const q = query.trim();
    if (!q && statusFilter === "all") {
      requestSeq.current++; // cancel any in-flight
      setRows([]);
      setTruncated(false);
      setHasSearched(false);
      setError(null);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(q, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, statusFilter]);

  async function setStatus(entryId: string, status: LibraryStatus) {
    // Optimistic — flip the chip immediately, then PATCH. If the
    // server rejects we surface the error and re-run the current
    // search to resync.
    setRows((prev) =>
      prev.map((r) =>
        r.entry.id === entryId
          ? { ...r, entry: { ...r.entry, status } }
          : r,
      ),
    );
    try {
      await patch<LibraryEntry>(`/library/${entryId}`, { status });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      void runSearch(query.trim(), statusFilter);
    }
  }

  /**
   * Remove a library entry. Optimistic — drop it from the visible list
   * immediately, then DELETE on the server. If the server rejects the
   * delete (e.g. transient network error) we restore the row so Janelle
   * doesn't lose track of it. Note this only deletes the *library entry*
   * (the "this is in my collection" row); the underlying work + edition
   * stay around so the same book can be re-added later or referenced
   * from drops/calendar events.
   */
  async function removeEntry(entryId: string) {
    const prev = rows;
    setRows(rows.filter((r) => r.entry.id !== entryId));
    setError(null);
    try {
      await del(`/library/${entryId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setRows(prev);
    }
  }

  /**
   * Replace the cached `work` for every row whose edition references the
   * given work id. Called after the inline title-edit form on a row PATCHes
   * /works/{id} so the UI reflects the new title without a full reload.
   */
  function replaceWork(updated: Work) {
    setRows((prev) =>
      prev.map((r) =>
        r.edition?.work_id === updated.id ? { ...r, work: updated } : r,
      ),
    );
  }

  const showingEmptyState =
    !loading && !error && rows.length === 0 && !hasSearched;
  const showingNoResults =
    !loading && !error && rows.length === 0 && hasSearched;

  const statusLabel = useMemo(() => {
    if (statusFilter === "all") return "all statuses";
    return statusFilter.replace("_", " ");
  }, [statusFilter]);

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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, author, or series…"
          className="flex-1 min-w-[200px] border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1 text-sm"
          autoFocus
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as LibraryStatus | "all")
          }
          className="border border-zinc-700 bg-zinc-900 text-pink-100 px-2 py-1 text-sm"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        {(query || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="text-xs border border-zinc-700 text-pink-300 px-2 py-1 hover:bg-zinc-800"
          >
            Clear
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-pink-400">Searching…</p>}
      {error && (
        <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2 mb-3">
          {error}
        </p>
      )}

      {showingEmptyState && (
        <div className="text-sm text-pink-400 border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-1 text-pink-200">Search your library</p>
          <p className="text-xs text-pink-400">
            Type a title, author, or series above — or pick a status to
            browse. Your library isn't loaded into the browser, so it can
            grow as large as you want without slowing this page down.
          </p>
        </div>
      )}

      {showingNoResults && (
        <p className="text-sm text-pink-400">
          No books match{" "}
          {query ? <>“{query}”</> : <>that filter</>} in {statusLabel}.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="text-xs text-pink-400 mb-1">
            {truncated
              ? `Showing first ${PAGE_LIMIT} matches — refine your search to narrow further.`
              : `${rows.length} ${rows.length === 1 ? "result" : "results"}`}
          </div>
          <div className="card divide-y divide-zinc-800">
            {rows.map((row) => (
              <LibraryRow
                key={row.entry.id}
                row={row}
                onSetStatus={(s) => void setStatus(row.entry.id, s)}
                onRemove={() => void removeEntry(row.entry.id)}
                onWorkUpdated={replaceWork}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LibraryRow({
  row,
  onSetStatus,
  onRemove,
  onWorkUpdated,
}: {
  row: Row;
  onSetStatus: (s: LibraryStatus) => void;
  onRemove: () => void;
  onWorkUpdated: (work: Work) => void;
}) {
  const { entry, edition, work } = row;
  const [open, setOpen] = useState(false);

  // Inline title edit. `editingTitle === null` means we're not editing;
  // a string means the input is open and holding the current draft.
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  function confirmRemove() {
    const title = work?.title ?? "this book";
    if (window.confirm(`Remove "${title}" from your library?`)) {
      onRemove();
    }
  }

  async function saveTitle() {
    if (!work || editingTitle === null) return;
    const next = editingTitle.trim();
    if (!next) {
      setTitleError("Title can't be empty.");
      return;
    }
    if (next === work.title) {
      setEditingTitle(null);
      setTitleError(null);
      return;
    }
    setSavingTitle(true);
    setTitleError(null);
    try {
      const updated = await patch<Work>(`/works/${work.id}`, { title: next });
      onWorkUpdated(updated);
      setEditingTitle(null);
    } catch (e: unknown) {
      setTitleError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingTitle(false);
    }
  }

  return (
    <div className="hover:bg-zinc-800/40">
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
          <div className="flex-1 min-w-0">
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

      {open && (
        <div className="px-3 pb-3 pl-12 text-xs text-pink-200 space-y-1">
          {work && (
            <div>
              {editingTitle === null ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTitle(work.title ?? "");
                    setTitleError(null);
                  }}
                  className="text-pink-300 underline text-xs"
                >
                  ✏️ Edit title
                </button>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveTitle();
                        if (e.key === "Escape") {
                          setEditingTitle(null);
                          setTitleError(null);
                        }
                      }}
                      disabled={savingTitle}
                      className="flex-1 min-w-0 border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1 text-sm"
                      placeholder="Book title"
                    />
                    <button
                      type="button"
                      onClick={() => void saveTitle()}
                      disabled={savingTitle}
                      className="text-xs bg-pink-500 text-black px-2 py-1 hover:bg-pink-400 disabled:opacity-50"
                    >
                      {savingTitle ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTitle(null);
                        setTitleError(null);
                      }}
                      disabled={savingTitle}
                      className="text-xs border border-zinc-700 text-pink-300 px-2 py-1 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {titleError && (
                    <div className="text-red-300">{titleError}</div>
                  )}
                </div>
              )}
            </div>
          )}
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
          <div className="pt-1 flex items-center gap-3">
            <Link
              to={`/editions/${entry.edition_id}`}
              className="text-pink-300 underline text-xs"
            >
              Open full details →
            </Link>
            <button
              type="button"
              onClick={confirmRemove}
              className="text-xs border border-red-700 text-red-300 px-2 py-0.5 hover:bg-red-950/40 ml-auto"
            >
              Remove from library
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
