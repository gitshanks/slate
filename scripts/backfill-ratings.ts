/**
 * One-shot backfill: fills `imdb_id` / `imdb_rating` / `imdb_votes` /
 * `rt_score` / `ratings_fetched_at` for every existing `titles` row.
 *
 * Run once:
 *   npx tsx scripts/backfill-ratings.ts
 *
 * Re-runnable — only touches rows where the data is still missing.
 *
 * Targets whatever the deployment uses: DATABASE_URL (Neon/Postgres, direct
 * pg) or SUPABASE_URL + service-role key. Reads .env.local / .env on its own
 * (next.js loaders don't run for plain tsx scripts). See scripts/lib/backfill-db.ts.
 *
 * Throttled to ~3 calls/second to stay well under OMDB's 1k/day free tier.
 */

import { loadEnv, openBackend, type Backend } from "./lib/backfill-db";

loadEnv();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error("Missing TMDB_API_KEY in env.");
  process.exit(1);
}
if (!OMDB_API_KEY) {
  console.error("Missing OMDB_API_KEY in env.");
  process.exit(1);
}

interface Row {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  imdb_id: string | null;
  imdb_rating: number | null;
  rt_score: number | null;
  metacritic_score: number | null;
}

async function fetchTmdbImdbId(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<string | null> {
  const path =
    mediaType === "movie"
      ? `/movie/${tmdbId}`
      : `/tv/${tmdbId}?append_to_response=external_ids`;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY!);
  if (mediaType === "tv") url.searchParams.set("append_to_response", "external_ids");
  url.searchParams.set("language", "en-US");
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    imdb_id?: string | null;
    external_ids?: { imdb_id?: string | null };
  };
  return json.imdb_id ?? json.external_ids?.imdb_id ?? null;
}

interface OmdbRatings {
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
  metacritic_score: number | null;
}

const EMPTY_RATINGS: OmdbRatings = {
  imdb_rating: null,
  imdb_votes: null,
  rt_score: null,
  metacritic_score: null,
};

function toNum(v: string | undefined): number {
  if (!v || v === "N/A") return NaN;
  return Number(String(v).replace(/[%,/].*$/, "").replace(/,/g, ""));
}

async function fetchOmdb(imdbId: string): Promise<OmdbRatings> {
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", OMDB_API_KEY!);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("tomatoes", "true");
  const res = await fetch(url);
  if (!res.ok) return EMPTY_RATINGS;
  const json = (await res.json()) as {
    Response?: string;
    imdbRating?: string;
    imdbVotes?: string;
    Metascore?: string;
    Ratings?: { Source: string; Value: string }[];
  };
  if (json.Response === "False") return EMPTY_RATINGS;

  const imdb_rating = toNum(json.imdbRating);
  const imdb_votes = toNum(json.imdbVotes);
  const rtEntry = json.Ratings?.find((r) => r.Source === "Rotten Tomatoes");
  const rt_score = toNum(rtEntry?.Value);
  let mc = toNum(json.Metascore);
  if (!Number.isFinite(mc)) {
    const mcEntry = json.Ratings?.find((r) => r.Source === "Metacritic");
    mc = toNum(mcEntry?.Value);
  }

  return {
    imdb_rating: Number.isFinite(imdb_rating) && imdb_rating > 0 ? imdb_rating : null,
    imdb_votes: Number.isFinite(imdb_votes) && imdb_votes > 0 ? imdb_votes : null,
    rt_score: Number.isFinite(rt_score) && rt_score >= 0 ? rt_score : null,
    metacritic_score: Number.isFinite(mc) && mc >= 0 ? mc : null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RatingsPatch {
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
  metacritic_score: number | null;
  ratings_fetched_at: string | null;
}

// Rows still missing any of imdb_id / the three scores.
async function readCandidates(backend: Backend): Promise<Row[]> {
  if (backend.kind === "neon") {
    const rows = await backend.query(
      `SELECT id, tmdb_id, media_type, title, imdb_id, imdb_rating, rt_score, metacritic_score
         FROM titles
        WHERE imdb_rating IS NULL OR imdb_id IS NULL
           OR rt_score IS NULL OR metacritic_score IS NULL`
    );
    return rows as unknown as Row[];
  }
  const { data, error } = await backend.client
    .from("titles")
    .select("id, tmdb_id, media_type, title, imdb_id, imdb_rating, rt_score, metacritic_score")
    .or("imdb_rating.is.null,imdb_id.is.null,rt_score.is.null,metacritic_score.is.null");
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

async function updateRow(backend: Backend, id: string, patch: RatingsPatch): Promise<void> {
  if (backend.kind === "neon") {
    await backend.query(
      `UPDATE titles
          SET imdb_id = $1, imdb_rating = $2, imdb_votes = $3,
              rt_score = $4, metacritic_score = $5, ratings_fetched_at = $6
        WHERE id = $7`,
      [
        patch.imdb_id,
        patch.imdb_rating,
        patch.imdb_votes,
        patch.rt_score,
        patch.metacritic_score,
        patch.ratings_fetched_at,
        id,
      ]
    );
    return;
  }
  const { error } = await backend.client.from("titles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

async function main() {
  const backend = await openBackend().catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });

  const rows = await readCandidates(backend);
  console.log(`Found ${rows.length} titles needing a rating refresh.`);

  let touched = 0;
  let rated = 0;
  let missing = 0;

  for (const row of rows) {
    let imdbId = row.imdb_id;
    if (!imdbId) {
      try {
        imdbId = await fetchTmdbImdbId(row.tmdb_id, row.media_type);
      } catch (e) {
        console.warn(`  TMDB lookup failed for ${row.title}:`, e);
      }
      await sleep(150);
    }

    let ratings: OmdbRatings = EMPTY_RATINGS;
    if (imdbId) {
      try {
        ratings = await fetchOmdb(imdbId);
      } catch (e) {
        console.warn(`  OMDB lookup failed for ${row.title}:`, e);
      }
      await sleep(350);
    }

    const gotAny =
      ratings.imdb_rating != null ||
      ratings.rt_score != null ||
      ratings.metacritic_score != null;

    const patch: RatingsPatch = {
      imdb_id: imdbId ?? null,
      imdb_rating: ratings.imdb_rating,
      imdb_votes: ratings.imdb_votes,
      rt_score: ratings.rt_score,
      metacritic_score: ratings.metacritic_score,
      ratings_fetched_at: gotAny ? new Date().toISOString() : null,
    };

    try {
      await updateRow(backend, row.id, patch);
    } catch (e) {
      console.error(`  Update failed for ${row.title}:`, (e as Error).message);
      continue;
    }
    touched += 1;
    if (gotAny) {
      rated += 1;
      console.log(
        `  ✓ ${row.title} — IMDB ${ratings.imdb_rating ?? "—"}, RT ${ratings.rt_score ?? "—"}, MC ${ratings.metacritic_score ?? "—"}`
      );
    } else {
      missing += 1;
      console.log(`  · ${row.title} — no ratings found`);
    }
  }

  console.log(`\nDone. Touched ${touched} rows. ${rated} got ratings, ${missing} had none.`);
  await backend.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
