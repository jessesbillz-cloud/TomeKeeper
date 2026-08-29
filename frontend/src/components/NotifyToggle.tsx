import type { MouseEvent } from "react";

import {
  notifyDayIsPast,
  notifyDayLabel,
  type AlertTarget,
} from "../lib/alerts";
import { useAlerts } from "../lib/alertsContext";

/**
 * The bell. One control, on every event surface in the app.
 *
 * Off  →  "🔔 Notify me"
 * On   →  "🔔 8 AM Sep 3"     (the exact morning the banner will land)
 * On, but the day has already gone by → "🔔 On · day passed", muted.
 *
 * Showing the date on the button is deliberate: the state that decides
 * whether a tap does anything is visible before the tap, not explained
 * after it.
 *
 * Rows are frequently clickable themselves (a calendar row navigates to
 * the sale), so every click here stops propagation.
 */
export function NotifyToggle({
  target,
  className = "",
}: {
  /** Null when the row carries no id to hang an alert on — renders nothing. */
  target: AlertTarget | null;
  className?: string;
}) {
  const { isOn, isBusy, toggle, ready } = useAlerts();

  if (!target) return null;

  const on = isOn(target);
  const busy = isBusy(target);
  const past = on && notifyDayIsPast(target.notifyDay);

  function onClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!ready || busy) return;
    void toggle(target!);
  }

  const label = !on
    ? "Notify me"
    : past
      ? "On · day passed"
      : target.notifyDay
        ? `8 AM ${notifyDayLabel(target.notifyDay)}`
        : "On";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready || busy}
      aria-pressed={on}
      title={
        on
          ? past
            ? "This event's day has already passed, so no notification will be sent. Tap to switch it off."
            : `You'll get a phone notification at 8 AM Pacific on ${notifyDayLabel(target.notifyDay!)}.`
          : "Get a phone notification at 8 AM Pacific on the day of this event"
      }
      className={[
        "px-2 py-0.5 text-xs border inline-flex items-center gap-1 disabled:opacity-50",
        on
          ? past
            ? "bg-zinc-800 text-pink-400 border-zinc-600"
            : "bg-pink-500 text-black border-pink-400"
          : "bg-zinc-900 text-pink-300 border-zinc-700 hover:bg-zinc-800",
        className,
      ].join(" ")}
    >
      <span aria-hidden>{on ? "🔔" : "🔕"}</span>
      <span>{label}</span>
    </button>
  );
}
