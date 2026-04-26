import "server-only";

const OMDB_BASE = "https://www.omdbapi.com/";
const KEY = process.env.OMDB_API_KEY;

export interface OmdbRatings {
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
}

const EMPTY: OmdbRatings = { imdb_rating: null, imdb_votes: null, rt_score: null };

interface OmdbResponse {
  Response?: "True" | "False";
  imdbRating?: string;
  imdbVotes?: string;
  Ratings?: { Source: string; Value: string }[];
}

/**
 * Fetch IMDB rating + Rotten Tomatoes Tomatometer by IMDB ID.
 * Returns nulls (never throws) so callers can store partial data.
 *
 * Cached for 24h — these scores barely move and OMDB's free tier is 1k/day.
 */
export async function getOmdbRatings(imdbId: string): Promise<OmdbRatings> {
  if (!KEY || !imdbId) return EMPTY;

  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("tomatoes", "true");

  let json: OmdbResponse;
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return EMPTY;
    json = (await res.json()) as OmdbResponse;
  } catch {
    return EMPTY;
  }
  if (json.Response === "False") return EMPTY;

  const imdb_rating =
    json.imdbRating && json.imdbRating !== "N/A" ? Number(json.imdbRating) : NaN;
  const imdb_votes =
    json.imdbVotes && json.imdbVotes !== "N/A"
      ? Number(String(json.imdbVotes).replace(/,/g, ""))
      : NaN;
  const rtEntry = Array.isArray(json.Ratings)
    ? json.Ratings.find((r) => r.Source === "Rotten Tomatoes")
    : null;
  const rt_score = rtEntry?.Value
    ? Number(String(rtEntry.Value).replace("%", ""))
    : NaN;

  return {
    imdb_rating: Number.isFinite(imdb_rating) ? imdb_rating : null,
    imdb_votes: Number.isFinite(imdb_votes) ? imdb_votes : null,
    rt_score: Number.isFinite(rt_score) ? rt_score : null,
  };
}
