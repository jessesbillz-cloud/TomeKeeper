import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

type Props = {
  /** Button label. */
  label?: string;
  /** Tailwind classes for the trigger button. */
  className?: string;
  /**
   * Called when a QR code is decoded. If omitted, we show a default UI
   * with Open / Copy / Rescan actions.
   */
  onResult?: (text: string) => void;
};

/**
 * Live-camera QR / barcode scanner. Uses the qr-scanner library which
 * wraps getUserMedia + a wasm decoder. The modal closes on success
 * (unless onResult is omitted, in which case we show actions).
 */
export function QRScanButton({
  label = "📱 Scan QR",
  className,
  onResult,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "border border-pink-400 text-pink-200 px-3 py-1 text-sm hover:bg-zinc-800"
        }
      >
        {label}
      </button>
      {open && (
        <QRScanModal
          onClose={() => setOpen(false)}
          onResult={onResult}
        />
      )}
    </>
  );
}

function QRScanModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult?: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const scanner = new QrScanner(
      video,
      (r) => {
        // Stop on first hit; user can rescan via the action button.
        if (onResult) {
          onResult(r.data);
          onClose();
        } else {
          setResult(r.data);
          scanner.stop();
        }
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
      },
    );
    scannerRef.current = scanner;

    scanner.start().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [onClose, onResult]);

  async function rescan() {
    setResult(null);
    setCopied(false);
    setError(null);
    try {
      await scannerRef.current?.start();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — older browsers / non-secure contexts.
    }
  }

  const looksLikeUrl = result ? /^https?:\/\//i.test(result) : false;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-pink-200">
            {result ? "QR scanned" : "Scan a QR code"}
          </h2>
          <button
            onClick={onClose}
            className="text-pink-300 hover:text-pink-100 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="relative bg-black border border-zinc-800 aspect-square overflow-hidden">
          {/* qr-scanner attaches its highlight overlay to the video element */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {result && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-3">
              <div className="text-center">
                <div className="text-xs text-pink-400 uppercase tracking-wide mb-1">
                  Decoded
                </div>
                <div className="text-sm text-pink-100 break-all max-h-32 overflow-y-auto">
                  {result}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-300 border border-red-800 bg-red-950/40 p-2">
            {error}
          </p>
        )}

        {result ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {looksLikeUrl && (
              <a
                href={result}
                target="_blank"
                rel="noreferrer"
                className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
              >
                Open link ↗
              </a>
            )}
            <button
              onClick={() => void copy()}
              className="border border-pink-400 text-pink-200 px-3 py-1 text-sm hover:bg-zinc-800"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => void rescan()}
              className="border border-zinc-700 text-pink-300 px-3 py-1 text-sm hover:bg-zinc-800"
            >
              Rescan
            </button>
            <button
              onClick={onClose}
              className="ml-auto border border-zinc-700 text-pink-300 px-3 py-1 text-sm hover:bg-zinc-800"
            >
              Done
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-pink-400">
            Point your camera at a QR code or barcode. Tip: ISBN barcodes on
            book covers also work.
          </p>
        )}
      </div>
    </div>
  );
}
