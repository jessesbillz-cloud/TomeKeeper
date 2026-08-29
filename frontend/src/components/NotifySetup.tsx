import { useEffect, useRef, useState } from "react";

import { ensureNtfyTopic, sendTestNotification } from "../lib/alerts";
import { useAlerts } from "../lib/alertsContext";

/**
 * Phone-notification setup.
 *
 * Renders as a small 🔔 button in the calendar header, next to the
 * calendar-subscribe button. Opening it shows the three things she needs
 * and nothing else: install the app, subscribe to her topic, send
 * herself a test.
 *
 * The topic is her personal channel on ntfy.sh. It is provisioned
 * server-side on first use (`ensure_ntfy_topic`), it never changes, and
 * it survives her reinstalling the app or switching phones — that is the
 * whole reason this app pushes through ntfy rather than through browser
 * push, which quietly dies whenever the subscription goes stale.
 *
 * A pink dot appears on the button when she has bells switched on but
 * has never opened this panel, because alerts with no phone subscribed
 * are the one failure mode she would never otherwise see.
 */

const SEEN_KEY = "tomekeeper:ntfy-setup-seen";

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode — the dot just keeps showing, which is harmless */
  }
}

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function NotifySetup() {
  const { count } = useAlerts();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(hasSeen);
  const [topic, setTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || topic) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const t = await ensureNtfyTopic();
        if (!cancelled) setTopic(t);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, topic]);

  // Click-outside / Escape to dismiss — same behavior as the calendar
  // subscribe dropdown next door.
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

  async function copyTopic() {
    if (!topic) return;
    try {
      await navigator.clipboard.writeText(topic);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Long-press the topic above to copy it manually.");
    }
  }

  async function sendTest() {
    setTestState("sending");
    setError(null);
    try {
      await sendTestNotification();
      setTestState("sent");
      setTimeout(() => setTestState("idle"), 4000);
    } catch (e: unknown) {
      setTestState("idle");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const needsAttention = count > 0 && !seen;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!seen) {
            markSeen();
            setSeen(true);
          }
        }}
        aria-label="Set up phone notifications"
        title="Phone notifications"
        className={[
          "relative border px-2 py-0.5 text-sm leading-none",
          open
            ? "border-pink-400 bg-pink-500 text-black"
            : "border-zinc-700 text-pink-300 hover:bg-zinc-800",
        ].join(" ")}
      >
        🔔
        {needsAttention && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-pink-400"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Set up phone notifications"
          className="absolute right-0 top-full mt-1 w-80 max-w-[90vw] z-30 card p-3 text-sm text-pink-200 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span aria-hidden>🔔</span> Notifications on your phone
            </h3>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-pink-400 hover:text-pink-200 text-base leading-none"
            >
              ×
            </button>
          </div>

          <p className="text-xs text-pink-400 mb-3">
            Tap <strong className="text-pink-200">Notify me</strong> on any
            event and you'll get a banner on your phone at{" "}
            <strong className="text-pink-200">8 AM Pacific</strong> on the day
            it happens. Set this up once — three steps, about a minute.
          </p>

          {loading && (
            <p className="text-xs text-pink-400">Setting up your channel…</p>
          )}
          {error && (
            <p className="text-xs text-red-300 border border-red-800 bg-red-950/40 p-2 mb-2">
              {error}
            </p>
          )}

          {topic && (
            <ol className="space-y-3 text-xs">
              <li>
                <div className="font-semibold text-pink-200 mb-1">
                  1. Install the free ntfy app
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://apps.apple.com/us/app/ntfy/id1625396347"
                    target="_blank"
                    rel="noreferrer"
                    className="border border-pink-400 text-pink-200 px-2 py-1 hover:bg-zinc-800"
                  >
                    iPhone
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
                    target="_blank"
                    rel="noreferrer"
                    className="border border-pink-400 text-pink-200 px-2 py-1 hover:bg-zinc-800"
                  >
                    Android
                  </a>
                </div>
                <p className="text-pink-500 mt-1">
                  No account, no sign-up. It just listens.
                </p>
              </li>

              <li>
                <div className="font-semibold text-pink-200 mb-1">
                  2. Add this topic in the app
                </div>
                <p className="text-pink-400 mb-1">
                  Open ntfy, tap the <strong>+</strong> button, and paste this
                  in:
                </p>
                <code className="block text-[11px] text-pink-300 bg-zinc-900 border border-zinc-800 p-2 break-all select-all mb-1">
                  {topic}
                </code>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void copyTopic()}
                    className="bg-pink-500 text-black px-2 py-1 hover:bg-pink-400"
                  >
                    {copied ? "Copied!" : "Copy topic"}
                  </button>
                  <a
                    href={`ntfy://ntfy.sh/${topic}`}
                    className="border border-zinc-700 text-pink-300 px-2 py-1 hover:bg-zinc-800"
                  >
                    Open in app
                  </a>
                </div>
              </li>

              <li>
                <div className="font-semibold text-pink-200 mb-1">
                  3. Check that it works
                </div>
                <button
                  onClick={() => void sendTest()}
                  disabled={testState === "sending"}
                  className="border border-pink-400 text-pink-200 px-2 py-1 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {testState === "sending"
                    ? "Sending…"
                    : testState === "sent"
                      ? "Sent — check your phone"
                      : "Send me a test notification"}
                </button>
                <p className="text-pink-500 mt-1">
                  Nothing arrived? You can also watch it come in at{" "}
                  <a
                    href={`https://ntfy.sh/${topic}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-pink-300 underline"
                  >
                    ntfy.sh/{topic.slice(0, 14)}…
                  </a>{" "}
                  in a browser.
                </p>
              </li>
            </ol>
          )}

          {topic && (
            <p className="text-[11px] text-pink-500 mt-3 border-t border-zinc-800 pt-2">
              Keep this topic to yourself — anyone who has it can read your
              notifications. It's the only secret involved.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
