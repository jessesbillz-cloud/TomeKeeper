import { corsHeaders } from "./cors.ts";

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const created = (data: unknown) => json(data, 201);

export const noContent = () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const notFound = (msg: string) => json({ detail: msg }, 404);

export const badRequest = (msg: string) => json({ detail: msg }, 400);

export const methodNotAllowed = () =>
  json({ detail: "Method not allowed" }, 405);
