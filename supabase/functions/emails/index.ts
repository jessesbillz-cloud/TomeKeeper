import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors } from "../_shared/cors.ts";
import { createUserClient, getUserId } from "../_shared/supabase.ts";
import {
  json,
  created,
  notFound,
  badRequest,
  methodNotAllowed,
} from "../_shared/response.ts";
import { extractId, getIntParam, getBoolParam } from "../_shared/parse.ts";

const FN = "emails";
const TABLE = "forwarded_emails";

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
    const parsed = getBoolParam(url, "parsed");

    let q = supabase.from(TABLE).select("*");
    if (parsed !== null) q = q.eq("parsed", parsed);
    const { data, error } = await q
      .order("received_at", { ascending: false })
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

  return methodNotAllowed();
});
