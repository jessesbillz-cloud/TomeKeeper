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
import { extractId, getIntParam, getQueryParam, getBoolParam } from "../_shared/parse.ts";

const FN = "flash-sales";
const TABLE = "flash_sales";

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
    const activeOnly = getBoolParam(url, "active_only");
    const shop = getQueryParam(url, "shop");

    let q = supabase.from(TABLE).select("*");
    if (activeOnly) {
      const now = new Date().toISOString();
      q = q.lte("starts_at", now).gte("ends_at", now);
    }
    if (shop) q = q.eq("shop", shop);
    const { data, error } = await q
      .order("starts_at")
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
