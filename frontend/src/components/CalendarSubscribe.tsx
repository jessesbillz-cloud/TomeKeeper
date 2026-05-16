import { useEffect, useRef, useState } from "react";

import { supabase } from "../lib/supabase";

/**
 * Subscribe-to-calendar trigger.
 *
 * Renders as a tiny 📅 icon button that lives next to the month/year label
 * in the calendar header. Tapping it opens an absolutely-positioned
 * dropdown panel showing the user's iCal subscription URL plus a
 * "Subscribe in Calendar" button (webcal:// hand-off so iOS / macOS /
 * Outlook all open the native subscription flow).
 *
 * The dropdown closes on outside-click or on the × button. The trigger is
 * deliberately compact so the calendar header stays one short row and the
 * grid sits as high as possible on the screen.
 *
 * Notifications themselves are produced by VALARM blocks inside the .ics
 * feed, so once Janelle subscribes once on her phone, every release /
 * preorder / sale / ship / delivery event arrives with native push
 * notifications and survives reboots.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function feedUrls(token: string): { https: string; webcal: string } {
  if (!SUPABASE_URL) {
    return { https: "", webcal: "" };
  }
  const httpsUrl = `${SUPABASE_URL}/functions/v1/calendar-ics?token=${encodeURIComponent(token)}`;
  // webcal:// is just http(s):// with the scheme swapped — calendar apps treat
  // it as "subscribe to a remote feed".
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");
  return { https: httpsUrl, webcal: webcalUrl };
}

export function CalendarSubscribe() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setError("Not signed in.");
          setLoading(false);
        }
        return;
      }
      const { data, error: dbError } = await supabase
        .from("user_profiles")
        .select("ical_token")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (dbError) {
        setError(dbError.message);
      } else if (!data?.ical_token) {
        setError(
          "No calendar token yet. Try signing out and back in to provision one.",
        );
      } else {
        setToken(data.ical_token);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  // Click-outside / Escape to dismiss the dropdown so the user doesn't
  // have to hunt for the × button.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapperRef.current) return;
      if (e.target instanceof Node && wrapperRef.current.contains(e.target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Long-press the URL above to copy manually.");
    }
  }

  const urls = token ? feedUrls(token) : null;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Subscribe to calendar feed"
        title="Subscribe to calendar"
        className={[
          "border px-2 py-0.5 text-sm leading-none",
          open
            ? "border-pink-400 bg-pink-500 text-black"
            : "border-zinc-700 text-pink-300 hover:bg-zinc-800",
        ].join(" ")}
      >
        📅
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Subscribe to your calendar"
          className="absolute right-0 top-full mt-1 w-80 max-w-[90vw] z-30 card p-3 text-sm text-pink-200 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span aria-hidden>📅</span> Subscribe to your calendar
            </h3>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-pink-400 hover:text-pink-200 text-base leading-none"
            >
              ×
            </button>
          </div>

          <p className="text-xs text-pink-400 mb-2">
            Tap once on your phone to subscribe. Every release, preorder
            window, flash sale, publisher sale, ship and delivery shows up
            in your Calendar app with native push notifications — no extra
            app needed.
          </p>

          {loading && (
            <p className="text-xs text-pink-400">Loading your calendar URL…</p>
          )}
          {error && (
            <p className="text-xs text-red-300 border border-red-800 bg-red-950/40 p-2">
              {error}
            </p>
          )}

          {urls && (
            <>
              <div className="flex flex-wrap gap-2 mb-2">
                <a
                  href={urls.webcal}
                  className="bg-pink-500 text-black px-3 py-1 text-sm hover:bg-pink-400"
                >
                  📲 Subscribe in Calendar
                </a>
                <button
                  onClick={() => void copy(urls.https)}
                  className="border border-pink-400 text-pink-200 px-3 py-1 text-sm hover:bg-zinc-800"
                >
                  {copied ? "Copied!" : "Copy URL"}
                </button>
              </div>
              <code className="block text-[11px] text-pink-300 bg-zinc-900 border border-zinc-800 p-2 break-all select-all">
                {urls.https}
              </code>
              <details className="mt-2 text-xs text-pink-400">
                <summary className="cursor-pointer hover:text-pink-200">
                  How notifications work
                </summary>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Releases: notifies 1 hour and 1 day before</li>
                  <li>
                    Flash sales: notifies 10 minutes and 1 hour before they
                    start
                  </li>
                  <li>
                    Publisher sales: notifies 1 hour and 1 day before they
                    start
                  </li>
                  <li>
                    Preorder windows: notifies 10 min, 1 hour, and 1 day
                    before opens; 1 hour and 1 day before closes
                  </li>
                  <li>Deliveries: notifies on the day of</li>
                </ul>
                <p className="mt-1">
                  All alerts are scheduled by your phone's Calendar app, so
                  they fire even when TomeKeeper is closed or your phone is
                  offline.
                </p>
              </details>
            </>
          )}

          {!loading && !error && !urls && (
            <p className="text-xs text-pink-400">Couldn't load calendar URL.</p>
          )}
        </div>
      )}
    </div>
  );
}
