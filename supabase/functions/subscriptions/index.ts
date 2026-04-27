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
import { extractId, getIntParam } from "../_shared/parse.ts";

/**
 * subscriptions
 *
 * CRUD for the user's recurring book-box subscriptions. Mirrors the
 * structure of flash-sales / publisher-sales-events: GET /, GET /:id,
 * POST /, PATCH /:id, DELETE /:id.
 *
 * Schema (see backend/migrations/add_subscriptions.sql):
 *   provider (required), monthly_cost, renewal_date, website, notes,
 *   last_checked_at, next_known_release, next_known_title, next_known_notes
 *
 * RLS limits each user to their own rows.
 */

const FN = "subscriptions";
const TABLE = "subscriptions";

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
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("provider", { ascending: true })
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
    console.error("subscriptions unhandled error:", e);
    const msg =
      e instanceof Error
        ? `${e.name}: ${e.message}\n${e.stack ?? ""}`
        : String(e);
    return new Response(JSON.stringify({ detail: `Unhandled error: ${msg}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
