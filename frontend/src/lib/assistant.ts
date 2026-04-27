/**
 * Frontend types + helpers for the Book Assistant.
 *
 * The shapes here MUST mirror the JSON the supabase/functions/assistant-extract
 * edge function emits. Drift = silent breakage in the review panel.
 *
 * Two output buckets:
 *   - DropPlan         → calendar events (one per book × tier)
 *   - LibraryBookPlan  → books to add to Janelle's library (status=owned by
 *                        default; she physically has these)
 *
 * The save pipeline below is split intentionally:
 *   - saveDrop()      writes works + editions + flash_sales (NO library row;
 *                     drops are not yet owned)
 *   - saveLibrary()   writes works + editions + library (status=owned)
 *
 * Drops and library are kept separate because Janelle's library is "books I
 * physically have." Watching a drop is a calendar concern, not a library
 * concern.
 */

import { post, ApiError } from "./api";
import { lookupIsbn } from "./isbnLookup";
import type { LibraryStatus } from "./types";

export type Confidence = "high" | "medium" | "low";

export interface DropPlan {
  shop: string;
  title: string | null;
  author: string | null;
  series: string | null;
  series_number: number | null;
  edition_name: string;
  /** null = the general/public sale; otherwise "Patreon early access" etc. */
  tier_name: string | null;
  /** ISO 8601 with offset matching the shop's local timezone. */
  sale_starts_at: string;
  /** ISO 8601 with offset matching the shop's local timezone. */
  sale_ends_at: string;
  is_one_day_sale: boolean;
  price: number | null;
  currency: string;
  shipping_note: string | null;
  delivery_window: string | null;
  isbn: string | null;
  edition_size: number | null;
  special_features: string | null;
  cover_image_url: string | null;
  notes: string | null;
  confidence: Partial<Record<string, Confidence>>;
}

export interface LibraryBookPlan {
  title: string | null;
  author: string | null;
  series: string | null;
  series_number: number | null;
  edition_name: string;
  publisher_or_shop: string | null;
  isbn: string | null;
  cover_data_url: string | null;
  status: LibraryStatus;
  condition: string | null;
  special_features: string | null;
  notes: string | null;
  source_image_index: number | null;
  confidence: Partial<Record<string, Confidence>>;
}

export interface AssistantQuestion {
  scope: "drop" | "library_book" | "general";
  index: number | null;
  field: string;
  question: string;
}

export interface AssistantPlan {
  drops: DropPlan[];
  library_books: LibraryBookPlan[];
  questions: AssistantQuestion[];
  summary: string;
  raw?: string;
}

/** Trim → null if empty. */
function nz(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

/**
 * Call the assistant-extract edge function. The frontend builds chunks of
 * up to 6 images per call (vision quality drops with too many images per
 * request); the caller is responsible for batching and accumulating.
 */
export async function extractPlan(input: {
  text?: string;
  images?: Array<{ data_url: string }>;
  mode?: "auto" | "library_backfill";
  timezone?: string;
}): Promise<AssistantPlan> {
  return post<AssistantPlan>("/assistant-extract", input);
}

/**
 * For each library_book that has an ISBN but is missing key fields, run
 * lookupIsbn (Open Library + Google Books) and merge what we find. We
 * NEVER overwrite a model-extracted value with a lookup result — the
 * model saw the actual cover, which is more authoritative than a public
 * catalog entry.
 */
export async function enrichLibraryBooks(
  books: LibraryBookPlan[],
  onProgress?: (done: number, total: number) => void,
): Promise<LibraryBookPlan[]> {
  const out: LibraryBookPlan[] = [];
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    onProgress?.(i, books.length);
    const isbn = nz(b.isbn);
    if (!isbn) {
      out.push(b);
      continue;
    }
    try {
      const lookup = await lookupIsbn(isbn);
      if (!lookup) {
        out.push(b);
        continue;
      }
      out.push({
        ...b,
        title: nz(b.title) ?? lookup.title,
        author: nz(b.author) ?? lookup.author,
        series: nz(b.series) ?? lookup.series,
        series_number: b.series_number ?? lookup.series_number,
        publisher_or_shop:
          nz(b.publisher_or_shop) ?? lookup.publisher_or_shop,
        cover_data_url: b.cover_data_url ?? lookup.cover_url,
      });
    } catch {
      out.push(b);
    }
  }
  onProgress?.(books.length, books.length);
  return out;
}

/**
 * Save one drop:
 *   1. POST /works           (book identity)
 *   2. POST /editions        (special edition + preorder window)
 *   3. POST /flash-sales     (calendar pin; each tier is a separate row)
 * No library entry — drops are not yet owned books.
 */
export async function saveDrop(drop: DropPlan): Promise<void> {
  // The work might already exist for the same title+series, but the API
  // is permissive about duplicates and we'd rather not over-engineer
  // de-duping client-side. Janelle can merge later if needed.
  const work = await post<{ id: string }>("/works", {
    title: nz(drop.title) ?? "Untitled (cover reveal)",
    author: nz(drop.author),
    series: nz(drop.series),
    series_number:
      typeof drop.series_number === "number" ? drop.series_number : null,
    base_description: null,
    original_pub_year: null,
  });
  const edition = await post<{ id: string }>("/editions", {
    work_id: work.id,
    edition_name: nz(drop.edition_name) ?? "Special edition",
    publisher_or_shop: nz(drop.shop),
    retailer: null,
    cover_url: nz(drop.cover_image_url),
    release_date: null,
    release_time: null,
    release_timezone: null,
    edition_size:
      typeof drop.edition_size === "number" ? drop.edition_size : null,
    special_features: composeSpecialFeatures(drop),
    isbn: nz(drop.isbn),
    preorder_start_at: drop.sale_starts_at,
    preorder_end_at: drop.sale_ends_at,
  });
  // The flash_sales row is the actual calendar pin. Tier name (if any)
  // gets baked into the title so the day-detail panel shows tiers
  // distinctly even when stacked under the same shop's color bar.
  const tierSuffix = drop.tier_name ? ` — ${drop.tier_name}` : "";
  const titleForCalendar =
    (nz(drop.title) ?? nz(drop.edition_name) ?? "Drop") + tierSuffix;
  await post("/flash-sales", {
    shop: nz(drop.shop) ?? "Unknown shop",
    title: titleForCalendar,
    url: null,
    edition_id: edition.id,
    starts_at: drop.sale_starts_at,
    ends_at: drop.sale_ends_at,
    notes: composeDropNotes(drop),
  });
}

/**
 * Save one library_book:
 *   1. POST /works
 *   2. POST /editions
 *   3. POST /library  (status=owned by default — she has it)
 */
export async function saveLibraryBook(book: LibraryBookPlan): Promise<void> {
  const work = await post<{ id: string }>("/works", {
    title: nz(book.title) ?? "Untitled",
    author: nz(book.author),
    series: nz(book.series),
    series_number:
      typeof book.series_number === "number" ? book.series_number : null,
    base_description: null,
    original_pub_year: null,
  });
  const edition = await post<{ id: string }>("/editions", {
    work_id: work.id,
    edition_name: nz(book.edition_name) ?? "Standard edition",
    publisher_or_shop: nz(book.publisher_or_shop),
    retailer: null,
    cover_url: nz(book.cover_data_url),
    release_date: null,
    release_time: null,
    release_timezone: null,
    edition_size: null,
    special_features: nz(book.special_features),
    isbn: nz(book.isbn),
    preorder_start_at: null,
    preorder_end_at: null,
  });
  await post("/library", {
    edition_id: edition.id,
    status: book.status,
    condition: nz(book.condition),
    personal_photo_url: null,
    purchase_price: null,
    sale_price: null,
    sale_notes: null,
    buyer_info: null,
    notes: nz(book.notes),
  });
}

/**
 * Bulk-save with per-item error capture so one bad row doesn't abort the
 * batch. Used by Assistant page after the user reviews + approves.
 */
export async function bulkSavePlan(
  plan: AssistantPlan,
  onProgress: (done: number, total: number, label: string) => void,
): Promise<{ savedDrops: number; savedBooks: number; errors: string[] }> {
  const errors: string[] = [];
  let savedDrops = 0;
  let savedBooks = 0;
  const total = plan.drops.length + plan.library_books.length;
  let done = 0;
  for (let i = 0; i < plan.drops.length; i++) {
    const d = plan.drops[i];
    onProgress(done, total, `Adding drop ${i + 1} of ${plan.drops.length}…`);
    try {
      await saveDrop(d);
      savedDrops += 1;
    } catch (e) {
      errors.push(captureError("drop", i, d.title ?? d.edition_name, e));
    }
    done += 1;
  }
  for (let i = 0; i < plan.library_books.length; i++) {
    const b = plan.library_books[i];
    onProgress(
      done,
      total,
      `Cataloging book ${i + 1} of ${plan.library_books.length}…`,
    );
    try {
      await saveLibraryBook(b);
      savedBooks += 1;
    } catch (e) {
      errors.push(captureError("book", i, b.title ?? "untitled", e));
    }
    done += 1;
  }
  onProgress(total, total, "");
  return { savedDrops, savedBooks, errors };
}

function captureError(
  kind: "drop" | "book",
  i: number,
  label: string,
  e: unknown,
): string {
  const msg =
    e instanceof ApiError
      ? e.message
      : e instanceof Error
        ? e.message
        : String(e);
  return `${kind === "drop" ? "Drop" : "Book"} ${i + 1} (${label}): ${msg}`;
}

/**
 * Mash the drop's most useful free-form fields into the edition's
 * special_features column. We keep this on the edition (not the
 * flash_sale) because special_features are a property of the book, not
 * the sale.
 */
function composeSpecialFeatures(drop: DropPlan): string | null {
  const parts: string[] = [];
  if (drop.special_features) parts.push(drop.special_features);
  return parts.length ? parts.join(" • ") : null;
}

/**
 * Build the notes string we attach to the flash_sales row. Captures the
 * tier, price, shipping, and delivery window so the day-detail panel
 * shows the actionable details even when the user can't open the
 * edition.
 */
function composeDropNotes(drop: DropPlan): string | null {
  const lines: string[] = [];
  if (drop.tier_name) lines.push(`Tier: ${drop.tier_name}`);
  if (drop.price !== null) {
    const shipping = drop.shipping_note ?? "";
    lines.push(
      `Price: ${drop.currency || "USD"} ${drop.price}${shipping ? " " + shipping : ""}`.trim(),
    );
  }
  if (drop.delivery_window) lines.push(`Ships: ${drop.delivery_window}`);
  if (drop.notes) lines.push(drop.notes);
  return lines.length ? lines.join("\n") : null;
}
