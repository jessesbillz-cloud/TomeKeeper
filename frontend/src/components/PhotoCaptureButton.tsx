import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { post, ApiError } from "../lib/api";

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
   * (Claude vision) and forward the extracted fields as well as the
   * thumbnail to /capture so the form lands prefilled. The button label
   * temporarily shows "Scanning…" while the request is in flight.
   */
  aiScan?: boolean;
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

/** Shape returned by the scan-screenshot edge function. */
type ScanResult = {
  fields: Record<string, string | number | null> | null;
  raw?: string;
  detail?: string;
};

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
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildDest(): string {
    const params = new URLSearchParams(searchParams ?? {});
    params.set("from", aiScan ? "ai" : "photo");
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
      setScanning(true);
      const scanDataUrl = await fileToScanDataUrl(file);
      let scan: ScanResult | null = null;
      try {
        scan = await post<ScanResult>("/scan-screenshot", {
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
        navigate(buildDest(), {
          state: {
            photoDataUrl: thumbDataUrl,
            scanError: msg,
          },
        });
        return;
      }

      navigate(buildDest(), {
        state: {
          photoDataUrl: thumbDataUrl,
          scanFields: scan?.fields ?? null,
          scanError: scan?.fields ? null : (scan?.detail ?? null),
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
      setScanning(false);
      // Allow re-selecting the same file later.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const buttonLabel = scanning
    ? "✨ Scanning…"
    : working
      ? "Processing…"
      : label;

  return (
    <>
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
