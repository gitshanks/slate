import "server-only";
import {
  intentToDiscoverParams,
  MOVIE_GENRES,
  TV_GENRES,
  type SearchIntent,
} from "@/lib/ai-search";
import {
  discover,
  getPersonCredits,
  getRecommendationsFor,
  getRecommendedFromWatched,
  searchMulti,
  type TmdbMediaResult,
} from "@/lib/tmdb";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ─── Provider resolution ────────────────────────────────────────────
//
// Mirrors lib/ai-search.ts so both modules stay in lockstep on which
// backend wins when both keys are set.

type Provider = "anthropic" | "openai";

function resolveProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (explicit === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

const PROVIDER = resolveProvider();
export const aiChatEnabled = PROVIDER !== null;

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "llama-3.3-70b-versatile";
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

// ─── Wire types ─────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "search_start" }
  | {
      type: "search_result";
      intent: SearchIntent;
      results: TmdbMediaResult[];
    }
  | { type: "done" }
  | { type: "error"; message: string };

// ─── Tool definition ────────────────────────────────────────────────

const ALL_GENRES = Array.from(
  new Set([...Object.keys(MOVIE_GENRES), ...Object.keys(TV_GENRES)]),
).join(", ");

// One JSON schema, reused for both providers' tool-definition shapes.
// Mirrors `SearchIntent` minus `interpretation` (the chat prose replaces it).
//
// Designed conservatively for Llama-3.3-70B function calling on Groq:
// - no `type: ["X", "null"]` unions (Llama generates `null` literals that
//   sometimes fail Groq's tool-call validator).
// - nullable fields are simply optional (omitted from `required`).
// - no `enum` containing `null`.
// - no `additionalProperties: false` (overly strict — Llama occasionally
//   emits an extra commentary field and Groq rejects the whole call).
// `normalizeIntent()` below treats missing or extra fields as "no constraint".
const SEARCH_TOOL_PARAMETERS = {
  type: "object" as const,
  properties: {
    media_type: {
      type: "string",
      enum: ["movie", "tv", "both"],
      description: "What flavour of result the user wants. Default 'both' unless implied.",
    },
    genres: {
      type: "array",
      items: { type: "string" },
      description: `0-3 lowercase genre names from this set: ${ALL_GENRES}. Empty array if no genre constraint.`,
    },
    year_min: {
      type: "integer",
      description: "Earliest release year. Omit if no lower bound. e.g. '90s' -> 1990.",
    },
    year_max: {
      type: "integer",
      description: "Latest release year. Omit if no upper bound. e.g. '90s' -> 1999.",
    },
    query_text: {
      type: "string",
      description:
        "Residual free-text keyword (title fragment, person, franchise). Omit if the query is purely descriptive.",
    },
    sort_by: {
      type: "string",
      enum: ["popularity", "rating", "recent"],
      description:
        "'rating' for best-of / highly rated, 'recent' for new / latest, 'popularity' otherwise. Omit for default popularity.",
    },
    min_rating: {
      type: "number",
      description: "TMDB user rating floor (0-10). Omit for no floor.",
    },
  },
  // Keep required minimal — anything Llama can sensibly omit shouldn't be
  // mandatory, since Groq's validator is strict about presence.
  required: ["media_type", "genres"],
};

// Schema for `find_similar`. Tiny on purpose — the title is the only thing
// the model has to provide, the recommendations come from TMDB's curated list.
const SIMILAR_TOOL_PARAMETERS = {
  type: "object" as const,
  properties: {
    title: {
      type: "string",
      description:
        "The exact title the user wants similar shows or movies to. e.g. 'Friends', 'Inception', 'Studio Ghibli'.",
    },
    media_type: {
      type: "string",
      enum: ["movie", "tv", "both"],
      description:
        "What flavour of result the user wants. Omit for 'both' if unclear.",
    },
  },
  required: ["title"],
};

const SEARCH_TOOL_NAME = "search_titles";
const SEARCH_TOOL_DESCRIPTION =
  "Browse the catalogue by descriptive filters: genre, year range, sort preference, or a free-text keyword (a person, franchise, or general descriptor). Use this for filter-style discovery like 'feel-good 90s rom-coms', 'highly rated horror', 'Christopher Nolan thrillers'. Returns up to 16 candidates.";

const SIMILAR_TOOL_NAME = "find_similar";
const SIMILAR_TOOL_DESCRIPTION =
  "Find titles similar to a SPECIFIC named show or movie. Use this whenever the user says 'like X', 'similar to X', 'something like X', 'more X', etc. Returns curated recommendations from the catalogue, NOT generic genre matches.";

const LIBRARY_TOOL_NAME = "recommend_from_library";
const LIBRARY_TOOL_DESCRIPTION =
  "Recommend titles personalised to the user's existing watchlist. Use this WHENEVER the user mentions 'my library', 'based on what I've watched', 'something I'd like', 'recommend me a show', 'what should I watch', or any personalised request. The tool reads the user's actual watched titles in slate and surfaces TMDB-curated recommendations linked to those, ranked by co-occurrence so titles surfaced by multiple of their favourites float to the top.";

// Schema for `recommend_from_library` — no required args, just an optional
// media type filter. The whole point of this tool is that it works WITHOUT
// the model having to guess what the user has watched.
const LIBRARY_TOOL_PARAMETERS = {
  type: "object" as const,
  properties: {
    media_type: {
      type: "string",
      enum: ["movie", "tv", "both"],
      description:
        "Restrict to movies or TV. Default 'both' unless the user specifies one.",
    },
  },
  required: [],
};

const CHAT_SYSTEM = `You are a warm, witty, opinionated movie and TV recommendation assistant inside a personal watchlist app called slate. The user is browsing for something to watch.

For every user message you MUST:
1. Pick the right tool:
   - "based on my library", "what should I watch", "recommend me something", "something I'd like" → use \`recommend_from_library\`. This reads the user's actual watched titles.
   - "like X", "similar to X", "more X" (a specific named title) → use \`find_similar\`.
   - everything else (genre/era/mood/keyword discovery) → use \`search_titles\`.
2. After the tool returns, ALWAYS name 2-3 specific titles taken DIRECTLY from the tool's result list. Each gets a brief one-line take describing why it fits.
3. End with a natural follow-up question when it fits ("seen these?", "want something darker?", "anything from the 70s instead?").

ABSOLUTE GROUNDING RULE — read carefully:
- Every title you mention in prose MUST appear, verbatim, in the tool's result list for THIS turn. You are not allowed to recall titles from your training, even if you "know" the user wants Fight Club or Inception. If it isn't in the result list, you cannot name it.
- Before writing your prose, scan the tool's result list. Pick 2-3 titles from THAT list. Then write about THOSE titles. If the list contains "Snatch (2000), Fight Club (1999), Spy Game (2001)…" you talk about those — even if the user asked for "secret society movies".
- The tool's results may not perfectly match the user's prompt — the system relaxes filters automatically when nothing exact matches. When the match is loose, frame honestly: "not quite a secret-society film, but [Title from list] is the closest in vibe…", "the catalogue doesn't have that exact thing, but [Title from list] gets close because…".
- NEVER respond with "the catalogue's thin on that", "no results", or "try rephrasing" if titles exist in the result list. Recommend whatever is there.
- Only if the result list is genuinely empty (zero items) may you ask the user to rephrase — and offer one concrete fallback genre they could try.

Voice rules — strict:
- Never mention tool names, function calls, JSON, "searching", "databases", or how you find things. Just talk about the shows directly.
- Don't write prose like "I'll search for…" or "let me find…" — just respond with the answer.
- No bullet lists. Conversational, like a friend with great taste.
- Do not reuse stock phrases like "comfort-watch champion" or "the vibes hold up" from these instructions. Write fresh one-liners specific to each title.

Length: 2-4 sentences. Always include at least 2 title names from the result list.`;

// ─── Public entry point ─────────────────────────────────────────────

/**
 * Stream a multi-turn chat with tool use over an async iterator.
 * Caller (the route handler) serialises events to the wire.
 */
export async function* streamChat(
  messages: ChatMessage[],
): AsyncIterableIterator<ChatEvent> {
  if (!PROVIDER) {
    yield { type: "error", message: "AI chat is not configured" };
    return;
  }
  try {
    if (PROVIDER === "openai") {
      yield* streamOpenAIChat(messages);
    } else {
      yield* streamAnthropicChat(messages);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "chat failed";
    yield { type: "error", message };
  }
}

// ─── Tool execution ─────────────────────────────────────────────────
//
// Both tools produce the same `ToolResult` shape so the calling code
// can treat them uniformly. `intent` is rendered as the chip below the
// model's prose; `results` becomes the inline poster rail; `summary`
// is the compact textual list the model gets back as the tool result.

interface ToolResult {
  intent: SearchIntent;
  results: TmdbMediaResult[];
  /** Compact string the model gets back as the tool result. */
  summary: string;
}

/** Dispatcher: pick the right executor for the tool name the model called. */
async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
): Promise<ToolResult> {
  if (name === SIMILAR_TOOL_NAME) return executeFindSimilar(rawArgs);
  if (name === LIBRARY_TOOL_NAME) return executeRecommendFromLibrary(rawArgs);
  return executeSearchTitles(rawArgs);
}

/**
 * `recommend_from_library` — reads the user's watched titles from supabase
 * and asks TMDB for curated recommendations linked to each. This is the
 * personalised path; without it the model used to fall back to generic
 * popular TV (Law & Order, The Rookie…) for "what should I watch".
 *
 * Falls back to discover('popular') if the user has no watched titles, so
 * the rail is never empty.
 */
async function executeRecommendFromLibrary(
  rawArgs: Record<string, unknown>,
): Promise<ToolResult> {
  const mt = rawArgs.media_type;
  const wantedMediaType: "movie" | "tv" | "both" =
    mt === "movie" || mt === "tv" ? mt : "both";

  const intent: SearchIntent = {
    media_type: wantedMediaType,
    genres: [],
    year_min: null,
    year_max: null,
    query_text: null,
    sort_by: null,
    min_rating: null,
    interpretation: "based on your library",
  };

  let recs = await getRecommendedFromWatched();
  // getRecommendedFromWatched returns the broader TmdbSearchResult shape.
  // Filter to media + media_type. The function already strips persons.
  const filtered = recs
    .filter(
      (r): r is TmdbMediaResult =>
        (r.media_type === "movie" || r.media_type === "tv") &&
        (wantedMediaType === "both" || r.media_type === wantedMediaType),
    )
    .slice(0, 16);

  if (filtered.length > 0) {
    return { intent, results: filtered, summary: summarizeResults(filtered) };
  }

  // Empty library or no usable recs — fall back to popular discovery so
  // the user still sees something. We pick a popularity sort with a vote
  // floor; that mirrors how the rest of the app surfaces "what's hot".
  const fallback = await runDiscoverForIntent({
    ...intent,
    sort_by: "popularity",
  });
  recs = fallback;
  return {
    intent: { ...intent, interpretation: "popular picks (your library is empty)" },
    results: fallback.slice(0, 16),
    summary: summarizeResults(fallback.slice(0, 16)),
  };
}

/**
 * `find_similar` — for "shows like X" queries. Resolves the user's named
 * title to a TMDB ID via search, then asks TMDB for its curated
 * /recommendations list. Way better than guessing genre filters.
 */
async function executeFindSimilar(
  rawArgs: Record<string, unknown>,
): Promise<ToolResult> {
  const title = typeof rawArgs.title === "string" ? rawArgs.title.trim() : "";
  const mt = rawArgs.media_type;
  const wantedMediaType: "movie" | "tv" | "both" =
    mt === "movie" || mt === "tv" ? mt : "both";

  const intent: SearchIntent = {
    media_type: wantedMediaType,
    genres: [],
    year_min: null,
    year_max: null,
    query_text: title,
    sort_by: null,
    min_rating: null,
    interpretation: title ? `similar to ${title}` : "",
  };

  if (!title) return { intent, results: [], summary: "(no title provided)" };

  // Find the seed title. Prefer a media-type match if one was specified;
  // otherwise take the most relevant hit.
  const search = await searchMulti(title);
  const candidates = search.results.filter(
    (r): r is TmdbMediaResult => r.media_type === "movie" || r.media_type === "tv",
  );
  const seed =
    wantedMediaType !== "both"
      ? candidates.find((r) => r.media_type === wantedMediaType) ?? candidates[0]
      : candidates[0];

  // No seed found — the named title doesn't exist in TMDB (often because the
  // user described a vibe rather than a real title, e.g. "Brad Pitt secret
  // society"). Fall back to keyword discovery so we ALWAYS return *some*
  // closest titles instead of dead-ending on "no results".
  if (!seed) {
    const fallback = await fallbackKeywordSearch(title, wantedMediaType);
    return {
      intent: { ...intent, interpretation: `closest to "${title}"` },
      results: fallback,
      summary: summarizeResults(fallback),
    };
  }

  const recs = await getRecommendationsFor(seed.media_type, seed.id);
  // Drop the seed itself from the recommendations if TMDB included it.
  let filtered = recs.filter((r) => r.id !== seed.id).slice(0, 16);

  // Even after seeding, TMDB sometimes has zero curated recommendations
  // (obscure or international titles). Fall back to a keyword search rather
  // than giving the user nothing.
  if (filtered.length === 0) {
    filtered = await fallbackKeywordSearch(
      seed.title || seed.name || title,
      wantedMediaType,
    );
  }

  const seedName = seed.title || seed.name || title;
  return {
    intent: { ...intent, interpretation: `similar to ${seedName}` },
    results: filtered,
    summary: summarizeResults(filtered),
  };
}

/**
 * Last-ditch keyword search. Hits TMDB /search/multi with the raw text,
 * dropping trailing words progressively until something comes back. Used
 * whenever the structured search paths return zero results so the chat
 * panel never shows an empty rail.
 *
 * Critically, this also handles the "person + descriptor" case: if the
 * search returns a `person` hit (e.g. "Brad Pitt secret society" surfaces
 * Brad Pitt the person before any matching titles), we pivot to that
 * person's filmography. Without this, the rail dead-ends on documentaries
 * *about* the actor and the model is forced to either hallucinate real
 * titles from training (ungrounded) or recommend the docs (irrelevant).
 */
async function fallbackKeywordSearch(
  text: string,
  wantedMediaType: "movie" | "tv" | "both",
): Promise<TmdbMediaResult[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const filterMedia = (results: { media_type?: string }[]) =>
    (results as TmdbMediaResult[])
      .filter(
        (x) =>
          x.media_type === "movie" ||
          x.media_type === "tv",
      )
      .filter(
        (x) =>
          wantedMediaType === "both" ||
          x.media_type === wantedMediaType,
      );

  // Try the full phrase first, then drop trailing words. On every iteration
  // also peek at person hits via the shared helper so an actor/director
  // query returns their filmography rather than partial-title matches.
  const words = trimmed.split(/\s+/);
  for (let drop = 0; drop <= 2 && words.length - drop >= 1; drop++) {
    const q = words.slice(0, words.length - drop).join(" ");
    if (!q) break;
    const r = await searchMulti(q);

    const filmography = await tryPersonFilmography(r.results, wantedMediaType);
    if (filmography && filmography.length > 0) return filmography;

    const mediaHits = filterMedia(r.results).slice(0, 16);
    if (mediaHits.length > 0) return mediaHits;
  }
  return [];
}

function summarizeResults(results: TmdbMediaResult[]): string {
  if (results.length === 0) return "(no results found)";
  return results
    .map((r) => {
      const name = r.title || r.name || "Untitled";
      const date = r.release_date || r.first_air_date || "";
      const year = date ? date.slice(0, 4) : "";
      return year ? `${name} (${year})` : name;
    })
    .join(", ");
}

async function executeSearchTitles(
  rawIntent: Record<string, unknown>,
): Promise<ToolResult> {
  const intent = normalizeIntent(rawIntent);
  let results = await runDiscoverForIntent(intent);

  // Progressive relaxation: if the strict filters returned nothing, drop
  // them step-by-step until something comes back. Users get *closer*
  // matches instead of an empty rail. The model is told (via the system
  // prompt) to frame loosely-matching results honestly.
  if (results.length === 0 && (intent.year_min || intent.year_max)) {
    const relaxed = { ...intent, year_min: null, year_max: null };
    results = await runDiscoverForIntent(relaxed);
  }
  if (results.length === 0 && intent.genres.length > 0) {
    const relaxed = {
      ...intent,
      genres: [],
      year_min: null,
      year_max: null,
    };
    results = await runDiscoverForIntent(relaxed);
  }
  // Nothing matched any structured discover filter — fall back to raw
  // keyword search so the user always sees something.
  if (results.length === 0 && intent.query_text) {
    results = await fallbackKeywordSearch(intent.query_text, intent.media_type);
  }

  results = results.slice(0, 16);
  return { intent, results, summary: summarizeResults(results) };
}

/**
 * Run the appropriate TMDB endpoint for the intent — keyword search if a
 * `query_text` is present, otherwise /discover with the genre/year/sort
 * filters applied. Split out so the relaxation fallbacks above can call
 * it repeatedly with different intent variants.
 *
 * For keyword paths: if the top TMDB hit is a person (popular actor or
 * director — e.g. "Tom Cruise"), pivot to that person's filmography. This
 * is the difference between the rail showing 16 documentaries *about* the
 * actor and showing the actor's actual movies.
 */
export async function runDiscoverForIntent(
  intent: SearchIntent,
): Promise<TmdbMediaResult[]> {
  const wantMovie = intent.media_type !== "tv";
  const wantTv = intent.media_type !== "movie";

  if (intent.query_text && intent.query_text.length >= 2) {
    const search = await searchMulti(intent.query_text);

    // Person detection: TMDB's /search/multi returns persons, movies, and
    // tv interleaved by relevance. For an actor query the person hit is
    // typically rank-1 with high popularity; we pivot to their filmography
    // BEFORE returning any media hits because docs about an actor would
    // otherwise outrank their actual films.
    const filmography = await tryPersonFilmography(
      search.results,
      intent.media_type,
    );
    if (filmography && filmography.length > 0) {
      return filmography;
    }

    return search.results.filter(
      (r): r is TmdbMediaResult =>
        (r.media_type === "movie" && wantMovie) ||
        (r.media_type === "tv" && wantTv),
    );
  }

  const [movieHits, tvHits] = await Promise.all([
    wantMovie ? discover("movie", intentToDiscoverParams(intent, "movie")) : Promise.resolve([]),
    wantTv ? discover("tv", intentToDiscoverParams(intent, "tv")) : Promise.resolve([]),
  ]);
  if (intent.media_type === "movie") return movieHits;
  if (intent.media_type === "tv") return tvHits;
  // Interleave so both media types are visible.
  const interleaved: TmdbMediaResult[] = [];
  const max = Math.max(movieHits.length, tvHits.length);
  for (let i = 0; i < max; i++) {
    if (movieHits[i]) interleaved.push(movieHits[i]);
    if (tvHits[i]) interleaved.push(tvHits[i]);
  }
  return interleaved;
}

/**
 * Helper: given a TMDB /search/multi result list, if the top-popularity
 * person hit is meaningfully popular (we use 5 as a threshold — TMDB
 * popularity >5 is broadly recognised), fetch their credits and convert
 * them into the rail's media shape. Returns null if no usable person.
 *
 * Used by both `runDiscoverForIntent` (keyword path) and
 * `fallbackKeywordSearch` (zero-results fallback) so the behaviour is
 * identical regardless of which path got us here.
 */
async function tryPersonFilmography(
  searchResults: { id: number; popularity?: number; media_type?: string }[],
  wantedMediaType: "movie" | "tv" | "both",
): Promise<TmdbMediaResult[] | null> {
  const personHits = searchResults
    .filter(
      (x): x is { id: number; popularity?: number; media_type: "person" } =>
        x.media_type === "person",
    )
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

  // Popularity floor: low-popularity persons are usually false positives —
  // someone listed as a writer/producer but who shares the query string
  // accidentally. Tom Cruise's TMDB popularity sits in the dozens; bit
  // players sit below 1. The threshold filters out the noise.
  if (personHits.length === 0 || (personHits[0].popularity ?? 0) < 5) {
    return null;
  }

  try {
    const credits = await getPersonCredits(personHits[0].id);
    return credits
      .filter(
        (c) =>
          wantedMediaType === "both" || c.media_type === wantedMediaType,
      )
      .map<TmdbMediaResult>((c) => ({
        id: c.id,
        media_type: c.media_type,
        title: c.title,
        name: c.name,
        poster_path: c.poster_path,
        backdrop_path: c.backdrop_path,
        release_date: c.release_date,
        first_air_date: c.first_air_date,
        vote_average: c.vote_average,
      }))
      .slice(0, 16);
  } catch {
    return null;
  }
}

function normalizeIntent(raw: Record<string, unknown>): SearchIntent {
  const mt = raw.media_type;
  const mediaType: SearchIntent["media_type"] =
    mt === "movie" || mt === "tv" ? mt : "both";
  const genres = Array.isArray(raw.genres)
    ? (raw.genres as unknown[])
        .filter((g): g is string => typeof g === "string")
        .map((g) => g.toLowerCase().trim())
    : [];
  const yearNow = new Date().getFullYear();
  const yearMin =
    typeof raw.year_min === "number" ? Math.max(1900, raw.year_min as number) : null;
  const yearMax =
    typeof raw.year_max === "number"
      ? Math.min(yearNow + 5, raw.year_max as number)
      : null;
  const sb = raw.sort_by;
  const sortBy: SearchIntent["sort_by"] =
    sb === "rating" || sb === "recent" || sb === "popularity" ? sb : null;
  const minRating =
    typeof raw.min_rating === "number" &&
    (raw.min_rating as number) > 0 &&
    (raw.min_rating as number) <= 10
      ? (raw.min_rating as number)
      : null;
  const queryText =
    typeof raw.query_text === "string" && raw.query_text.trim().length > 0
      ? raw.query_text.trim()
      : null;

  return {
    media_type: mediaType,
    genres,
    year_min: yearMin,
    year_max: yearMax,
    query_text: queryText,
    sort_by: sortBy,
    min_rating: minRating,
    interpretation: "",
  };
}

// ─── OpenAI-compat streaming with tool use ──────────────────────────

async function* streamOpenAIChat(
  messages: ChatMessage[],
): AsyncIterableIterator<ChatEvent> {
  type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

  const wireMessages: Msg[] = [
    { role: "system", content: CHAT_SYSTEM },
    ...messages.map((m): Msg => ({ role: m.role, content: m.content })),
  ];

  // Hop limit. The expected shape per user turn is exactly 2 hops:
  //   1. model emits a search_titles call (no prose, finish_reason="tool_calls")
  //   2. model writes its prose response with the tool result in context
  // Anything beyond that is the model second-guessing itself with redundant
  // searches whose results overwrite the previous rail in the UI.
  const MAX_HOPS = 2;

  // Whether we've already retried with tools disabled. The retry is the
  // graceful-degradation path when Groq rejects a tool call: drop the tools
  // parameter and let the model respond conversationally.
  let triedFallback = false;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    // Accumulate tool calls and prose across the stream.
    type PendingCall = { id: string; name: string; args: string };
    const pendingCalls = new Map<number, PendingCall>();
    let proseAcc = "";
    let finishReason: string | null = null;
    let toolFailureSeen = false;

    try {
      const stream = await getOpenAI().chat.completions.create({
        model: OPENAI_MODEL,
        messages: wireMessages,
        // Pin temperature/top_p so identical queries from different devices
        // get the same tool args (and thus the same results). The previous
        // implementation used the provider default (~0.7) which made the
        // same query return wildly different rails on each device. This
        // doesn't make TMDB results deterministic — it just stops Llama
        // from emitting a fresh `query_text` each time.
        temperature: 0,
        top_p: 1,
        // Skip tools on the fallback retry — this is what avoids the
        // `failed_generation` loop when Groq dislikes whatever Llama emits.
        ...(triedFallback
          ? {}
          : {
              tools: [
                {
                  type: "function",
                  function: {
                    name: SEARCH_TOOL_NAME,
                    description: SEARCH_TOOL_DESCRIPTION,
                    parameters: SEARCH_TOOL_PARAMETERS,
                  },
                },
                {
                  type: "function",
                  function: {
                    name: SIMILAR_TOOL_NAME,
                    description: SIMILAR_TOOL_DESCRIPTION,
                    parameters: SIMILAR_TOOL_PARAMETERS,
                  },
                },
                {
                  type: "function",
                  function: {
                    name: LIBRARY_TOOL_NAME,
                    description: LIBRARY_TOOL_DESCRIPTION,
                    parameters: LIBRARY_TOOL_PARAMETERS,
                  },
                },
              ],
              // Force a real tool call on the first hop. Without this, Llama
              // 3.3 sometimes "narrates" tool usage in prose ("I just got
              // some great options with find_similar({title: \"...\"})...")
              // and then hallucinates results from training instead of
              // emitting a structured function call. On hop 1 we omit
              // tool_choice so the model writes prose with the tool result
              // already in context.
              ...(hop === 0 ? { tool_choice: "required" as const } : {}),
            }),
        stream: true,
      });

      // Hop 0 with tool_choice="required" should produce ONLY a tool call,
      // no prose. If the model writes prose anyway it's defying the
      // constraint and the prose is ungrounded — suppress it here so the
      // user never sees hallucinated text on screen.
      const shouldYieldText = hop > 0 || triedFallback;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta?.content) {
          proseAcc += delta.content;
          if (shouldYieldText) {
            yield { type: "text", delta: delta.content };
          }
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            const existing = pendingCalls.get(idx);
            if (!existing) {
              pendingCalls.set(idx, {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                args: tc.function?.arguments ?? "",
              });
            } else {
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.args += tc.function.arguments;
            }
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "chat error";
      const isToolFailure =
        /failed to call a function|tool_use_failed|failed_generation|tool call validation|not in request\.tools|invalid tool/i.test(
          raw,
        );

      // Recovery for a known Groq parser bug: when Llama 3.3 emits a tool
      // call in a non-canonical format, Groq sometimes glues the JSON args
      // into the tool name and rejects it as "not in request.tools". The
      // error message contains the original shape verbatim — we can pluck
      // it out, execute the tool ourselves, and synthesize the assistant
      // turn so the next hop responds with proper grounding.
      const malformed = raw.match(
        /'(search_titles|find_similar|recommend_from_library)\s+(\{[^']*?\})'/,
      );
      if (malformed && hop < MAX_HOPS - 1) {
        try {
          const [, toolName, jsonArgs] = malformed;
          const parsedArgs = JSON.parse(jsonArgs) as Record<string, unknown>;
          yield { type: "search_start" };
          const { intent, results, summary } = await executeTool(
            toolName,
            parsedArgs,
          );
          yield { type: "search_result", intent, results };
          // Synthesize the missing assistant turn + tool result so the loop
          // can continue with the model writing prose grounded in real data.
          const fakeId = `recovered_${hop}_${Date.now()}`;
          wireMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: fakeId,
                type: "function" as const,
                function: { name: toolName, arguments: jsonArgs },
              },
            ],
          });
          wireMessages.push({
            role: "tool",
            tool_call_id: fakeId,
            content: summary || "(no results found)",
          });
          continue; // next hop: model writes prose with the synthesized result in context
        } catch {
          // Recovery itself failed (probably JSON.parse) — fall through
          // to the existing fallback path below.
        }
      }

      if (isToolFailure && !triedFallback) {
        // One-shot retry without tools so the user gets *some* response. The
        // model can't ground its answer in the catalogue this turn but at
        // least the conversation doesn't dead-end.
        triedFallback = true;
        toolFailureSeen = true;
      } else {
        const friendly = isToolFailure
          ? "Couldn't run the search for that — try rephrasing?"
          : raw;
        yield { type: "error", message: friendly };
        return;
      }
    }

    if (toolFailureSeen) {
      // Restart this hop without tools. The continue jumps to the loop
      // condition, which is fine — `triedFallback` is now true so the next
      // create() call omits the tools array.
      continue;
    }

    // Defiance check: hop 0 was supposed to emit a tool call (we set
    // tool_choice="required"). If it didn't, Llama ignored the constraint
    // and any prose it produced is ungrounded — we already suppressed the
    // text deltas above, so just trigger the fallback retry.
    if (
      hop === 0 &&
      !triedFallback &&
      (finishReason !== "tool_calls" || pendingCalls.size === 0)
    ) {
      triedFallback = true;
      proseAcc = "";
      continue;
    }

    // No tool call → model's final answer. Done.
    if (finishReason !== "tool_calls" || pendingCalls.size === 0) {
      return;
    }

    // Append the assistant turn (with tool_calls) to the running history.
    const calls = Array.from(pendingCalls.values());
    wireMessages.push({
      role: "assistant",
      content: proseAcc || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: c.args },
      })),
    });

    // Execute each tool call and append its result.
    for (const call of calls) {
      if (
        call.name !== SEARCH_TOOL_NAME &&
        call.name !== SIMILAR_TOOL_NAME &&
        call.name !== LIBRARY_TOOL_NAME
      ) {
        wireMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: `unknown tool: ${call.name}`,
        });
        continue;
      }
      yield { type: "search_start" };
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(call.args || "{}");
      } catch {
        // Malformed JSON from the model — feed back an empty intent.
      }
      const { intent, results, summary } = await executeTool(call.name, parsed);
      yield { type: "search_result", intent, results };
      wireMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: summary || "(no results found)",
      });
    }

    // Loop: re-invoke the model with the tool results in context.
  }
}

// ─── Anthropic streaming with tool use ──────────────────────────────

async function* streamAnthropicChat(
  messages: ChatMessage[],
): AsyncIterableIterator<ChatEvent> {
  type AMsg = Anthropic.MessageParam;
  const wireMessages: AMsg[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Same shape as the OpenAI side: one tool call, one prose response.
  const MAX_HOPS = 2;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const stream = getAnthropic().messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      // Pin temperature so identical queries from different devices land on
      // the same tool args. See OpenAI side above for full rationale.
      temperature: 0,
      system: CHAT_SYSTEM,
      tools: [
        {
          name: SEARCH_TOOL_NAME,
          description: SEARCH_TOOL_DESCRIPTION,
          input_schema: SEARCH_TOOL_PARAMETERS,
        },
        {
          name: SIMILAR_TOOL_NAME,
          description: SIMILAR_TOOL_DESCRIPTION,
          input_schema: SIMILAR_TOOL_PARAMETERS,
        },
        {
          name: LIBRARY_TOOL_NAME,
          description: LIBRARY_TOOL_DESCRIPTION,
          input_schema: LIBRARY_TOOL_PARAMETERS,
        },
      ],
      messages: wireMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text", delta: event.delta.text };
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason !== "tool_use") {
      // Plain end_turn / max_tokens / refusal — nothing more to do.
      return;
    }

    const toolUses = final.content.filter((b) => b.type === "tool_use");
    wireMessages.push({ role: "assistant", content: final.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu.type !== "tool_use") continue;
      if (
        tu.name !== SEARCH_TOOL_NAME &&
        tu.name !== SIMILAR_TOOL_NAME &&
        tu.name !== LIBRARY_TOOL_NAME
      ) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `unknown tool: ${tu.name}`,
          is_error: true,
        });
        continue;
      }
      yield { type: "search_start" };
      const { intent, results, summary } = await executeTool(
        tu.name,
        tu.input as Record<string, unknown>,
      );
      yield { type: "search_result", intent, results };
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: summary || "(no results found)",
      });
    }

    wireMessages.push({ role: "user", content: toolResults });
  }
}
