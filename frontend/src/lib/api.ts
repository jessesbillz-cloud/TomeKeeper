/**
 * Thin wrapper around fetch that:
 *   - prefixes VITE_API_BASE_URL
 *   - attaches the current Supabase access token as a Bearer header
 *   - parses JSON responses
 *   - throws on non-2xx with the response body as the message
 *
 * Pages should never call fetch directly; they call api() so auth + base URL
 * stay consistent.
 */

import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_BASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!BASE) {
  throw new Error(
    "Missing VITE_API_BASE_URL. Copy .env.example to .env.local and fill in.",
  );
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function authHeaderOrThrow(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    // Fail fast with a clean message so pages can show "Please sign in"
    // instead of letting the request hit the server and return a confusing
    // "Missing Authorization bearer token" from the edge function.
    throw new ApiError(
      401,
      { detail: "Not signed in" },
      "Not signed in. Please sign in again.",
    );
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(ANON_KEY ? { apikey: ANON_KEY } : {}),
    ...(init.headers as Record<string, string> | undefined),
    ...(await authHeaderOrThrow()),
  };

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : null) || `HTTP ${res.status}`;
    throw new ApiError(res.status, body, msg);
  }

  return body as T;
}

// Sugar for the common verbs.
export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, payload: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(payload) });
export const patch = <T>(path: string, payload: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(payload) });
export const del = (path: string) => api<void>(path, { method: "DELETE" });
