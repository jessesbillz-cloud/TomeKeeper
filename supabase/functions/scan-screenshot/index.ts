import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { json, badRequest, methodNotAllowed } from "../_shared/response.ts";

/**
 * scan-screenshot
 *
 * Takes a screenshot (typically of a publisher / shop product page or a
 * social-media flash-sale post) and uses Claude vision to extract the
 * fields TomeKeeper cares about. Janelle uploads a screenshot from the
 * Home or Capture page and lands on Capture with everything prefilled,
 * needing only to review and tap Save.
 *
 * Request:
 *   POST /functions/v1/scan-screenshot
 *   Body: { image_data_url: "data:image/jpeg;base64,..." }
 *
 * Response:
 *   200 { fields: {...}, raw: "<the model's raw text>" }
 *   400 if the body or image is malformed
 *   500 if the upstream Anthropic call fails
 *
 * Security: this function relies on Supabase's `verify_jwt` setting (the
 * default for new functions) so only signed-in users can call it.
 */

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

// The set of fields Capture.tsx renders. The model is asked to emit exactly
// this shape; missing fields come back as null. Keep in sync with the form
// state in frontend/src/pages/Capture.tsx.
const SCHEMA_DESCRIPTION = `Return a JSON object with this exact shape (no extra keys):
{
  "title": string|null,                // book title
  "author": string|null,
  "series": string|null,               // series name if part of one
  "series_number": number|null,        // integer position in the series
  "edition_name": string|null,         // e.g. "Illumicrate exclusive", "Goldsboro signed"
  "publisher_or_shop": string|null,    // shop or publisher running the edition
  "retailer": string|null,             // where you'd buy it (often same as shop)
  "release_date": string|null,         // YYYY-MM-DD, the on-sale date
  "isbn": string|null,                 // 10 or 13 digits, no dashes
  "edition_size": number|null,         // print-run number if visible
  "special_features": string|null,     // sprayed edges, signed, foiled, etc. — short phrase
  "preorder_start_at": string|null,    // ISO 8601 datetime if a preorder window is shown
  "preorder_end_at": string|null,      // ISO 8601 datetime
  "notes": string|null                 // anything else worth keeping
}

Rules:
- If a field isn't shown or isn't reasonably inferable, use null.
- Don't invent ISBNs or page counts.
- For series_number, only emit an integer (e.g. "Book 2 of 4" -> 2).
- For dates, prefer the explicit date shown. Convert "5 March 2026" -> "2026-03-05".
- For preorder windows, only emit them if the screenshot clearly shows a window.
- Return ONLY the JSON object, no markdown fences, no commentary.`;

const SYSTEM_PROMPT = `You are an extraction tool for TomeKeeper, a special-edition book tracker. Your job is to look at a screenshot of a book page (publisher site, indie shop, social-media post) and pull out structured fields about the edition. Be conservative: if you're not sure, return null. Output only JSON.`;

interface ExtractedFields {
  title: string | null;
  author: string | null;
  series: string | null;
  series_number: number | null;
  edition_name: string | null;
  publisher_or_shop: string | null;
  retailer: string | null;
  release_date: string | null;
  isbn: string | null;
  edition_size: number | null;
  special_features: string | null;
  preorder_start_at: string | null;
  preorder_end_at: string | null;
  notes: string | null;
}

/** Pull a base64 payload out of a `data:image/...;base64,...` URL. */
function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

/**
 * Claude often returns clean JSON when asked, but occasionally wraps it in a
 * ```json fence or adds a one-line preamble. Strip both before JSON.parse.
 */
function extractJson(text: string): unknown {
  let t = text.trim();
  // Strip ```json ... ``` or ``` ... ``` fences.
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) t = fenced[1].trim();
  // If there's leading prose, find the first { and last }.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first > 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

Deno.serve(async (req: Request) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") return methodNotAllowed();

    let body: { image_data_url?: string };
    try {
      body = await req.json();
    } catch (e) {
      return badRequest(
        `Invalid JSON body: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const dataUrl = body.image_data_url;
    if (!dataUrl || typeof dataUrl !== "string") {
      return badRequest("Missing image_data_url (data URL string).");
    }
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return badRequest(
        "image_data_url must look like data:image/<type>;base64,<payload>",
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          detail:
            "ANTHROPIC_API_KEY is not set. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: parsed.mediaType,
                  data: parsed.base64,
                },
              },
              {
                type: "text",
                text: SCHEMA_DESCRIPTION,
              },
            ],
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("anthropic non-2xx:", upstream.status, errText);
      return new Response(
        JSON.stringify({
          detail: `Anthropic API error ${upstream.status}: ${errText.slice(0, 500)}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiResp = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      apiResp.content?.find((b) => b.type === "text")?.text?.trim() ?? "";

    if (!text) {
      return new Response(
        JSON.stringify({
          detail: "Anthropic returned an empty response.",
          raw: apiResp,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let parsedFields: ExtractedFields;
    try {
      parsedFields = extractJson(text) as ExtractedFields;
    } catch (e) {
      // Hand back the raw text so the frontend can surface a "couldn't parse"
      // banner rather than crashing. Janelle can still fill the form by hand.
      return new Response(
        JSON.stringify({
          detail: `Couldn't parse model output as JSON: ${
            e instanceof Error ? e.message : String(e)
          }`,
          raw: text,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return json({ fields: parsedFields, raw: text });
  } catch (e) {
    console.error("scan-screenshot unhandled error:", e);
    const msg =
      e instanceof Error
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
