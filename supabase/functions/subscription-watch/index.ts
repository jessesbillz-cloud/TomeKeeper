import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { json, badRequest } from "../_shared/response.ts";

/**
 * subscription-watch
 *
 * Scheduled function (intended to run once per day via pg_cron). Walks
 * every subscription that has a `website` value, fetches the HTML, asks
 * Claude to surface "next box / next release" information, and writes
 * the result back into the row's next_known_* fields plus
 * last_checked_at.
 *
 * Runs with the service-role key so it sees every user's rows. Service
 * role bypasses RLS; we still scope by user_id implicitly because we
 * patch by id.
 *
 * Skip rules:
 *   - No website → skip (we have nothing to look at).
 *   - Already checked within the last 18 hours → skip (stay polite).
 *   - Body is huge (>200KB after strip) → truncate.
 *
 * The scheduler is wired up in
 *   backend/migrations/add_subscription_watch_cron.sql
 * which schedules a once-daily call to this endpoint via pg_cron + pg_net.
 *
 * Manual trigger:
 *   POST /subscription-watch       → check everyone (cron path)
 *   POST /subscription-watch?id=…  → check just one row (debug from UI)
 */

const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const FRESHNESS_HOURS = 18;
const MAX_HTML_BYTES = 200_000; // bytes of cleaned text shipped to Claude

const SYSTEM_PROMPT = `You are a research assistant helping a special-edition book collector track when her book-box subscriptions ship the next box. You will be given the human-visible text content of a subscription website. Your only job is to find the NEXT upcoming box or release and return a single JSON object describing it.

Return ONLY this JSON, with no surrounding prose, no markdown, no code fences:

{
  "next_known_release": "YYYY-MM-DD" | null,
  "next_known_title":   string | null,
  "next_known_notes":   string | null,
  "found":              boolean,
  "confidence":         "high" | "medium" | "low"
}

Rules:
- "Next" means the next upcoming or currently-running box/drop. Past boxes do NOT count.
- If the page only mentions a month (e.g. "July box") and no day, set next_known_release to the FIRST day of that month and add a note like "Estimated — page only said July".
- If the page mentions a date range ("ships July 15-20"), use the EARLIEST date.
- If only a season is mentioned ("Summer box"), set next_known_release=null but populate next_known_notes with the season + year.
- If you can't find anything useful at all, set found=false and leave the other fields null.
- next_known_title should be the box theme/title only (e.g. "July Smutty Sins Box", "Beneath the Secrets — Volume II"), NOT the shop name.
- Confidence: "high" if you found an explicit dated announcement of the next box; "medium" if you inferred from a month/season; "low" if you guessed from indirect signals.
- NEVER fabricate dates. Better to return found=false than to invent.`;

interface SubscriptionRow {
  id: string;
  provider: string;
  website: string | null;
  last_checked_at: string | null;
}

interface WatchResult {
  next_known_release: string | null;
  next_known_title: string | null;
  next_known_notes: string | null;
  found: boolean;
  confidence: "high" | "medium" | "low";
}

/**
 * Strip HTML to roughly the human-visible text. Not perfect — we just
 * want enough signal for Claude to read. We drop <script>/<style>/<svg>
 * blocks first because those dwarf real content on most marketing pages.
 */
function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  s = s.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ");
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");
  // Drop tags but keep their text content.
  s = s.replace(/<[^>]+>/g, " ");
  // Decode the few entities that show up most often.
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

async function fetchSiteText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TomeKeeperBot/1.0; +https://tomekeeper.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`subscription-watch: ${url} returned ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("html")) {
      console.warn(`subscription-watch: ${url} content-type=${ct}`);
      return null;
    }
    const html = await res.text();
    let text = htmlToText(html);
    if (text.length > MAX_HTML_BYTES) {
      text = text.slice(0, MAX_HTML_BYTES);
    }
    return text || null;
  } catch (e) {
    console.warn(
      `subscription-watch: fetch failed for ${url}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return null;
  }
}

async function askClaude(
  provider: string,
  url: string,
  text: string,
  apiKey: string,
): Promise<WatchResult | null> {
  const userMsg =
    `Subscription provider: ${provider}\n` +
    `Website: ${url}\n` +
    `Today: ${new Date().toISOString().slice(0, 10)}\n\n` +
    `--- PAGE TEXT ---\n${text}\n--- END PAGE TEXT ---\n\n` +
    `Return only the JSON object.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(
      `subscription-watch: Anthropic error ${res.status}: ${body.slice(0, 400)}`,
    );
    return null;
  }
  const data = await res.json();
  const content = data?.content?.[0]?.text ?? "";
  if (!content) return null;
  // Be forgiving: if the model wrapped the JSON in stray text, find the
  // first '{' and the last '}'.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch (e) {
    console.warn(
      `subscription-watch: JSON parse failed: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const result: WatchResult = {
    next_known_release:
      typeof o.next_known_release === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.next_known_release)
        ? o.next_known_release
        : null,
    next_known_title:
      typeof o.next_known_title === "string" && o.next_known_title.trim()
        ? o.next_known_title.trim()
        : null,
    next_known_notes:
      typeof o.next_known_notes === "string" && o.next_known_notes.trim()
        ? o.next_known_notes.trim()
        : null,
    found: o.found === true,
    confidence:
      o.confidence === "high" || o.confidence === "medium" || o.confidence === "low"
        ? o.confidence
        : "low",
  };
  return result;
}

interface CheckSummary {
  id: string;
  provider: string;
  website: string;
  status: "updated" | "skipped" | "no_findings" | "fetch_failed" | "model_failed";
  next_known_release?: string | null;
  next_known_title?: string | null;
  confidence?: string;
}

async function checkOne(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  row: SubscriptionRow,
  force = false,
): Promise<CheckSummary> {
  if (!row.website) {
    return {
      id: row.id,
      provider: row.provider,
      website: "",
      status: "skipped",
    };
  }
  if (!force && row.last_checked_at) {
    const ageMs = Date.now() - new Date(row.last_checked_at).getTime();
    if (ageMs < FRESHNESS_HOURS * 60 * 60 * 1000) {
      return {
        id: row.id,
        provider: row.provider,
        website: row.website,
        status: "skipped",
      };
    }
  }

  const text = await fetchSiteText(row.website);
  if (!text) {
    // Still mark last_checked_at so we don't pound a broken site every
    // single run — better to come back tomorrow.
    await supabase
      .from("subscriptions")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      id: row.id,
      provider: row.provider,
      website: row.website,
      status: "fetch_failed",
    };
  }

  const result = await askClaude(row.provider, row.website, text, apiKey);
  if (!result) {
    await supabase
      .from("subscriptions")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      id: row.id,
      provider: row.provider,
      website: row.website,
      status: "model_failed",
    };
  }

  // Only overwrite next_known_* when we actually found something. If
  // the model came back found=false we still bump last_checked_at, but
  // we leave any older known data in place (better than blanking it).
  const patch: Record<string, unknown> = {
    last_checked_at: new Date().toISOString(),
  };
  if (result.found) {
    patch.next_known_release = result.next_known_release;
    patch.next_known_title = result.next_known_title;
    patch.next_known_notes =
      result.next_known_notes ??
      (result.confidence === "low" ? "Low-confidence guess" : null);
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(patch)
    .eq("id", row.id);
  if (error) {
    console.warn(
      `subscription-watch: update failed for ${row.id}: ${error.message}`,
    );
  }

  return {
    id: row.id,
    provider: row.provider,
    website: row.website,
    status: result.found ? "updated" : "no_findings",
    next_known_release: result.next_known_release,
    next_known_title: result.next_known_title,
    confidence: result.confidence,
  };
}

Deno.serve(async (req: Request) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
      return badRequest(`Use POST. Got ${req.method}.`);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return badRequest("ANTHROPIC_API_KEY is not configured.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return badRequest("Service role credentials are not configured.");
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const onlyId = url.searchParams.get("id");
    const force = url.searchParams.get("force") === "true";

    let query = supabase
      .from("subscriptions")
      .select("id, provider, website, last_checked_at")
      .not("website", "is", null);
    if (onlyId) query = query.eq("id", onlyId);

    const { data, error } = await query;
    if (error) return badRequest(error.message);

    const rows = (data ?? []) as SubscriptionRow[];
    const summaries: CheckSummary[] = [];
    // Sequential — we'd rather be polite to the destination sites and
    // to the Anthropic API rate limit than blast everything in parallel.
    for (const row of rows) {
      const summary = await checkOne(supabase, apiKey, row, force);
      summaries.push(summary);
    }

    return json({
      checked: summaries.length,
      results: summaries,
    });
  } catch (e) {
    console.error("subscription-watch unhandled error:", e);
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
