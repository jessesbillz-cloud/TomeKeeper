/**
 * Fixed-position banner that announces background work happening on the
 * user's behalf. Used during AI screenshot scans, ISBN auto-lookups, and
 * the bulk-save loop that fans a multi-item scan out into individual
 * /works /editions /library calls.
 *
 * The banner sits below the global nav (top: 3rem covers the nav bar's
 * height; safe-area inset covers iOS notch). It animates a subtle pulse
 * so Janelle can tell at a glance that something is in flight without
 * blocking interaction.
 */
export function ProcessingBanner({
  show,
  message,
}: {
  show: boolean;
  message: string;
}) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-50 bg-pink-500 text-black px-4 py-2 text-sm font-medium shadow-[0_4px_20px_rgba(236,72,153,0.6)] flex items-center gap-2 animate-pulse"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 3.25rem)",
      }}
    >
      <span aria-hidden>✨</span>
      <span>{message}</span>
    </div>
  );
}
