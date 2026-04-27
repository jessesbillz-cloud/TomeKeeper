import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

export function PhotoCaptureButton({
  to = "/capture",
  searchParams,
  label = "📷 Take photo",
  className,
  style,
  mode = "camera",
}: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildDest(): string {
    const params = new URLSearchParams(searchParams ?? {});
    params.set("from", "photo");
    const qs = params.toString();
    return qs ? `${to}?${qs}` : to;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      navigate(buildDest(), { state: { photoDataUrl: dataUrl } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
      // Allow re-selecting the same file later.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

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
        {working ? "Processing…" : label}
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
