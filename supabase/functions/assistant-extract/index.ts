import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { json, badRequest, methodNotAllowed } from "../_shared/response.ts";

/**
 * assistant-extract
 *
 * The "Book Assistant" brain. Takes any combination of free text + images
 * (book-cover photos, screenshots of drop posts) and emits a structured
 * plan of things to add to TomeKeeper. The frontend renders the plan as
 * a review panel; nothing is written to the database here.
 *
 * Two output streams:
 *   1. drops[]          — calendar events (preorder/sale drops). One entry
 *                         per (book × tier). For an Obsidian Descension
 *                         post with patreon/fb/general tiers this is three
 *                         entries.
 *   2. library_books[]  — books to add to Janelle's personal library. Used
 *                         for backfill mode (she uploads a stack of cover
 *                         photos) and for one-off "I bought this" captures.
 *
 * Plus:
 *   3. questions[]      — clarifying questions the model wants to ask
 *                         before committing. Frontend surfaces these as
 *                         inline prompts on the relevant items.
 *
 * Request:
 *   POST /functions/v1/assistant-extract
 *   Body: {
 *     text?: string,                          // pasted post / typed note
 *     images?: Array<{ data_url: string }>,   // screenshots and/or photos
 *     mode?: "auto" | "library_backfill",     // default "auto"
 *     timezone?: string                       // IANA tz, e.g. "America/Chicago"
 *   }
 *
 * Response:
 *   200 {
 *     drops: Array<DropPlan>,
 *     library_books: Array<LibraryBookPlan>,
 *     questions: Array<{ topic: string, question: string }>,
 *     summary: string,
 *     raw: string
 *   }
 *
 * Security: relies on Supabase verify_jwt — only signed-in users can call.
 */

const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const MAX_IMAGES = 8;

const SYSTEM_PROMPT = `You are the Book Assistant for TomeKeeper, a special-edition book tracker. You help Janelle catalog her library and track upcoming preorder/sale drops from indie publishers and book boxes.

Your only job is to look at whatever Janelle gave you (typed text, screenshots of social-media drop posts, photos of physical books) and return a STRUCTURED PLAN of what to add. You do NOT chat. You do NOT explain yourself outside the JSON. You ONLY return the JSON object specified below.

You have two output buckets:

1) "drops" — upcoming sales / preorders / book-box drops to put on the calendar.
   - Each drop describes ONE book × ONE tier. If a post has 3 access tiers (e.g. "Patreon early access at 10am, FB group at 11am, General sale at 12pm"), emit THREE drops. The general/public sale is the "main" tier; the others are "Patreon early access," "FB group early access," etc.
   - If a post lists MULTIPLE BOOKS (e.g. an omnibus collecting Chaos / Caged / Crave / Claim), emit one drop per book, all sharing the same shop/sale_starts_at/price.

2) "library_books" — books Janelle owns or is cataloging.
   - When she uploads photos of physical books on a shelf, treat each photo as one library_book.
   - When the input is a screenshot of a drop post, do NOT also emit a library_book — drops cover that.
   - When mode is "library_backfill", lean toward library_books and only emit a drop if the input clearly describes a future sale.

3) "questions" — surfaces gaps. Use sparingly. Only ask when a critical field is missing AND not inferable. Each question references which item (by index) it pertains to so the UI can attach it.

HARD RULES — these are the patterns from real shop posts; follow them exactly:

- Sale time given but NO close date stated → set is_one_day_sale=true, sale_ends_at = same calendar date at 23:59:59 in the SHOP'S local timezone (the timezone stated in the post). The day must not bleed into the next day.
- "Will close at sell out or [date] at [time]" → is_one_day_sale=false, sale_ends_at = the explicit close.
- Multiple early-access tiers → one drop per tier. Each tier inherits sale_ends_at from the close (general close applies to all tiers unless a tier specifies otherwise).
- Title is redacted/crossed-out/"TBD" → title=null. Add notes: "Cover reveal — title not yet announced." Do NOT invent a title.
- Shop name = the first @handle in the post (twistedfictionbookbox, darkanddisturbedshop, obsidiandescension, etc.) unless a different publisher is named explicitly. Strip the leading "@".
- "Ships in N weeks" / "expected July/August" / "books will arrive [month]" → fills delivery_window (free-form string). NOT release_date. NOT sale_starts_at.
- "$55+ shipping" or "$60 + taxes & shipping" → price=55, shipping_note="+ shipping" (or "+ taxes & shipping").
- Currency assumed USD unless explicitly stated otherwise.
- Edition name: pick from the post (e.g. "June Special Box", "Beneath the Secrets Omnibus"). If nothing is stated, default to "Special edition".
- For library_books from photos: default status="owned". cover_data_url should be the data URL of the source photo (we'll pass it through verbatim).
- ISBN must be 10 or 13 digits. Strip dashes and spaces. NEVER fabricate one.

TIMEZONE RULES — read carefully:
- Look at the post text for an explicit timezone abbreviation: "cst", "cdt", "est", "edt", "pst", "pdt", "mst", "mdt", "gmt", "utc", "bst". If present, that is the SHOP'S timezone — use it as the offset on sale_starts_at and sale_ends_at.
- Be DST-aware. CST is -06:00 in winter and CDT (-05:00) in summer. EST is -05:00 / EDT -04:00. PST is -08:00 / PDT -07:00. The cutover dates in the US are the second Sunday of March (spring forward) and the first Sunday of November (fall back). Pick the correct offset for the sale's actual date.
- Casing varies: "12pm CST", "12 pm cst", "12:00 CT" all mean the same. Treat "CT" / "ET" / "PT" / "MT" as the local zone (whichever DST variant applies).
- If the post does NOT mention a timezone, use the user's timezone (passed as "Timezone: ..." below; default America/Los_Angeles).
- All datetimes returned as ISO 8601 WITH offset (e.g. "2026-04-27T12:00:00-05:00"). NEVER emit "Z" / UTC unless the post explicitly says GMT/UTC.
- All date-only fields as YYYY-MM-DD.

- Set confidence to "low" for any field you guessed at and "high" for fields explicitly stated.

OUTPUT SCHEMA — return ONE object, no markdown, no commentary, no fences:

{
  "drops": [
    {
      "shop": string,                      // required, no leading @
      "title": string|null,                // book title, null if redacted
      "author": string|null,
      "series": string|null,
      "series_number": number|null,
      "edition_name": string,              // required; default "Special edition"
      "tier_name": string|null,            // null = general/public sale; otherwise "Patreon early access" etc.
      "sale_starts_at": string,            // ISO 8601 with offset, required
      "sale_ends_at": string,              // ISO 8601 with offset, required
      "is_one_day_sale": boolean,
      "price": number|null,
      "currency": string,                  // "USD" default
      "shipping_note": string|null,        // "+ shipping", "+ taxes & shipping", null
      "delivery_window": string|null,      // "July/August", "16-18 weeks", etc.
      "isbn": string|null,
      "edition_size": number|null,
      "special_features": string|null,     // bullet-summary; one line
      "cover_image_url": string|null,      // only if a clean cover image URL is in the post
      "notes": string|null,
      "confidence": {                      // per-field confidence
        "title": "high"|"medium"|"low",
        "sale_starts_at": "high"|"medium"|"low",
        "sale_ends_at": "high"|"medium"|"low",
        "price": "high"|"medium"|"low"
      }
    }
  ],
  "library_books": [
    {
      "title": string|null,
      "author": string|null,
      "series": string|null,
      "series_number": number|null,
      "edition_name": string,              // required; default "Standard edition"
      "publisher_or_shop": string|null,
      "isbn": string|null,
      "cover_data_url": string|null,       // pass-through if input was a photo
      "status": "owned"|"upcoming"|"ordered"|"shipped"|"for_sale"|"sold"|"missed",
      "condition": string|null,
      "special_features": string|null,
      "notes": string|null,
      "source_image_index": number|null,   // which input image this came from
      "confidence": {
        "title": "high"|"medium"|"low",
        "author": "high"|"medium"|"low"
      }
    }
  ],
  "questions": [
    {
      "scope": "drop"|"library_book"|"general",
      "index": number|null,                // which drop or library_book this is about
      "field": string,                     // e.g. "title", "edition_name"
      "question": string                   // human-readable
    }
  ],
  "summary": string                        // one-sentence overall summary, e.g. "3 drops + 2 library books found"
}`;

interface DropPlan {
  shop: string;
  title: string | null;
  author: string | null;
  series: string | null;
  series_number: number | null;
  edition_name: string;
  tier_name: string | null;
  sale_starts_at: string;
  sale_ends_at: string;
  is_one_day_sale: boolean;
  price: number | null;
  currency: string;
  shipping_note: string | null;
  delivery_window: string | null;
  isbn: string | null;
  edition_size: number | null;
  special_features: string | null;
  cover_image_url: string | null;
  notes: string | null;
  confidence: Record<string, "high" | "medium" | "low">;
}

interface LibraryBookPlan {
  title: string | null;
  author: string | null;
  series: string | null;
  series_number: number | null;
  edition_name: string;
  publisher_or_shop: string | null;
  isbn: string | null;
  cover_data_url: string | null;
  status:
    | "owned"
    | "upcoming"
    | "ordered"
    | "shipped"
    | "for_sale"
    | "sold"
    | "missed";
  condition: string | null;
  special_features: string | null;
  notes: string | null;
  source_image_index: number | null;
  confidence: Record<string, "high" | "medium" | "low">;
}

interface AssistantPlan {
  drops: DropPlan[];
  library_books: LibraryBookPlan[];
  questions: Array<{
    scope: "drop" | "library_book" | "general";
    index: number | null;
    field: string;
    question: string;
  }>;
  summary: string;
}

/** Pull a base64 payload out of a `data:image/...;base64,...` URL. */
function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

/**
 * Coerce whatever the model returned into the canonical envelope shape.
 * If the model omits a bucket, default to []. This keeps the frontend's
 * code simple — it can always assume drops/library_books/questions exist.
 */
function normalize(parsed: unknown): AssistantPlan {
  const empty: AssistantPlan = {
    drops: [],
    library_books: [],
    questions: [],
    summary: "",
  };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return empty;
  }
  const obj = parsed as Record<string, unknown>;
  return {
    drops: Array.isArray(obj.drops) ? (obj.drops as DropPlan[]) : [],
    library_books: Array.isArray(obj.library_books)
      ? (obj.library_books as LibraryBookPlan[])
      : [],
    questions: Array.isArray(obj.questions)
      ? (obj.questions as AssistantPlan["questions"])
      : [],
    summary: typeof obj.summary === "string" ? obj.summary : "",
  };
}

/**
 * Strip ```json fences or leading prose so JSON.parse succeeds.
 *
 * If the model response was cut off mid-output (max_tokens hit) the trailing
 * JSON will be syntactically incomplete — typically a half-finished object
 * inside an array, missing closing brackets. We try the strict parse first,
 * and if that fails we attempt a salvage: walk back to the last fully-
 * closed object inside the most recently opened array, then synthesize
 * matching closes for whatever scopes are still open. This loses the
 * truncated tail entry but keeps everything that fully arrived, which is
 * vastly better than tossing out 50 cataloged books because the 51st was
 * cut off mid-title.
 */
function extractJson(text: string): unknown {
  let t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) t = fenced[1].trim();
  const first = t.indexOf("{");
  if (first > 0) t = t.slice(first);
  // Strict parse path.
  try {
    return JSON.parse(t);
  } catch (firstErr) {
    const salvaged = salvagePartialJson(t);
    if (salvaged !== null) {
      try {
        return JSON.parse(salvaged);
      } catch {
        // fall through to throw the original error
      }
    }
    throw firstErr;
  }
}

/**
 * Best-effort recovery from a truncated JSON object. Walks the string
 * tracking string-escape state and bracket depth; when we run out of
 * characters mid-stream, we trim back to the last comma-terminated array
 * element, then close every still-open bracket/brace in the right order.
 * Returns the salvaged JSON string, or null if we couldn't make sense of
 * the input.
 */
function salvagePartialJson(input: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  let lastSafeArrayCutIndex = -1;
  let lastSafeStack: string[] = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
    } else if (ch === ",") {
      // A comma at the top-of-stack of an array means "the previous
      // array element was completely received". This is our safe
      // truncation point.
      if (stack[stack.length - 1] === "[") {
        lastSafeArrayCutIndex = i;
        lastSafeStack = [...stack];
      }
    }
  }

  // Nothing was truncated → caller should have succeeded already.
  if (stack.length === 0 && !inString) return input;
  if (lastSafeArrayCutIndex === -1) return null;

  let out = input.slice(0, lastSafeArrayCutIndex);
  // Close every still-open scope in reverse order.
  for (let i = lastSafeStack.length - 1; i >= 0; i--) {
    out += lastSafeStack[i] === "[" ? "]" : "}";
  }
  return out;
}

/**
 * Stitch images and the user-text + mode + timezone hints into a single
 * Anthropic message. The text block gets appended last so the model sees
 * "here are the images, now here are the rules + the user's words."
 */
function buildMessageContent(
  text: string | undefined,
  images: Array<{ data_url: string }>,
  mode: "auto" | "library_backfill",
  timezone: string,
): Array<unknown> {
  const content: Array<unknown> = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const parsed = parseDataUrl(img.data_url);
    if (!parsed) continue;
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: parsed.mediaType,
        data: parsed.base64,
      },
    });
    // Tag each image with its index so the model can reference it via
    // source_image_index on library_books output.
    content.push({
      type: "text",
      text: `[image #${i}]`,
    });
  }
  const userText = (text ?? "").trim();
  const promptTail =
    `Mode: ${mode}\n` +
    `Timezone: ${timezone}\n` +
    (userText
      ? `\nUser's typed input:\n"""\n${userText}\n"""\n`
      : `\n(No typed text provided.)\n`) +
    `\nReturn the JSON object now. Nothing else.`;
  content.push({ type: "text", text: promptTail });
  return content;
}

Deno.serve(async (req: Request) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;
    if (req.method !== "POST") return methodNotAllowed();

    let body: {
      text?: string;
      images?: Array<{ data_url: string }>;
      mode?: "auto" | "library_backfill";
      timezone?: string;
    };
    try {
      body = await req.json();
    } catch (e) {
      return badRequest(
        `Invalid JSON body: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const text = typeof body.text === "string" ? body.text : "";
    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    const mode = body.mode === "library_backfill" ? "library_backfill" : "auto";
    const timezone =
      typeof body.timezone === "string" && body.timezone
        ? body.timezone
        : "America/Los_Angeles";

    if (!text.trim() && images.length === 0) {
      return badRequest(
        "Provide at least one of: text (typed input) or images (screenshots/photos).",
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

    const content = buildMessageContent(text, images, mode, timezone);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        // A shelf photo can yield 50+ library_books, each a small JSON
        // object — that easily blows past 4K output tokens. 16K gives us
        // room for ~80 books in a single batch without truncation.
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
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
    const rawText =
      apiResp.content?.find((b) => b.type === "text")?.text?.trim() ?? "";

    if (!rawText) {
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

    let plan: AssistantPlan;
    try {
      plan = normalize(extractJson(rawText));
    } catch (e) {
      // Hand the raw text back so the frontend can show a "couldn't parse"
      // banner. Janelle can still use the typed assistant text as a hint
      // and add things by hand.
      return json({
        drops: [],
        library_books: [],
        questions: [
          {
            scope: "general",
            index: null,
            field: "_parse",
            question: `I couldn't structure the response. ${
              e instanceof Error ? e.message : String(e)
            }`,
          },
        ],
        summary: "Couldn't parse model output.",
        raw: rawText,
      });
    }

    // For library_books that came from images, splice in the source image's
    // data URL as cover_data_url. The model can't return a base64 blob in
    // its JSON, so we pass through what the user uploaded keyed by index.
    for (const book of plan.library_books) {
      if (
        book.source_image_index !== null &&
        book.source_image_index >= 0 &&
        book.source_image_index < images.length
      ) {
        if (!book.cover_data_url) {
          book.cover_data_url = images[book.source_image_index].data_url;
        }
      }
    }

    return json({ ...plan, raw: rawText });
  } catch (e) {
    console.error("assistant-extract unhandled error:", e);
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
