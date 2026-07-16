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
 * Targets whatever the deployment uses: DATABASE_URL (Neon/Postgres, direct
 * pg) or SUPABASE_URL + service-role key. Reads .env.local / .env on its own
 * (next.js loaders don't run for plain tsx scripts). See scripts/lib/backfill-db.ts.
 *
 * Throttled to ~5 calls/sec to stay polite on the TMDB free tier.
 */

import { loadEnv, openBackend, type Backend } from "./lib/backfill-db";

loadEnv();

const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error("Missing TMDB_API_KEY in env.");
  process.exit(1);
}

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

type Seasons = { n: number; c: number }[];

// TV rows whose `seasons` column hasn't been populated yet.
async function readCandidates(backend: Backend): Promise<Row[]> {
  if (backend.kind === "neon") {
    const rows = await backend.query(
      `SELECT id, tmdb_id, title FROM titles WHERE media_type = $1 AND seasons IS NULL`,
      ["tv"]
    );
    return rows as unknown as Row[];
  }
  const { data, error } = await backend.client
    .from("titles")
    .select("id, tmdb_id, title")
    .eq("media_type", "tv")
    .is("seasons", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

async function updateSeasons(backend: Backend, id: string, seasons: Seasons): Promise<void> {
  if (backend.kind === "neon") {
    // seasons is a jsonb column — stringify + cast, or the driver would send a
    // Postgres array literal (see scripts/migrate-to-neon.mjs).
    await backend.query(`UPDATE titles SET seasons = $1::jsonb WHERE id = $2`, [
      JSON.stringify(seasons),
      id,
    ]);
    return;
  }
  const { error } = await backend.client.from("titles").update({ seasons }).eq("id", id);
  if (error) throw new Error(error.message);
}

async function main() {
  const backend = await openBackend().catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });

  const rows = await readCandidates(backend);
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

    try {
      await updateSeasons(backend, row.id, seasons);
    } catch (e) {
      console.error(`  Update failed for ${row.title}:`, (e as Error).message);
      continue;
    }
    filled += 1;
    const total = seasons.reduce((a, s) => a + s.c, 0);
    console.log(
      `  ✓ ${row.title} — ${seasons.length} season${seasons.length === 1 ? "" : "s"}, ${total} episodes`,
    );
  }

  console.log(`\nDone. Filled ${filled} rows, ${empty} had no usable season data.`);
  await backend.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
