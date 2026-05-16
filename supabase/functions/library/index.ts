import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors } from "../_shared/cors.ts";
import { createUserClient, getUserId } from "../_shared/supabase.ts";
import {
  json,
  created,
  notFound,
  noContent,
  badRequest,
  methodNotAllowed,
} from "../_shared/response.ts";
import { extractId, getIntParam, getQueryParam } from "../_shared/parse.ts";

const FN = "library";
const TABLE = "library_entries";

// Always return library entries with the joined edition + work data
// already embedded. Saves the frontend from doing an N+1 fan-out of
// /editions/{id} and /works/{id} calls (which at 3000 books would
// have been ~6000 round trips).
const EMBED_SELECT = "*, edition:editions(*, work:works(*))";

/**
 * Sanitize a user-typed search query so it's safe to interpolate into
 * a PostgREST `.or()` filter string. We:
 *   - replace commas / parens (PostgREST filter separators) with spaces
 *   - drop `%` and `_` (ILIKE wildcards) so users can't accidentally
 *     turn their query into a full-table scan
 *   - cap length at 100 chars
 */
function sanitizeSearch(q: string): string {
  return q
    .replace(/[,()]/g, " ")
    .replace(/[%_]/g, "")
    .trim()
    .slice(0, 100);
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const id = extractId(url, FN);
  const method = req.method;
  const supabase = createUserClient(req);

  if (method === "GET") {
    if (id) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .limit(1)
        .single();
      if (error || !data) return notFound(`${TABLE} ${id} not found`);
      return json(data);
    }
    const limit = getIntParam(url, "limit", 100);
    const offset = getIntParam(url, "offset", 0);
    const statusFilter = getQueryParam(url, "status_filter");
    const editionId = getQueryParam(url, "edition_id");
    const qRaw = getQueryParam(url, "q");

    // Server-side search across the joined work fields. When `q` is
    // present we resolve work_ids → edition_ids → library_entries so
    // the user never has to load their full library into memory.
    if (qRaw) {
      const q = sanitizeSearch(qRaw);
      if (!q) return json([]);

      const { data: works, error: workErr } = await supabase
        .from("works")
        .select("id")
        .or(
          `title.ilike.%${q}%,author.ilike.%${q}%,series.ilike.%${q}%`,
        );
      if (workErr) return badRequest(workErr.message);
      const workIds = (works ?? []).map((w: { id: string }) => w.id);
      if (workIds.length === 0) return json([]);

      const { data: editions, error: edErr } = await supabase
        .from("editions")
        .select("id")
        .in("work_id", workIds);
      if (edErr) return badRequest(edErr.message);
      const editionIds = (editions ?? []).map(
        (e: { id: string }) => e.id,
      );
      if (editionIds.length === 0) return json([]);

      let entryQuery = supabase
        .from(TABLE)
        .select(EMBED_SELECT)
        .in("edition_id", editionIds);
      if (statusFilter) entryQuery = entryQuery.eq("status", statusFilter);
      const { data, error } = await entryQuery
        .order("status_changed_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return badRequest(error.message);
      return json(data ?? []);
    }

    // No search query — paginated list (optionally status-filtered).
    // Still capped at `limit` so we never bulk-load the whole library.
    let q2 = supabase.from(TABLE).select(EMBED_SELECT);
    if (statusFilter) q2 = q2.eq("status", statusFilter);
    if (editionId) q2 = q2.eq("edition_id", editionId);
    const { data, error } = await q2
      .order("status_changed_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return badRequest(error.message);
    return json(data ?? []);
  }

  if (method === "POST" && !id) {
    const body = await req.json();
    body.user_id = getUserId(req);
    const { data, error } = await supabase
      .from(TABLE)
      .insert(body)
      .select()
      .single();
    if (error) return badRequest(error.message);
    return created(data);
  }

  if (method === "PATCH" && id) {
    const body = await req.json();
    // If status is changing, bump status_changed_at
    if (body.status !== undefined) {
      body.status_changed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from(TABLE)
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return notFound(`${TABLE} ${id} not found`);
    return json(data);
  }

  if (method === "DELETE" && id) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) return badRequest(error.message);
    return noContent();
  }

  return methodNotAllowed();
});
