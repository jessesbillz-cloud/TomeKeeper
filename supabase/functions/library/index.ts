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
    const limit = getIntParam(url, "limit", 200);
    const offset = getIntParam(url, "offset", 0);
    const statusFilter = getQueryParam(url, "status_filter");
    const editionId = getQueryParam(url, "edition_id");

    let q = supabase.from(TABLE).select("*");
    if (statusFilter) q = q.eq("status", statusFilter);
    if (editionId) q = q.eq("edition_id", editionId);
    const { data, error } = await q
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
