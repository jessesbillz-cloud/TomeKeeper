import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { post, ApiError } from "../lib/api";
import { ProcessingBanner } from "./ProcessingBanner";

type Props = {
  /** Where to send the captured photo. Defaults to /capture. */
  to?: string;
  /** Extra search params to append to the destination URL. */
  searchParams?: Record<string, string>;
  /** Button label. */
  label?: string;
  /** Tailwind classes for the button. */
  className?: string;
  /** Inline style overrides — useful for safe-area inset on the FAB. */
  style?: React.CSSProperties;
  /**
   * "camera" (default) launches the rear camera directly via the
   *   `capture="environment"` hint — best for taking a fresh cover photo.
   * "library" omits the capture hint so the OS picker lets the user choose
   *   from their photo library — used for "Upload screenshot".
   */
  mode?: "camera" | "library";
  /**
   * If true, after the user picks an image, POST it to /scan-screenshot
   * (Claude vision) and forward the extracted fields to /capture so the
   * form lands prefilled. If the model identifies multiple books in the
   * screenshot (a list / roundup), we bulk-create all of them via the
   * /works /editions /library endpoints and navigate to Home with a
   * "Added N events" banner instead.
   */
  aiScan?: boolean;
};

type ScanItem = {
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
};

type ScanResponse = {
  items?: ScanItem[];
  fields?: ScanItem | null;
  raw?: string;
  detail?: string;
};

/**
 * Resize an image File client-side to keep the data URL we hand off to the
 * Capture page small. We aim for ~600px on the long edge and JPEG @ 0.85,
 * which is plenty for a cover thumbnail and well under URL/state limits.
 */
async function fileToResizedDataUrl(
  file: File,
  maxEdge = 600,
  quality = 0.85,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * AI-scan mode does an extra resize for what we send to Claude — we want a
 * larger image (text in screenshots needs to be readable) but still small
 * enough to fit in a base64 POST without timing out. ~1200px on the long
 * edge is a good balance.
 */
async function fileToScanDataUrl(file: File): Promise<string> {
  return fileToResizedDataUrl(file, 1200, 0.85);
}

/** Util: trim, return null if the result is empty. */
function nz(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

/**
 * Bulk-create one work + edition + library_entry per item. We swallow
 * per-item errors so a single bad row doesn't abort the whole batch and
 * Janelle still ends up with most of the screenshot saved. Returns the
 * number of items successfully written.
 */
async function bulkSaveItems(
  items: ScanItem[],
  onProgress: (done: number, total: number) => void,
): Promise<{ saved: number; errors: string[] }> {
  let saved = 0;
  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress(i, items.length);
    if (!item || !nz(item.title ?? null)) {
      errors.push(`Item ${i + 1}: skipped (no title)`);
      continue;
    }
    try {
      const work = await post<{ id: string }>("/works", {
        title: nz(item.title)!,
        author: nz(item.author),
        series: nz(item.series),
        series_number:
          typeof item.series_number === "number"
            ? item.series_number
            : null,
        base_description: null,
        original_pub_year: null,
      });
      const edition = await post<{ id: string }>("/editions", {
        work_id: work.id,
        // Backend requires edition_name. Default if AI didn't pick one up.
        edition_name: nz(item.edition_name) ?? "Special edition",
        publisher_or_shop: nz(item.publisher_or_shop),
        retailer: nz(item.retailer),
        cover_url: null,
        release_date: nz(item.release_date),
        release_time: null,
        release_timezone: null,
        edition_size:
          typeof item.edition_size === "number"
            ? item.edition_size
            : null,
        special_features: nz(item.special_features),
        isbn: nz(item.isbn),
        preorder_start_at: nz(item.preorder_start_at),
        preorder_end_at: nz(item.preorder_end_at),
      });
      await post("/library", {
        edition_id: edition.id,
        status: "upcoming",
        condition: null,
        personal_photo_url: null,
        purchase_price: null,
        sale_price: null,
        sale_notes: null,
        buyer_info: null,
        notes: nz(item.notes),
      });
      saved += 1;
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      errors.push(`Item ${i + 1} (${item.title ?? "untitled"}): ${msg}`);
    }
  }
  onProgress(items.length, items.length);
  return { saved, errors };
}

export function PhotoCaptureButton({
  to = "/capture",
  searchParams,
  label = "📷 Take photo",
  className,
  style,
  mode = "camera",
  aiScan = false,
}: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  // High-level status we surface in the global banner. Empty string =
  // hide the banner.
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function buildDest(extra?: Record<string, string>): string {
    const params = new URLSearchParams(searchParams ?? {});
    params.set("from", aiScan ? "ai" : "photo");
    if (extra) {
      for (const [k, v] of Object.entries(extra)) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${to}?${qs}` : to;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      // Always produce a small thumbnail to ship to /capture as the cover.
      const thumbDataUrl = await fileToResizedDataUrl(file);

      if (!aiScan) {
        navigate(buildDest(), { state: { photoDataUrl: thumbDataUrl } });
        return;
      }

      // AI mode: send a higher-fidelity copy to the scan function so the
      // model can actually read text in the screenshot.
      setStatus("Scanning your screenshot…");
      const scanDataUrl = await fileToScanDataUrl(file);
      let scan: ScanResponse | null = null;
      try {
        scan = await post<ScanResponse>("/scan-screenshot", {
          image_data_url: scanDataUrl,
        });
      } catch (apiErr) {
        // Don't block the user — fall through to /capture with just the
        // photo and a banner explaining the scan failed.
        const msg =
          apiErr instanceof ApiError
            ? apiErr.message
            : apiErr instanceof Error
              ? apiErr.message
              : String(apiErr);
        setStatus("");
        navigate(buildDest(), {
          state: {
            photoDataUrl: thumbDataUrl,
            scanError: msg,
          },
        });
        return;
      }

      const items = scan?.items ?? (scan?.fields ? [scan.fields] : []);
      const usable = items.filter((it) => nz(it?.title ?? null));

      if (usable.length === 0) {
        // Nothing identifiable — drop on Capture with an error banner.
        setStatus("");
        navigate(buildDest(), {
          state: {
            photoDataUrl: thumbDataUrl,
            scanError:
              scan?.detail ??
              "Couldn't identify any books in that screenshot.",
          },
        });
        return;
      }

      if (usable.length === 1) {
        // Single-item: keep the review-and-save flow Janelle already knows.
        setStatus("");
        navigate(buildDest(), {
          state: {
            photoDataUrl: thumbDataUrl,
            scanFields: usable[0],
            scanError: null,
          },
        });
        return;
      }

      // Multi-item: bulk-create silently, then navigate Home with a
      // success banner. We update the status banner with progress so the
      // user can see something is happening for the few seconds this takes.
      const { saved, errors } = await bulkSaveItems(usable, (done, total) => {
        setStatus(`Adding ${done} of ${total} to your calendar…`);
      });
      setStatus("");
      const params = new URLSearchParams();
      params.set("added", String(saved));
      if (errors.length) params.set("addedErrors", String(errors.length));
      navigate(`/?${params.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
      setStatus("");
      // Allow re-selecting the same file later.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const buttonLabel = working
    ? status
      ? "✨ Working…"
      : "Processing…"
    : label;

  return (
    <>
      <ProcessingBanner show={Boolean(status)} message={status} />
      <button
        type="button"
        disabled={working}
        onClick={() => inputRef.current?.click()}
        style={style}
        className={
          className ??
          "border border-pink-400 text-pink-200 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
        }
      >
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={mode === "camera" ? "environment" : undefined}
        onChange={(e) => void onPick(e)}
        className="hidden"
      />
      {error && (
        <span className="text-xs text-red-300 ml-2">Photo failed: {error}</span>
      )}
    </>
  );
}
