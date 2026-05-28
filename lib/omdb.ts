import "server-only";

const OMDB_BASE = "https://www.omdbapi.com/";
const KEY = process.env.OMDB_API_KEY;

export interface OmdbRatings {
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
  metacritic_score: number | null;
}

const EMPTY: OmdbRatings = {
  imdb_rating: null,
  imdb_votes: null,
  rt_score: null,
  metacritic_score: null,
};

interface OmdbResponse {
  Response?: "True" | "False";
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: { Source: string; Value: string }[];
}

function parseNumber(value: string | undefined): number {
  if (!value || value === "N/A") return NaN;
  return Number(String(value).replace(/[%,/].*$/, "").replace(/,/g, ""));
}

/**
 * Fetch IMDB rating + Rotten Tomatoes Tomatometer + Metacritic by IMDB ID.
 * Returns nulls (never throws) so callers can store partial data.
 *
 * Cached for 24h — these scores barely move and OMDB's free tier is 1k/day.
 *
 * Failure modes are logged (server-side only) so it's possible to tell why
 * a title has no ratings: missing key, rate-limit, OMDB doesn't know the
 * IMDB id, network blip, etc. The function still resolves to nulls so the
 * write path keeps working — addTitle never throws over a missing rating.
 */
export async function getOmdbRatings(imdbId: string): Promise<OmdbRatings> {
  if (!KEY) {
    console.warn("[omdb] OMDB_API_KEY not set — skipping ratings fetch");
    return EMPTY;
  }
  if (!imdbId) return EMPTY;

  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("tomatoes", "true");

  let json: OmdbResponse & { Error?: string };
  try {
    const res = await fetch(url, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) {
      const hint =
        res.status === 401
          ? "invalid or unverified key (OMDB emails an activation link on signup — until that link is clicked, the key returns 401 on every call)"
          : res.status === 402
            ? "daily 1000-call free-tier limit exhausted; resets at midnight UTC"
            : res.status === 429
              ? "rate-limited (sustained calls/sec too high)"
              : `unexpected status — check OMDB_API_KEY value`;
      console.warn(`[omdb] HTTP ${res.status} for ${imdbId} — ${hint}`);
      return EMPTY;
    }
    json = (await res.json()) as OmdbResponse & { Error?: string };
  } catch (err) {
    console.warn(`[omdb] fetch failed for ${imdbId}:`, err);
    return EMPTY;
  }
  if (json.Response === "False") {
    console.warn(
      `[omdb] no record for ${imdbId}: ${json.Error ?? "(unknown reason)"}`,
    );
    return EMPTY;
  }

  const imdb_rating = parseNumber(json.imdbRating);
  const imdb_votes = parseNumber(json.imdbVotes);

  // RT entry from Ratings array; falls back to null if RT didn't score it.
  const rtEntry = Array.isArray(json.Ratings)
    ? json.Ratings.find((r) => r.Source === "Rotten Tomatoes")
    : null;
  const rt_score = parseNumber(rtEntry?.Value);

  // Metacritic — prefer the top-level Metascore field, then fall back to the
  // Ratings array entry. OMDB returns Metascore for many titles RT doesn't
  // cover, so this is what fills the gap on TV / older / foreign rows.
  let metacritic = parseNumber(json.Metascore);
  if (!Number.isFinite(metacritic)) {
    const mcEntry = Array.isArray(json.Ratings)
      ? json.Ratings.find((r) => r.Source === "Metacritic")
      : null;
    metacritic = parseNumber(mcEntry?.Value);
  }

  return {
    imdb_rating: Number.isFinite(imdb_rating) && imdb_rating > 0 ? imdb_rating : null,
    imdb_votes: Number.isFinite(imdb_votes) && imdb_votes > 0 ? imdb_votes : null,
    rt_score: Number.isFinite(rt_score) && rt_score >= 0 ? rt_score : null,
    metacritic_score:
      Number.isFinite(metacritic) && metacritic >= 0 ? metacritic : null,
  };
}
