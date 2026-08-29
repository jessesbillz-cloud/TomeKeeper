/**
 * "Notify me about this" — the data layer.
 *
 * One row in `public.event_alerts` per bell she has switched on, keyed by
 * (kind, source_id). A pg_cron job in Postgres resolves each row back to
 * its source at send time and pushes to her ntfy topic at 08:00 Pacific
 * on the day of the event. Exactly one notification per event, enforced
 * by a unique key on the send ledger — nothing here can produce a
 * duplicate, and nothing here needs to know when the cron runs.
 *
 * These reads and writes go straight to Postgres through supabase-js
 * rather than through lib/api.ts, because RLS already scopes the table to
 * the signed-in user and there is nothing for a backend route to add.
 */

import { supabase } from "./supabase";
import type { CalendarEvent, FlashSale, PublisherSalesEvent } from "./types";

/** Must stay in sync with the CHECK constraint on event_alerts.kind. */
export type AlertKind =
  | "release"
  | "preorder_open"
  | "preorder_close"
  | "flash_sale_start"
  | "flash_sale_end"
  | "publisher_sale_start"
  | "publisher_sale_end"
  | "ship"
  | "deliver";

export interface AlertTarget {
  kind: AlertKind;
  sourceId: string;
  /** Local calendar day (Pacific) the notification will land on. */
  notifyDay: string | null;
}

/** Map key for a target. `${kind}:${sourceId}`. */
export function alertKey(kind: AlertKind, sourceId: string): string {
  return `${kind}:${sourceId}`;
}

/**
 * Two kinds that mean "notify me about this sale" and differ only in
 * which end of the window we pin the notification to. A sale gets ONE
 * notification, so a row saved under either kind has to read as "on"
 * whichever way the target resolves later — otherwise a sale she
 * switched on yesterday would show an empty bell once it started
 * running, and tapping it would fail on the unique constraint.
 */
const SIBLING_KIND: Partial<Record<AlertKind, AlertKind>> = {
  flash_sale_start: "flash_sale_end",
  flash_sale_end: "flash_sale_start",
  publisher_sale_start: "publisher_sale_end",
  publisher_sale_end: "publisher_sale_start",
};

/** Every key that would count as "this target is already switched on". */
export function alertKeysFor(target: AlertTarget): string[] {
  const keys = [alertKey(target.kind, target.sourceId)];
  const sibling = SIBLING_KIND[target.kind];
  if (sibling) keys.push(alertKey(sibling, target.sourceId));
  return keys;
}

/** kind:source_id -> the id of the event_alerts row, so we can DELETE it. */
export type AlertMap = ReadonlyMap<string, string>;

interface AlertRow {
  id: string;
  kind: AlertKind;
  source_id: string;
}

export async function fetchAlerts(): Promise<AlertMap> {
  const { data, error } = await supabase
    .from("event_alerts")
    .select("id, kind, source_id");
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as AlertRow[]) {
    map.set(alertKey(row.kind, row.source_id), row.id);
  }
  return map;
}

/** Returns the new row's id. */
export async function createAlert(target: AlertTarget): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("event_alerts")
    .insert({
      user_id: userId,
      kind: target.kind,
      source_id: target.sourceId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function deleteAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from("event_alerts")
    .delete()
    .eq("id", alertId);
  if (error) throw new Error(error.message);
}

/** Provisions the topic on first call; returns it either way. */
export async function ensureNtfyTopic(): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_ntfy_topic");
  if (error) throw new Error(error.message);
  return data as string;
}

/** Fires a test push at her own topic. Returns the topic. */
export async function sendTestNotification(): Promise<string> {
  const { data, error } = await supabase.rpc("send_test_notification");
  if (error) throw new Error(error.message);
  return data as string;
}

// ---------------------------------------------------------------------------
// Day math
//
// Every notification fires at 8 AM PACIFIC on the event's Pacific
// calendar day. The server decides this independently; the functions
// below exist only so the button can show her the date up front instead
// of explaining it after the fact.
// ---------------------------------------------------------------------------

const NOTIFY_TZ = "America/Los_Angeles";

/** UTC timestamp -> `YYYY-MM-DD` in Pacific. */
export function pacificDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    // en-CA renders as YYYY-MM-DD with padded month/day.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: NOTIFY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/** Today in Pacific, as `YYYY-MM-DD`. */
export function pacificToday(): string {
  return pacificDay(new Date().toISOString())!;
}

/**
 * Short label for the day the push lands: "Sep 3". Parsed with the
 * (y, m-1, d) constructor rather than `new Date(str)` — the latter is
 * UTC midnight and renders as the previous day anywhere west of
 * Greenwich, which is everywhere this app is used.
 */
export function notifyDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** True when 8 AM on that day has already gone by. */
export function notifyDayIsPast(day: string | null): boolean {
  if (!day) return false;
  return day < pacificToday();
}

// ---------------------------------------------------------------------------
// Mapping each surface's row onto an alert target
// ---------------------------------------------------------------------------

/**
 * A flash sale gets ONE notification. Normally that is the morning the
 * sale opens; but if the sale is already running when she taps the bell,
 * the open day is behind us and a notification pinned to it would never
 * fire. In that case we pin to the closing day instead, so tapping the
 * bell always buys her a notification she will actually receive.
 */
export function flashSaleTarget(sale: {
  id: string;
  starts_at: string;
  ends_at: string;
}): AlertTarget {
  const startDay = pacificDay(sale.starts_at);
  const today = pacificToday();
  if (startDay && startDay >= today) {
    return { kind: "flash_sale_start", sourceId: sale.id, notifyDay: startDay };
  }
  return {
    kind: "flash_sale_end",
    sourceId: sale.id,
    notifyDay: pacificDay(sale.ends_at),
  };
}

export function flashSaleTargetFor(sale: FlashSale): AlertTarget {
  return flashSaleTarget(sale);
}

export function publisherSaleTargetFor(sale: PublisherSalesEvent): AlertTarget {
  return publisherSaleTarget(sale);
}

export function publisherSaleTarget(event: {
  id: string;
  starts_at: string;
  ends_at: string;
}): AlertTarget {
  const startDay = pacificDay(event.starts_at);
  const today = pacificToday();
  if (startDay && startDay >= today) {
    return {
      kind: "publisher_sale_start",
      sourceId: event.id,
      notifyDay: startDay,
    };
  }
  return {
    kind: "publisher_sale_end",
    sourceId: event.id,
    notifyDay: pacificDay(event.ends_at),
  };
}

/**
 * Calendar day-detail rows. Returns null when the row carries no id we
 * can hang an alert on — without one there is nothing for the sender to
 * resolve, so no bell is offered rather than one that silently does
 * nothing.
 */
export function calendarEventTarget(ev: CalendarEvent): AlertTarget | null {
  switch (ev.type) {
    case "release":
      return ev.edition_id
        ? { kind: "release", sourceId: ev.edition_id, notifyDay: ev.date }
        : null;
    case "preorder_open":
      return ev.edition_id
        ? {
            kind: "preorder_open",
            sourceId: ev.edition_id,
            notifyDay: pacificDay(ev.at) ?? ev.date,
          }
        : null;
    case "preorder_close":
      return ev.edition_id
        ? {
            kind: "preorder_close",
            sourceId: ev.edition_id,
            notifyDay: pacificDay(ev.at) ?? ev.date,
          }
        : null;
    case "flash_sale":
      return ev.flash_sale_id && ev.starts_at && ev.ends_at
        ? flashSaleTarget({
            id: ev.flash_sale_id,
            starts_at: ev.starts_at,
            ends_at: ev.ends_at,
          })
        : null;
    // Both the "sale starts" and "sale ends" rows resolve to the same
    // single alert for that sale — one sale, one notification, whichever
    // row she happened to tap the bell on.
    case "publisher_sale_start":
    case "publisher_sale_end":
      return ev.publisher_sale_event_id && ev.starts_at && ev.ends_at
        ? publisherSaleTarget({
            id: ev.publisher_sale_event_id,
            starts_at: ev.starts_at,
            ends_at: ev.ends_at,
          })
        : null;
    case "ship":
      return ev.order_id
        ? { kind: "ship", sourceId: ev.order_id, notifyDay: ev.date }
        : null;
    case "deliver":
      return ev.order_id
        ? { kind: "deliver", sourceId: ev.order_id, notifyDay: ev.date }
        : null;
    default:
      return null;
  }
}
