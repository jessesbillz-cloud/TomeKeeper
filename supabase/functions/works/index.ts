import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase.ts";
import {
  json,
  created,
  notFound,
  badRequest,
  methodNotAllowed,
} from "../_shared/response.ts";
import { extractId, getIntParam } from "../_shared/parse.ts";

const FN = "works";
const TABLE = "works";

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const id = extractId(url, FN);
  const method = req.method;
  const supabase = createUserClient(req);

  // GET /works  or  GET /works/{id}
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
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("title")
      .range(offset, offset + limit - 1);
    if (error) return badRequest(error.message);
    return json(data ?? []);
  }

  // POST /works
  if (method === "POST" && !id) {
    const body = await req.json();
    const { data, error } = await supabase
      .from(TABLE)
      .insert(body)
      .select()
      .single();
    if (error) return badRequest(error.message);
    return created(data);
  }

  // PATCH /works/{id}
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
