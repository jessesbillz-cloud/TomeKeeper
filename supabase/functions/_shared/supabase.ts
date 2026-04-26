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
  const payload = JSON.parse(atob(token.split(".")[1]));
  return payload.sub;
}
