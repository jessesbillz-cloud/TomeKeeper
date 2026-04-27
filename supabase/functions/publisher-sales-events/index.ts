import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
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

// CRUD for publisher sales events. Mirrors the flash-sales endpoint shape so
// the frontend can use the same patterns. RLS on publisher_sales_events
// scopes rows to the calling user via auth.uid().
const FN = "publisher-sales-events";
const TABLE = "publisher_sales_events";

Deno.serve(async (req: Request) => {
  try {
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
      const publisher = getQueryParam(url, "publisher");

      let q = supabase.from(TABLE).select("*");
      if (activeOnly) {
        const now = new Date().toISOString();
        q = q.lte("starts_at", now).gte("ends_at", now);
      }
      if (publisher) q = q.eq("publisher", publisher);
      const { data, error } = await q
        .order("starts_at")
        .range(offset, offset + limit - 1);
      if (error) return badRequest(error.message);
      return json(data ?? []);
    }

    if (method === "POST" && !id) {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch (e) {
        return badRequest(
          `Invalid JSON body: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      try {
        body.user_id = getUserId(req);
      } catch (e) {
        return badRequest(
          `Could not parse JWT: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
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
  } catch (e) {
    console.error("publisher-sales-events unhandled error:", e);
    const msg = e instanceof Error
      ? `${e.name}: ${e.message}\n${e.stack ?? ""}`
      : String(e);
    return new Response(
      JSON.stringify({ detail: `Unhandled error: ${msg}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
