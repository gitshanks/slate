/**
 * One-shot backfill: fills `seasons` (jsonb [{n, c}]) for every TV row that
 * was added before episode tracking shipped. The +1 chip and the
 * season/episode picker on the title page only render when this column is
 * populated, so existing libraries need a single sweep.
 *
 * Run once after applying the SQL migration:
 *   npx tsx scripts/backfill-seasons.ts
 *
 * Re-runnable — only touches rows where `seasons` is still null.
 *
 * Reads .env / .env.local on its own (next.js loaders don't run for plain
 * tsx scripts).
 *
 * Throttled to ~5 calls/sec to stay polite on the TMDB free tier.
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
if (!TMDB_API_KEY) {
  console.error("Missing TMDB_API_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Row {
  id: string;
  tmdb_id: number;
  title: string;
}

interface TmdbSeason {
  season_number: number;
  episode_count: number;
}

async function fetchSeasons(tmdbId: number): Promise<{ n: number; c: number }[] | null> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY!);
  url.searchParams.set("language", "en-US");
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { seasons?: TmdbSeason[] };
  const seasons = (json.seasons ?? [])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .map((s) => ({ n: s.season_number, c: s.episode_count }))
    .sort((a, b) => a.n - b.n);
  return seasons.length > 0 ? seasons : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data, error } = await supabase
    .from("titles")
    .select("id, tmdb_id, title")
    .eq("media_type", "tv")
    .is("seasons", null);
  if (error) {
    console.error("Failed to read titles:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as Row[];
  console.log(`Found ${rows.length} TV titles needing seasons backfill.`);

  let filled = 0;
  let empty = 0;

  for (const row of rows) {
    let seasons: { n: number; c: number }[] | null = null;
    try {
      seasons = await fetchSeasons(row.tmdb_id);
    } catch (e) {
      console.warn(`  TMDB lookup failed for ${row.title}:`, e);
    }
    await sleep(200);

    if (!seasons) {
      empty += 1;
      console.log(`  · ${row.title} — no seasons returned`);
      continue;
    }

    const { error: updErr } = await supabase
      .from("titles")
      .update({ seasons })
      .eq("id", row.id);

    if (updErr) {
      console.error(`  Update failed for ${row.title}:`, updErr.message);
      continue;
    }
    filled += 1;
    const total = seasons.reduce((a, s) => a + s.c, 0);
    console.log(
      `  ✓ ${row.title} — ${seasons.length} season${seasons.length === 1 ? "" : "s"}, ${total} episodes`,
    );
  }

  console.log(`\nDone. Filled ${filled} rows, ${empty} had no usable season data.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
