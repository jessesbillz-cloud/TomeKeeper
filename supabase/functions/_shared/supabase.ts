import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export function getUserId(req: Request): string {
  const token = (req.headers.get("Authorization") ?? "").replace(
    "Bearer ",
    "",
  );
  if (!token) throw new Error("Missing Authorization bearer token");
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(`JWT must have 3 parts, got ${parts.length}`);
  }
  // JWTs are base64url, but atob() expects base64. Translate, then pad.
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const payload = JSON.parse(atob(padded));
  if (!payload.sub) throw new Error("JWT payload has no sub");
  return payload.sub as string;
}
