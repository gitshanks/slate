/**
 * One-shot backfill: fills `imdb_id` / `imdb_rating` / `imdb_votes` /
 * `rt_score` / `ratings_fetched_at` for every existing `titles` row.
 *
 * Run once:
 *   npx tsx scripts/backfill-ratings.ts
 *
 * Re-runnable — only touches rows where the data is still missing.
 *
 * Reads .env / .env.local on its own (next.js loaders don't run for plain
 * tsx scripts).
 *
 * Throttled to ~3 calls/second to stay well under OMDB's 1k/day free tier.
 */

import { readFileSync } from "node:fs";

// Tiny .env loader — no dotenv dependency.
function loadEnvFile(path: string) {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
if (!TMDB_API_KEY) {
  console.error("Missing TMDB_API_KEY in env.");
  process.exit(1);
}
if (!OMDB_API_KEY) {
  console.error("Missing OMDB_API_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Row {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  imdb_id: string | null;
  imdb_rating: number | null;
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
}

async function fetchOmdb(imdbId: string): Promise<OmdbRatings> {
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", OMDB_API_KEY!);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("tomatoes", "true");
  const res = await fetch(url);
  if (!res.ok) return { imdb_rating: null, imdb_votes: null, rt_score: null };
  const json = (await res.json()) as {
    Response?: string;
    imdbRating?: string;
    imdbVotes?: string;
    Ratings?: { Source: string; Value: string }[];
  };
  if (json.Response === "False") {
    return { imdb_rating: null, imdb_votes: null, rt_score: null };
  }
  const imdb_rating =
    json.imdbRating && json.imdbRating !== "N/A" ? Number(json.imdbRating) : NaN;
  const imdb_votes =
    json.imdbVotes && json.imdbVotes !== "N/A"
      ? Number(String(json.imdbVotes).replace(/,/g, ""))
      : NaN;
  const rt = json.Ratings?.find((r) => r.Source === "Rotten Tomatoes");
  const rt_score = rt?.Value ? Number(String(rt.Value).replace("%", "")) : NaN;
  return {
    imdb_rating: Number.isFinite(imdb_rating) ? imdb_rating : null,
    imdb_votes: Number.isFinite(imdb_votes) ? imdb_votes : null,
    rt_score: Number.isFinite(rt_score) ? rt_score : null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data, error } = await supabase
    .from("titles")
    .select("id, tmdb_id, media_type, title, imdb_id, imdb_rating")
    .or("imdb_rating.is.null,imdb_id.is.null");
  if (error) {
    console.error("Failed to read titles:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as Row[];
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

    let ratings: OmdbRatings = { imdb_rating: null, imdb_votes: null, rt_score: null };
    if (imdbId) {
      try {
        ratings = await fetchOmdb(imdbId);
      } catch (e) {
        console.warn(`  OMDB lookup failed for ${row.title}:`, e);
      }
      await sleep(350);
    }

    const patch = {
      imdb_id: imdbId ?? null,
      imdb_rating: ratings.imdb_rating,
      imdb_votes: ratings.imdb_votes,
      rt_score: ratings.rt_score,
      ratings_fetched_at:
        ratings.imdb_rating != null || ratings.rt_score != null
          ? new Date().toISOString()
          : null,
    };

    const { error: updErr } = await supabase
      .from("titles")
      .update(patch)
      .eq("id", row.id);

    if (updErr) {
      console.error(`  Update failed for ${row.title}:`, updErr.message);
      continue;
    }
    touched += 1;
    if (ratings.imdb_rating != null || ratings.rt_score != null) {
      rated += 1;
      console.log(
        `  ✓ ${row.title} — IMDB ${ratings.imdb_rating ?? "—"}, RT ${ratings.rt_score ?? "—"}`
      );
    } else {
      missing += 1;
      console.log(`  · ${row.title} — no ratings found`);
    }
  }

  console.log(`\nDone. Touched ${touched} rows. ${rated} got ratings, ${missing} had none.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
