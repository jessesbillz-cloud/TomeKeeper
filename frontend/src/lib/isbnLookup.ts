/**
 * ISBN -> book metadata lookup.
 *
 * Used by Home.tsx after the QR scanner decodes a barcode and by Capture
 * when the user pastes an ISBN. Hits Open Library first (no key required,
 * good coverage for trad-pub English fiction) and falls back to Google
 * Books for anything Open Library doesn't have.
 *
 * The shape returned matches `ScanItem` from PhotoCaptureButton / the
 * scan-screenshot edge function so the same prefill code path works for
 * both AI screenshot scans and ISBN lookups.
 *
 * Both APIs are public, CORS-friendly, and free for low-volume use. We
 * deliberately do NOT proxy these through our edge functions — there's no
 * auth or rate limiting we'd add and the round trip would only slow Janelle
 * down.
 */

export type IsbnLookupResult = {
  title: string | null;
  author: string | null;
  series: string | null;
  series_number: number | null;
  edition_name: string | null;
  publisher_or_shop: string | null;
  retailer: string | null;
  release_date: string | null;
  isbn: string | null;
  edition_size: number | null;
  special_features: string | null;
  preorder_start_at: string | null;
  preorder_end_at: string | null;
  notes: string | null;
  /** Cover image URL if the lookup found one. */
  cover_url: string | null;
};

/** Open Library /api/books response shape (just the bits we use). */
type OpenLibraryBook = {
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  cover?: { small?: string; medium?: string; large?: string };
  identifiers?: { isbn_10?: string[]; isbn_13?: string[] };
  number_of_pages?: number;
};

/** Google Books volumes response shape (just the bits we use). */
type GoogleBooksResponse = {
  totalItems?: number;
  items?: Array<{
    volumeInfo?: {
      title?: string;
      subtitle?: string;
      authors?: string[];
      publisher?: string;
      publishedDate?: string;
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
      industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    };
  }>;
};

/** Strip dashes / spaces from an ISBN before sending it upstream. */
function cleanIsbn(isbn: string): string {
  return isbn.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Open Library returns a date like "2023" or "March 2023" or "5 March 2023".
 * Convert what we can to YYYY-MM-DD; if we can only resolve year + month,
 * use day=01; if only year, return null (a year alone isn't an actionable
 * release date for the calendar).
 */
function normalizeReleaseDate(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  // Already ISO-ish: 2023-03-05 or 2023-03
  const iso = t.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (iso) {
    const y = iso[1];
    const m = iso[2];
    const d = iso[3];
    if (y && m && d) return `${y}-${m}-${d}`;
    if (y && m) return `${y}-${m}-01`;
    return null;
  }
  // Try Date parsing for "March 5, 2023" / "5 Mar 2023" / etc.
  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

async function lookupOpenLibrary(
  isbn: string,
): Promise<IsbnLookupResult | null> {
  // /api/books?bibkeys=ISBN:<n>&format=json&jscmd=data returns rich data
  // (authors, cover URLs, publishers) keyed by "ISBN:<n>".
  const url =
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}` +
    `&format=json&jscmd=data`;
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  let data: Record<string, OpenLibraryBook>;
  try {
    data = (await resp.json()) as Record<string, OpenLibraryBook>;
  } catch {
    return null;
  }
  const book = data[`ISBN:${isbn}`];
  if (!book) return null;

  const author =
    book.authors?.map((a) => a.name).filter(Boolean).join(", ") || null;
  const publisher =
    book.publishers?.map((p) => p.name).filter(Boolean).join(", ") || null;
  const cover =
    book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null;

  return {
    title: book.title ?? null,
    author,
    series: null,
    series_number: null,
    edition_name: null,
    publisher_or_shop: publisher,
    retailer: null,
    release_date: normalizeReleaseDate(book.publish_date),
    isbn,
    edition_size: null,
    special_features: null,
    preorder_start_at: null,
    preorder_end_at: null,
    notes: null,
    cover_url: cover,
  };
}

async function lookupGoogleBooks(
  isbn: string,
): Promise<IsbnLookupResult | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  let data: GoogleBooksResponse;
  try {
    data = (await resp.json()) as GoogleBooksResponse;
  } catch {
    return null;
  }
  const item = data.items?.[0]?.volumeInfo;
  if (!item) return null;

  const author = item.authors?.join(", ") ?? null;
  // Upgrade Google's http URLs and bump zoom for a slightly larger cover.
  let cover = item.imageLinks?.thumbnail ?? item.imageLinks?.smallThumbnail ?? null;
  if (cover) {
    cover = cover.replace(/^http:/, "https:").replace(/&zoom=\d+/, "&zoom=2");
  }

  return {
    title: [item.title, item.subtitle].filter(Boolean).join(": ") || null,
    author,
    series: null,
    series_number: null,
    edition_name: null,
    publisher_or_shop: item.publisher ?? null,
    retailer: null,
    release_date: normalizeReleaseDate(item.publishedDate),
    isbn,
    edition_size: null,
    special_features: null,
    preorder_start_at: null,
    preorder_end_at: null,
    notes: null,
    cover_url: cover,
  };
}

/**
 * Look up book metadata by ISBN. Returns null if neither Open Library nor
 * Google Books has anything for this code. Never throws — network failures
 * resolve to null so the caller can fall through to manual entry without a
 * crash.
 */
export async function lookupIsbn(
  rawIsbn: string,
): Promise<IsbnLookupResult | null> {
  const isbn = cleanIsbn(rawIsbn);
  if (!isbn) return null;
  // Open Library is usually richer for trad-pub fiction; try it first.
  const ol = await lookupOpenLibrary(isbn);
  if (ol && ol.title) return ol;
  const gb = await lookupGoogleBooks(isbn);
  if (gb && gb.title) return gb;
  // Last resort: even if neither had a title, return whatever we got so the
  // user at least sees the ISBN prefilled.
  return ol ?? gb ?? { ...emptyResult(), isbn };
}

function emptyResult(): IsbnLookupResult {
  return {
    title: null,
    author: null,
    series: null,
    series_number: null,
    edition_name: null,
    publisher_or_shop: null,
    retailer: null,
    release_date: null,
    isbn: null,
    edition_size: null,
    special_features: null,
    preorder_start_at: null,
    preorder_end_at: null,
    notes: null,
    cover_url: null,
  };
}
