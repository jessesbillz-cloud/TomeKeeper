import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  alertKeysFor,
  createAlert,
  deleteAlert,
  fetchAlerts,
  type AlertTarget,
} from "./alerts";

/**
 * One copy of "which events am I being notified about" for the whole
 * app.
 *
 * The same sale shows up on the calendar day-detail rows and on the
 * Flash Sales screen; a bell tapped on one has to be lit on the other
 * the moment she navigates. A single shared map, fetched once on mount,
 * is what makes that true — and it also means the day grid isn't firing
 * one query per visible row.
 *
 * Toggles are optimistic: the bell flips immediately, the write follows,
 * and a failure rolls the bell back and surfaces the message. Tapping a
 * bell is not allowed to feel slow.
 */

type AlertsContextValue = {
  /** False until the first fetch lands; bells render inert until then. */
  ready: boolean;
  /** Last write/read failure, or null. */
  error: string | null;
  clearError: () => void;
  isOn: (target: AlertTarget | null | undefined) => boolean;
  /** In flight, so the button can disable itself against double taps. */
  isBusy: (target: AlertTarget | null | undefined) => boolean;
  toggle: (target: AlertTarget) => Promise<void>;
  /** Switch one on without toggling — used right after a row is created. */
  turnOn: (target: AlertTarget) => Promise<void>;
  /** How many bells are currently lit. Drives the setup-panel nudge. */
  count: number;
};

const AlertsContext = createContext<AlertsContextValue>({
  ready: false,
  error: null,
  clearError: () => {},
  isOn: () => false,
  isBusy: () => false,
  toggle: async () => {},
  turnOn: async () => {},
  count: 0,
});

export function useAlerts(): AlertsContextValue {
  return useContext(AlertsContext);
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await fetchAlerts();
        if (!cancelled) setAlerts(new Map(map));
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** The stored key for this target, if any of its kinds is switched on. */
  const findKey = useCallback(
    (target: AlertTarget): string | null => {
      for (const key of alertKeysFor(target)) {
        if (alerts.has(key)) return key;
      }
      return null;
    },
    [alerts],
  );

  const isOn = useCallback(
    (target: AlertTarget | null | undefined) =>
      target ? findKey(target) !== null : false,
    [findKey],
  );

  const isBusy = useCallback(
    (target: AlertTarget | null | undefined) =>
      target ? alertKeysFor(target).some((k) => busy.has(k)) : false,
    [busy],
  );

  const withBusy = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setBusy((prev) => new Set(prev).add(key));
      try {
        await fn();
      } finally {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [],
  );

  const turnOn = useCallback(
    async (target: AlertTarget) => {
      if (findKey(target)) return;
      const key = alertKeysFor(target)[0];
      // Optimistic: light the bell now under a placeholder id, and swap
      // in the real row id when the insert returns.
      setAlerts((prev) => new Map(prev).set(key, "pending"));
      setError(null);
      await withBusy(key, async () => {
        try {
          const id = await createAlert(target);
          setAlerts((prev) => new Map(prev).set(key, id));
        } catch (e: unknown) {
          setAlerts((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    },
    [findKey, withBusy],
  );

  const toggle = useCallback(
    async (target: AlertTarget) => {
      const existingKey = findKey(target);
      if (!existingKey) {
        await turnOn(target);
        return;
      }
      const id = alerts.get(existingKey)!;
      const snapshot = new Map(alerts);
      setAlerts((prev) => {
        const next = new Map(prev);
        next.delete(existingKey);
        return next;
      });
      setError(null);
      await withBusy(existingKey, async () => {
        try {
          if (id !== "pending") await deleteAlert(id);
        } catch (e: unknown) {
          setAlerts(snapshot);
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    },
    [alerts, findKey, turnOn, withBusy],
  );

  const value = useMemo<AlertsContextValue>(
    () => ({
      ready,
      error,
      clearError: () => setError(null),
      isOn,
      isBusy,
      toggle,
      turnOn,
      count: alerts.size,
    }),
    [ready, error, isOn, isBusy, toggle, turnOn, alerts.size],
  );

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}
