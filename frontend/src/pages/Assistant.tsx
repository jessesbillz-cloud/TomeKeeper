import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ProcessingBanner } from "../components/ProcessingBanner";
import {
  bulkSavePlan,
  enrichLibraryBooks,
  extractPlan,
  type AssistantPlan,
  type DropPlan,
  type LibraryBookPlan,
} from "../lib/assistant";
import { fileToScanDataUrl } from "../lib/imageResize";

/**
 * Book Assistant page — the universal "add stuff to TomeKeeper" entry
 * point. Replaces the old single-screenshot flow. Three input zones:
 *   1. Free-form text (paste a post or describe an event)
 *   2. Multi-image picker (screenshots, cover photos, or both)
 *   3. Mode: "Auto" (calendar drops + library books mixed) or
 *      "Library backfill" (lean toward cataloging owned books)
 *
 * Submission:
 *   - Resize each image client-side for vision.
 *   - Batch images in chunks of 6 — vision quality drops with too many
 *     images per request and Janelle may upload hundreds at once.
 *   - For each batch, POST /assistant-extract with the same text/mode/tz.
 *   - Accumulate drops[] + library_books[] across batches into a single
 *     plan, then run ISBN enrichment for any library_books that have
 *     ISBNs but missing fields.
 *   - Show a review panel where Janelle can skip individual items, then
 *     hit "Add all" to bulk-save.
 */

const BATCH_SIZE = 6;
const INPUT_BASE =
  "w-full border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-pink-400 focus:-outline-offset-1";

type StagedImage = {
  id: string;
  data_url: string;
  preview_url: string;
  fileName: string;
};

export function Assistant() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [images, setImages] = useState<StagedImage[]>([]);
  const [mode, setMode] = useState<"auto" | "library_backfill">("auto");

  const [working, setWorking] = useState(false);
  const [bannerStatus, setBannerStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [skipDrops, setSkipDrops] = useState<Set<number>>(new Set());
  const [skipBooks, setSkipBooks] = useState<Set<number>>(new Set());

  const tz = useMemo(
    () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
    [],
  );

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    setBannerStatus(`Resizing ${files.length} image${files.length === 1 ? "" : "s"}…`);
    try {
      const staged: StagedImage[] = [];
      for (const file of files) {
        const data_url = await fileToScanDataUrl(file);
        staged.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          data_url,
          preview_url: data_url,
          fileName: file.name,
        });
      }
      setImages((prev) => [...prev, ...staged]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBannerStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function clearStaging() {
    setImages([]);
    setText("");
  }

  async function onExtract() {
    setError(null);
    if (!text.trim() && images.length === 0) {
      setError("Add some text or upload at least one image first.");
      return;
    }
    setWorking(true);
    try {
      const accumulated: AssistantPlan = {
        drops: [],
        library_books: [],
        questions: [],
        summary: "",
      };
      // Batch images so the vision model isn't asked to chew on dozens
      // at once. Text is sent only with the first batch — it's context
      // about everything, not per-batch.
      const batches: Array<Array<{ data_url: string }>> =
        images.length === 0
          ? [[]]
          : chunk(
              images.map((img) => ({ data_url: img.data_url })),
              BATCH_SIZE,
            );
      for (let bi = 0; bi < batches.length; bi++) {
        setBannerStatus(
          batches.length > 1
            ? `Reading batch ${bi + 1} of ${batches.length}…`
            : "Reading your input…",
        );
        const batch = batches[bi];
        const resp = await extractPlan({
          text: bi === 0 ? text : "",
          images: batch,
          mode,
          timezone: tz,
        });
        // The model returns source_image_index local to the batch — but
        // we passed the same batch in, so the indexes already match the
        // images we sent. We just remap them back to the global index
        // so the Plan UI can show which file each card came from.
        for (const book of resp.library_books) {
          if (
            book.source_image_index !== null &&
            book.source_image_index >= 0 &&
            book.source_image_index < batch.length
          ) {
            book.source_image_index = bi * BATCH_SIZE + book.source_image_index;
          }
        }
        accumulated.drops.push(...resp.drops);
        accumulated.library_books.push(...resp.library_books);
        accumulated.questions.push(...resp.questions);
      }

      // Enrich library_books with ISBN lookups in parallel (one lookup
      // per book at most). The progress here is fast — Open Library is
      // usually <500ms per call.
      if (accumulated.library_books.length > 0) {
        setBannerStatus("Looking up ISBNs…");
        accumulated.library_books = await enrichLibraryBooks(
          accumulated.library_books,
          (done, total) => {
            setBannerStatus(`Looking up ISBN ${done} of ${total}…`);
          },
        );
      }

      accumulated.summary =
        `Found ${accumulated.drops.length} drop${
          accumulated.drops.length === 1 ? "" : "s"
        } and ${accumulated.library_books.length} library book${
          accumulated.library_books.length === 1 ? "" : "s"
        }.`;
      setPlan(accumulated);
      setSkipDrops(new Set());
      setSkipBooks(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setWorking(false);
      setBannerStatus("");
    }
  }

  async function onSaveAll() {
    if (!plan) return;
    const filtered: AssistantPlan = {
      drops: plan.drops.filter((_, i) => !skipDrops.has(i)),
      library_books: plan.library_books.filter((_, i) => !skipBooks.has(i)),
      questions: [],
      summary: "",
    };
    if (filtered.drops.length === 0 && filtered.library_books.length === 0) {
      setError("Nothing selected to save.");
      return;
    }
    setError(null);
    setWorking(true);
    try {
      const result = await bulkSavePlan(filtered, (_done, _total, label) => {
        setBannerStatus(label);
      });
      setBannerStatus("");
      const params = new URLSearchParams();
      const total = result.savedDrops + result.savedBooks;
      params.set("added", String(total));
      if (result.errors.length) {
        params.set("addedErrors", String(result.errors.length));
      }
      // Land on Library if the work was mostly cataloging, otherwise Home.
      const landing = result.savedBooks > result.savedDrops ? "/library" : "/";
      navigate(`${landing}?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
      setBannerStatus("");
    }
  }

  function toggleSkipDrop(i: number) {
    setSkipDrops((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  function toggleSkipBook(i: number) {
    setSkipBooks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div>
      <ProcessingBanner show={Boolean(bannerStatus)} message={bannerStatus} />

      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-pink-200">
          ✨ Book Assistant
        </h1>
        <div className="text-xs text-pink-400">tz: {tz}</div>
      </div>

      {!plan && (
        <div className="space-y-4">
          <div className="card p-3 space-y-3">
            <label className="block">
              <span className="block text-xs text-pink-300 mb-1">
                Paste a post, or just describe what's happening
              </span>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  mode === "library_backfill"
                    ? "Optional. e.g. 'these are all from my Illumicrate shelf'"
                    : "e.g. 'twistedfiction June box drops 6/30 noon CST, $55 + shipping, hand-signed tip-ins'"
                }
                className={INPUT_BASE}
                disabled={working}
              />
            </label>

            <div>
              <span className="block text-xs text-pink-300 mb-1">
                Screenshots and/or cover photos
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={working}
                className="border border-pink-400 text-pink-200 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                + Add images
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void onPickFiles(e)}
                className="hidden"
              />
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={clearStaging}
                  disabled={working}
                  className="ml-2 border border-zinc-700 text-pink-300 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
                >
                  Clear all
                </button>
              )}

              {images.length > 0 && (
                <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square bg-zinc-900 border border-zinc-800 overflow-hidden"
                    >
                      <img
                        src={img.preview_url}
                        alt={img.fileName}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        disabled={working}
                        className="absolute top-1 right-1 bg-black/70 text-pink-200 w-5 h-5 leading-none text-xs hover:bg-black"
                        aria-label={`Remove ${img.fileName}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {images.length > 0 && (
                <p className="mt-1 text-[11px] text-pink-400">
                  {images.length} image{images.length === 1 ? "" : "s"} ready
                  {images.length > BATCH_SIZE
                    ? ` — will process in ${Math.ceil(
                        images.length / BATCH_SIZE,
                      )} batches`
                    : ""}
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs text-pink-300 mb-1">Mode</span>
              <div className="flex gap-2">
                <ModeButton
                  active={mode === "auto"}
                  onClick={() => setMode("auto")}
                  disabled={working}
                  label="Auto"
                  hint="Mix of drops + library"
                />
                <ModeButton
                  active={mode === "library_backfill"}
                  onClick={() => setMode("library_backfill")}
                  disabled={working}
                  label="Library backfill"
                  hint="Cataloging books I own"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onExtract()}
              disabled={working}
              className="bg-pink-500 text-black px-3 py-1.5 text-sm hover:bg-pink-400 disabled:opacity-50"
            >
              ✨ Read it
            </button>
            <p className="text-[11px] text-pink-400">
              Nothing is saved until you review and confirm.
            </p>
          </div>
        </div>
      )}

      {plan && (
        <ReviewPanel
          plan={plan}
          skipDrops={skipDrops}
          skipBooks={skipBooks}
          working={working}
          onToggleSkipDrop={toggleSkipDrop}
          onToggleSkipBook={toggleSkipBook}
          onSaveAll={() => void onSaveAll()}
          onStartOver={() => {
            setPlan(null);
            setSkipDrops(new Set());
            setSkipBooks(new Set());
            clearStaging();
          }}
          error={error}
        />
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex-1 px-3 py-1.5 text-left border",
        active
          ? "border-pink-400 bg-pink-500 text-black"
          : "border-zinc-700 bg-zinc-900 text-pink-300 hover:bg-zinc-800",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] opacity-80">{hint}</div>
    </button>
  );
}

function ReviewPanel({
  plan,
  skipDrops,
  skipBooks,
  working,
  onToggleSkipDrop,
  onToggleSkipBook,
  onSaveAll,
  onStartOver,
  error,
}: {
  plan: AssistantPlan;
  skipDrops: Set<number>;
  skipBooks: Set<number>;
  working: boolean;
  onToggleSkipDrop: (i: number) => void;
  onToggleSkipBook: (i: number) => void;
  onSaveAll: () => void;
  onStartOver: () => void;
  error: string | null;
}) {
  const dropKeep = plan.drops.length - skipDrops.size;
  const bookKeep = plan.library_books.length - skipBooks.size;
  const total = dropKeep + bookKeep;

  return (
    <div className="space-y-4">
      <div className="card p-3 flex items-start gap-3">
        <span className="text-lg" aria-hidden>
          ✨
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium text-pink-100">
            {plan.summary}
          </div>
          <div className="text-xs text-pink-400 mt-0.5">
            Review below, untick anything you don't want, then save.
          </div>
        </div>
        <button
          type="button"
          onClick={onStartOver}
          disabled={working}
          className="border border-zinc-700 text-pink-300 px-3 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
        >
          Start over
        </button>
      </div>

      {plan.questions.length > 0 && (
        <div className="card p-3">
          <div className="text-xs uppercase tracking-wide text-pink-400 mb-2">
            Questions
          </div>
          <ul className="space-y-1 text-sm text-amber-200">
            {plan.questions.map((q, i) => (
              <li key={i}>• {q.question}</li>
            ))}
          </ul>
          <p className="text-[11px] text-pink-400 mt-2">
            You can save what's here and fill in the gaps later from the
            edition page.
          </p>
        </div>
      )}

      {plan.drops.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-pink-400 mb-2">
            Drops on the calendar ({dropKeep}/{plan.drops.length})
          </h2>
          <ul className="space-y-2">
            {plan.drops.map((d, i) => (
              <DropCard
                key={i}
                drop={d}
                skipped={skipDrops.has(i)}
                onToggle={() => onToggleSkipDrop(i)}
              />
            ))}
          </ul>
        </section>
      )}

      {plan.library_books.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-pink-400 mb-2">
            Library books ({bookKeep}/{plan.library_books.length})
          </h2>
          <ul className="space-y-2">
            {plan.library_books.map((b, i) => (
              <LibraryCard
                key={i}
                book={b}
                skipped={skipBooks.has(i)}
                onToggle={() => onToggleSkipBook(i)}
              />
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveAll}
          disabled={working || total === 0}
          className="bg-pink-500 text-black px-3 py-1.5 text-sm hover:bg-pink-400 disabled:opacity-50"
        >
          ✨ Add {total} {total === 1 ? "item" : "items"}
        </button>
      </div>
    </div>
  );
}

/** Pretty-print the offset-aware ISO timestamp the assistant returned. */
function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function ConfidenceBadge({ level }: { level?: "high" | "medium" | "low" }) {
  if (!level || level === "high") return null;
  const cls =
    level === "low"
      ? "bg-amber-900/60 text-amber-200 border-amber-800"
      : "bg-zinc-800 text-pink-300 border-zinc-700";
  return (
    <span
      className={[
        "inline-block ml-1 px-1 py-px text-[9px] uppercase tracking-wider border",
        cls,
      ].join(" ")}
    >
      {level === "low" ? "guess" : "?"}
    </span>
  );
}

function DropCard({
  drop,
  skipped,
  onToggle,
}: {
  drop: DropPlan;
  skipped: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={[
        "card p-3 flex items-start gap-3",
        skipped ? "opacity-50" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={!skipped}
        onChange={onToggle}
        className="mt-1 accent-pink-500"
        aria-label="Include this drop"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-pink-100 break-words">
            {drop.title ?? "Cover reveal — title TBD"}
            <ConfidenceBadge level={drop.confidence?.title} />
          </span>
          {drop.tier_name && (
            <span className="text-[11px] text-pink-300 bg-pink-950/60 border border-pink-500/40 px-1.5 py-px">
              {drop.tier_name}
            </span>
          )}
          {drop.is_one_day_sale && (
            <span className="text-[11px] text-amber-200">1-day</span>
          )}
        </div>
        <div className="text-xs text-pink-300 mt-0.5">
          {drop.shop}
          {drop.author && <> · {drop.author}</>}
          {drop.edition_name && drop.edition_name !== "Special edition" && (
            <> · {drop.edition_name}</>
          )}
        </div>
        <div className="text-xs text-pink-200 mt-1 tabular-nums">
          {formatLocalDateTime(drop.sale_starts_at)} →{" "}
          {formatLocalDateTime(drop.sale_ends_at)}
        </div>
        <div className="text-xs text-pink-300 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {drop.price !== null && (
            <span>
              {drop.currency} {drop.price}
              {drop.shipping_note ? ` ${drop.shipping_note}` : ""}
            </span>
          )}
          {drop.delivery_window && <span>Ships: {drop.delivery_window}</span>}
          {drop.isbn && <span>ISBN {drop.isbn}</span>}
        </div>
        {drop.special_features && (
          <div className="text-xs text-pink-400 mt-1 break-words">
            {drop.special_features}
          </div>
        )}
        {drop.notes && (
          <div className="text-[11px] text-pink-500 mt-1 break-words">
            {drop.notes}
          </div>
        )}
      </div>
    </li>
  );
}

function LibraryCard({
  book,
  skipped,
  onToggle,
}: {
  book: LibraryBookPlan;
  skipped: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={[
        "card p-3 flex items-start gap-3",
        skipped ? "opacity-50" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={!skipped}
        onChange={onToggle}
        className="mt-1 accent-pink-500"
        aria-label="Include this book"
      />
      {book.cover_data_url ? (
        <img
          src={book.cover_data_url}
          alt={book.title ?? "Book cover"}
          className="w-16 h-24 object-cover border border-zinc-700 shrink-0"
        />
      ) : (
        <div className="w-16 h-24 bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center text-pink-500 text-xs">
          📚
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-pink-100 break-words">
          {book.title ?? "Untitled"}
          <ConfidenceBadge level={book.confidence?.title} />
        </div>
        <div className="text-xs text-pink-300 mt-0.5">
          {book.author ?? "Unknown author"}
          {book.series && (
            <>
              {" · "}
              {book.series}
              {book.series_number !== null ? ` #${book.series_number}` : ""}
            </>
          )}
        </div>
        <div className="text-xs text-pink-300 mt-0.5">
          {book.edition_name}
          {book.publisher_or_shop && <> · {book.publisher_or_shop}</>}
          {book.isbn && <> · ISBN {book.isbn}</>}
        </div>
        {book.special_features && (
          <div className="text-xs text-pink-400 mt-1 break-words">
            {book.special_features}
          </div>
        )}
        {book.notes && (
          <div className="text-[11px] text-pink-500 mt-1 break-words">
            {book.notes}
          </div>
        )}
      </div>
    </li>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
