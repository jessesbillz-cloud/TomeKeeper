import { createContext, useContext } from "react";

/**
 * Shared "what calendar day is the user currently looking at on Home"
 * state. Lives at the Layout level so the global floating "+ Sale"
 * button (rendered by Layout) can pick up the day Home has selected
 * and forward it on to /flash-sales as `?starts=YYYY-MM-DD`, exactly
 * the way the old inline "+ Flash sale" Link on the dashboard used to.
 *
 * Contract:
 *   - Home pushes its selected day (ISO `YYYY-MM-DD`, local) whenever
 *     the user taps a calendar cell, and resets to null on unmount so
 *     other pages don't carry stale day-context.
 *   - Layout reads `selectedDay` synchronously inside the button's
 *     onClick — if non-null we add `?starts=`, otherwise we don't.
 *   - Default value (null + no-op setter) lets any consumer rendered
 *     outside the provider read safely; it just means "no day
 *     selected", which is the right fallback.
 */
export type SelectedDayContextValue = {
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;
};

export const SelectedDayContext = createContext<SelectedDayContextValue>({
  selectedDay: null,
  setSelectedDay: () => {},
});

export function useSelectedDay(): SelectedDayContextValue {
  return useContext(SelectedDayContext);
}
