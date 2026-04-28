import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

/**
 * Whether AI search is wired up. The palette uses this to hide the toggle
 * entirely when the key is missing — no broken UX, no client-visible error.
 */
export const aiSearchEnabled = Boolean(ANTHROPIC_KEY);

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!client) client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  return client;
}

// ─── TMDB genre tables ──────────────────────────────────────────────
// Stable IDs from TMDB — hardcoded so we don't pay a request per query.
// https://developer.themoviedb.org/reference/genre-movie-list

export const MOVIE_GENRES: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

export const TV_GENRES: Record<string, number> = {
  "action & adventure": 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  reality: 10764,
  "sci-fi & fantasy": 10765,
  soap: 10766,
  talk: 10767,
  "war & politics": 10768,
  western: 37,
};

// ─── Intent schema ──────────────────────────────────────────────────

export interface SearchIntent {
  /** What flavour of result the user wants. */
  media_type: "movie" | "tv" | "both";
  /** Lowercase genre names — mapped to TMDB IDs server-side. */
  genres: string[];
  /** Optional release year window. */
  year_min: number | null;
  year_max: number | null;
  /** Free-text keyword passed to TMDB /search/multi (null means discover-only). */
  query_text: string | null;
  /** TMDB-flavoured sort. */
  sort_by: "popularity" | "rating" | "recent" | null;
  /** Minimum TMDB user rating (0-10). */
  min_rating: number | null;
  /** One-sentence rephrasing of what the AI thinks the user wants. */
  interpretation: string;
}

const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    media_type: { type: "string", enum: ["movie", "tv", "both"] },
    genres: { type: "array", items: { type: "string" } },
    year_min: { type: ["integer", "null"] },
    year_max: { type: ["integer", "null"] },
    query_text: { type: ["string", "null"] },
    sort_by: {
      type: ["string", "null"],
      enum: ["popularity", "rating", "recent", null],
    },
    min_rating: { type: ["number", "null"] },
    interpretation: { type: "string" },
  },
  required: [
    "media_type",
    "genres",
    "year_min",
    "year_max",
    "query_text",
    "sort_by",
    "min_rating",
    "interpretation",
  ],
} as const;

const INTENT_SYSTEM = `You translate a user's natural-language query about movies and TV shows into a structured search intent for TMDB.

Rules:
- media_type: "movie", "tv", or "both". Default to "both" unless the query implies one.
- genres: zero or more lowercase genre names from this exact set: ${Object.keys(
  MOVIE_GENRES,
).join(", ")}, action & adventure, sci-fi & fantasy, war & politics, kids, reality, soap, talk. Pick at most 3.
- year_min / year_max: integers when the query implies a time period ("90s" → 1990–1999, "recent" → last 5 years, "classic" → before 1980). Null otherwise.
- query_text: the residual free-text keyword to send to TMDB search (a title fragment, person name, franchise, etc.). Null if the query is purely descriptive.
- sort_by: "rating" for "best/top/highly rated", "recent" for "new/latest", "popularity" otherwise.
- min_rating: 7+ when the user asks for "highly rated" / "great" / "best", null otherwise.
- interpretation: one short sentence describing what you understood.

Return JSON only — no preamble.`;

// ─── Suggestion schema ──────────────────────────────────────────────

const SUGGESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
    },
  },
  required: ["suggestions"],
} as const;

const SUGGESTIONS_SYSTEM = `You suggest 4 short, varied search-query completions for a movie/TV watchlist app.

Rules:
- Each suggestion is a complete query a user might type (3-8 words).
- Mix kinds: a specific title, a genre+era combo, a person/director, a mood/theme.
- No duplicates, no quotes, no trailing punctuation.
- If the partial input clearly points at a known title or person, surface that as the first suggestion.

Return JSON only.`;

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Parse a natural-language query into a structured TMDB search intent.
 * Throws if `ANTHROPIC_API_KEY` is unset — callers should check `aiSearchEnabled` first.
 */
export async function parseSearchIntent(query: string): Promise<SearchIntent> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("query is empty");
  }
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: INTENT_SYSTEM,
    output_config: {
      format: {
        type: "json_schema",
        schema: INTENT_SCHEMA,
      },
    },
    messages: [{ role: "user", content: trimmed }],
  });
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("no text content in AI response");
  }
  const parsed = JSON.parse(text.text) as SearchIntent;
  // Normalise: clamp year window, lowercase genres.
  parsed.genres = (parsed.genres ?? []).map((g) => g.toLowerCase().trim());
  if (parsed.year_min && parsed.year_min < 1900) parsed.year_min = 1900;
  if (parsed.year_max && parsed.year_max > new Date().getFullYear() + 5) {
    parsed.year_max = new Date().getFullYear() + 5;
  }
  return parsed;
}

/**
 * Suggest 4 query completions for a partial query. Returns an empty array
 * if the model fails or AI isn't configured — never throws to the caller.
 */
export async function suggestQueries(partial: string): Promise<string[]> {
  if (!aiSearchEnabled) return [];
  const trimmed = partial.trim();
  if (trimmed.length < 2) return [];
  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SUGGESTIONS_SYSTEM,
      output_config: {
        format: {
          type: "json_schema",
          schema: SUGGESTIONS_SCHEMA,
        },
      },
      messages: [
        {
          role: "user",
          content: `Partial query: "${trimmed}"`,
        },
      ],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return [];
    const parsed = JSON.parse(text.text) as { suggestions: string[] };
    return (parsed.suggestions ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

// ─── Intent → TMDB filters ──────────────────────────────────────────

/** Translate a SearchIntent into TMDB /discover query params for the given media type. */
export function intentToDiscoverParams(
  intent: SearchIntent,
  mediaType: "movie" | "tv",
): Record<string, string> {
  const params: Record<string, string> = {};

  // Genres — map names to IDs against the right table.
  const table = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES;
  const ids = intent.genres
    .map((g) => table[g])
    .filter((id): id is number => typeof id === "number");
  if (ids.length > 0) params.with_genres = ids.join(",");

  // Year window — different field names per media type.
  const dateGteKey =
    mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
  const dateLteKey =
    mediaType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
  if (intent.year_min) params[dateGteKey] = `${intent.year_min}-01-01`;
  if (intent.year_max) params[dateLteKey] = `${intent.year_max}-12-31`;

  // Sort.
  if (intent.sort_by === "rating") {
    params.sort_by = "vote_average.desc";
    // A rating sort with no vote-count floor returns obscure 10/10s — guard against it.
    params["vote_count.gte"] = "200";
  } else if (intent.sort_by === "recent") {
    params.sort_by =
      mediaType === "movie"
        ? "primary_release_date.desc"
        : "first_air_date.desc";
  } else {
    params.sort_by = "popularity.desc";
  }

  if (intent.min_rating) params["vote_average.gte"] = String(intent.min_rating);

  return params;
}
