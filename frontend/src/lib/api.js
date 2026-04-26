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
if (!BASE) {
    throw new Error("Missing VITE_API_BASE_URL. Copy .env.example to .env.local and fill in.");
}
export class ApiError extends Error {
    status;
    body;
    constructor(status, body, message) {
        super(message);
        this.status = status;
        this.body = body;
    }
}
async function authHeader() {
    const { data: { session }, } = await supabase.auth.getSession();
    return session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
}
export async function api(path, init = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...init.headers,
        ...(await authHeader()),
    };
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    if (res.status === 204) {
        return undefined;
    }
    const text = await res.text();
    let body = text;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        /* keep raw text */
    }
    if (!res.ok) {
        const msg = (body && typeof body === "object" && "detail" in body
            ? String(body.detail)
            : null) || `HTTP ${res.status}`;
        throw new ApiError(res.status, body, msg);
    }
    return body;
}
// Sugar for the common verbs.
export const get = (path) => api(path);
export const post = (path, payload) => api(path, { method: "POST", body: JSON.stringify(payload) });
export const patch = (path, payload) => api(path, { method: "PATCH", body: JSON.stringify(payload) });
export const del = (path) => api(path, { method: "DELETE" });
