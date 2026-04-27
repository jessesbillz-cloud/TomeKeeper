import { useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { PhotoCaptureButton } from "../components/PhotoCaptureButton";
import { post } from "../lib/api";
import type { Edition, LibraryEntry, LibraryStatus, Work } from "../lib/types";

type PhotoState = {
  photoDataUrl?: string;
  /**
   * When the user comes from "Upload screenshot (AI)", PhotoCaptureButton
   * forwards the structured fields the scan-screenshot edge function
   * extracted from the image. We use these to prefill the form. Anything
   * left null falls through to EMPTY's default.
   */
  scanFields?: {
    title?: string | null;
    author?: string | null;
    series?: string | null;
    series_number?: number | null;
    edition_name?: string | null;
    publisher_or_shop?: string | null;
    retailer?: string | null;
    release_date?: string | null;
    isbn?: string | null;
    edition_size?: number | null;
    special_features?: string | null;
    preorder_start_at?: string | null;
    preorder_end_at?: string | null;
    notes?: string | null;
  } | null;
  /** A user-facing error message if the AI scan failed. */
  scanError?: string | null;
};

type Form = {
  title: string;
  author: string;
  series: string;
  series_number: string;
  edition_name: string;
  publisher_or_shop: string;
  retailer: string;
  release_date: string;
  isbn: string;
  edition_size: string;
  special_features: string;
  cover_url: string;
  status: LibraryStatus;
  condition: string;
  purchase_price: string;
  notes: string;
};

const EMPTY: Form = {
  title: "",
  author: "",
  series: "",
  series_number: "",
  edition_name: "",
  publisher_or_shop: "",
  retailer: "",
  release_date: "",
  isbn: "",
  edition_size: "",
  special_features: "",
  cover_url: "",
  status: "upcoming",
  condition: "",
  purchase_price: "",
  notes: "",
};

const STATUS_OPTIONS: LibraryStatus[] = [
  "upcoming",
  "ordered",
  "shipped",
  "owned",
  "for_sale",
  "sold",
  "missed",
];

function nullify(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}
function intOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

const INPUT =
  "w-full border border-zinc-700 bg-zinc-900 text-pink-100 placeholder:text-pink-500/60 px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-pink-400 focus:-outline-offset-1";

export function Capture() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialReleaseDate = searchParams.get("release_date") ?? "";
  const initialIsbn = searchParams.get("isbn") ?? "";
  const fromPhoto = searchParams.get("from") === "photo";
  const fromScan = searchParams.get("from") === "scan";
  const fromAi = searchParams.get("from") === "ai";
  const navState = (location.state as PhotoState | null) ?? null;
  const photoDataUrl = navState?.photoDataUrl;
  const scanFields = navState?.scanFields ?? null;
  const scanError = navState?.scanError ?? null;

  // Build the initial form state, layering: EMPTY < query-param prefills <
  // AI-extracted fields < the photo data URL for the cover. Anything the AI
  // returned as null is left empty so the user notices and fills it in.
  const initialForm: Form = (() => {
    const base: Form = {
      ...EMPTY,
      release_date: initialReleaseDate,
      isbn: initialIsbn,
      // If we arrived from PhotoCaptureButton, prefill cover_url with the
      // resized data URL so it's saved with the edition.
      cover_url: photoDataUrl ?? "",
    };
    if (!scanFields) return base;
    const sn =
      typeof scanFields.series_number === "number"
        ? String(scanFields.series_number)
        : "";
    const es =
      typeof scanFields.edition_size === "number"
        ? String(scanFields.edition_size)
        : "";
    return {
      ...base,
      title: scanFields.title ?? base.title,
      author: scanFields.author ?? base.author,
      series: scanFields.series ?? base.series,
      series_number: sn || base.series_number,
      edition_name: scanFields.edition_name ?? base.edition_name,
      publisher_or_shop:
        scanFields.publisher_or_shop ?? base.publisher_or_shop,
      retailer: scanFields.retailer ?? base.retailer,
      release_date: scanFields.release_date ?? base.release_date,
      isbn: scanFields.isbn ?? base.isbn,
      edition_size: es || base.edition_size,
      special_features:
        scanFields.special_features ?? base.special_features,
      notes: scanFields.notes ?? base.notes,
    };
  })();
  const [form, setForm] = useState<Form>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.edition_name.trim()) {
      setError("Edition name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const work = await post<Work>("/works", {
        title: form.title.trim(),
        author: nullify(form.author),
        series: nullify(form.series),
        series_number: intOrNull(form.series_number),
        base_description: null,
        original_pub_year: null,
      });
      const edition = await post<Edition>("/editions", {
        work_id: work.id,
        edition_name: form.edition_name.trim(),
        publisher_or_shop: nullify(form.publisher_or_shop),
        retailer: nullify(form.retailer),
        cover_url: nullify(form.cover_url),
        release_date: nullify(form.release_date),
        release_time: null,
        release_timezone: null,
        edition_size: intOrNull(form.edition_size),
        special_features: nullify(form.special_features),
        isbn: nullify(form.isbn),
        preorder_start_at: null,
        preorder_end_at: null,
      });
      const entry = await post<LibraryEntry>("/library", {
        edition_id: edition.id,
        status: form.status,
        condition: nullify(form.condition),
        personal_photo_url: null,
        purchase_price: nullify(form.purchase_price),
        sale_price: null,
        sale_notes: null,
        buyer_info: null,
        notes: nullify(form.notes),
      });
      setForm(EMPTY);
      navigate(`/editions/${entry.edition_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 max-w-2xl">
        <h1 className="text-base font-semibold text-pink-200">Capture</h1>
        {/* Top-of-form photo button so Janelle can grab a cover without
            scrolling around. The global floating button does the same thing,
            but having it here too matches "right at the top". */}
        <div className="flex gap-2">
          <PhotoCaptureButton
            to="/capture"
            mode="camera"
            label="📷 Take photo"
          />
          <PhotoCaptureButton
            to="/capture"
            mode="library"
            label="✨ Scan screenshot"
            aiScan
          />
        </div>
      </div>
      {fromScan && initialIsbn && (
        <p className="text-xs text-pink-200 border border-pink-500/40 bg-pink-950/30 p-2 mb-3 max-w-2xl">
          📱 Scanned ISBN{" "}
          <span className="font-mono text-pink-100">{initialIsbn}</span>{" "}
          prefilled below. Fill in title, edition name, and any other details
          off the cover, then save.
        </p>
      )}
      {fromAi && scanFields && (
        <p className="text-xs text-pink-200 border border-pink-400 bg-pink-950/40 p-2 mb-3 max-w-2xl">
          ✨ <span className="font-medium">Auto-filled by AI.</span> Review the
          fields below — anything I wasn't sure about is left blank. Save when
          it looks right.
        </p>
      )}
      {fromAi && scanError && (
        <p className="text-xs text-amber-200 border border-amber-700/60 bg-amber-950/40 p-2 mb-3 max-w-2xl">
          ⚠️ AI scan didn't quite work: {scanError}. The image is still
          attached as the cover — fill in the rest by hand.
        </p>
      )}
      {fromPhoto && !photoDataUrl && (
        <p className="text-xs text-pink-300 border border-pink-500/40 bg-pink-950/30 p-2 mb-3 max-w-2xl">
          📷 Photo capture: snap or paste the cover image URL into the
          <span className="font-medium text-pink-200"> Cover image URL </span>
          field below, then fill in whatever details you can read off the cover.
          Auto-OCR is on the roadmap.
        </p>
      )}
      {photoDataUrl && (
        <div className="flex items-start gap-3 border border-pink-500/40 bg-pink-950/30 p-2 mb-3 max-w-2xl">
          <img
            src={photoDataUrl}
            alt="Captured cover"
            className="w-20 h-28 object-cover border border-zinc-700 shrink-0"
          />
          <div className="text-xs text-pink-300 space-y-1">
            <div className="font-medium text-pink-200">📷 Photo captured</div>
            <div>
              The image is attached to this edition. Fill in title, edition
              name, and anything else you can read off the cover.
            </div>
            <button
              type="button"
              onClick={() => set("cover_url", "")}
              className="text-pink-400 underline"
            >
              Discard photo
            </button>
          </div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
        <Section title="Book">
          <Field label="Title *">
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Author">
            <input
              value={form.author}
              onChange={(e) => set("author", e.target.value)}
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Series">
                <input
                  value={form.series}
                  onChange={(e) => set("series", e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label="Series #">
              <input
                value={form.series_number}
                onChange={(e) => set("series_number", e.target.value)}
                inputMode="numeric"
                className={INPUT}
              />
            </Field>
          </div>
        </Section>

        <Section title="Edition">
          <Field label="Edition name *">
            <input
              required
              value={form.edition_name}
              onChange={(e) => set("edition_name", e.target.value)}
              placeholder="e.g. Illumicrate exclusive"
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publisher / shop">
              <input
                value={form.publisher_or_shop}
                onChange={(e) => set("publisher_or_shop", e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Retailer">
              <input
                value={form.retailer}
                onChange={(e) => set("retailer", e.target.value)}
                className={INPUT}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Release date">
              <input
                type="date"
                value={form.release_date}
                onChange={(e) => set("release_date", e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Edition size">
              <input
                value={form.edition_size}
                onChange={(e) => set("edition_size", e.target.value)}
                inputMode="numeric"
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="ISBN">
            <input
              value={form.isbn}
              onChange={(e) => set("isbn", e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Special features">
            <textarea
              value={form.special_features}
              onChange={(e) => set("special_features", e.target.value)}
              rows={2}
              className={INPUT}
            />
          </Field>
          <Field label="Cover image URL">
            <input
              value={form.cover_url}
              onChange={(e) => set("cover_url", e.target.value)}
              placeholder="https://…"
              className={INPUT}
            />
          </Field>
        </Section>

        <Section title="Your copy">
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as LibraryStatus)}
              className={INPUT}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-zinc-900 text-pink-100">
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Condition">
              <input
                value={form.condition}
                onChange={(e) => set("condition", e.target.value)}
                placeholder="e.g. New / Like new"
                className={INPUT}
              />
            </Field>
            <Field label="Purchase price">
              <input
                value={form.purchase_price}
                onChange={(e) => set("purchase_price", e.target.value)}
                inputMode="decimal"
                placeholder="29.99"
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className={INPUT}
            />
          </Field>
        </Section>

        {error && (
          <p className="text-sm text-red-300 border border-red-800 bg-red-950/40 p-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-pink-500 text-black px-3 py-1.5 text-sm hover:bg-pink-400 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save edition"}
          </button>
          <button
            type="button"
            onClick={() => setForm(EMPTY)}
            disabled={submitting}
            className="border border-zinc-700 px-3 py-1.5 text-sm text-pink-300 hover:bg-zinc-800"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card p-3 space-y-3">
      <legend className="px-1 text-xs uppercase tracking-wide text-pink-400">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-pink-300 mb-0.5">{label}</span>
      {children}
    </label>
  );
}
