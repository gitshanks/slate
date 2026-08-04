import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const required = ["DATABASE_URL", "OMDB_API_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  await backfill();
}

async function backfill() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
  });

  try {
    await pool.query(
      "alter table titles add column if not exists omdb_plot text",
    );
    await pool.query(
      "alter table titles add column if not exists omdb_plot_fetched_at timestamptz",
    );

    const result = await pool.query(`
      select distinct lower(imdb_id) as imdb_id
      from titles
      where imdb_id ~* '^tt[0-9]{5,12}$'
        and nullif(trim(omdb_plot), '') is null
      order by lower(imdb_id)
    `);
    const ids = result.rows.map((row) => row.imdb_id);
    if (!ids.length) {
      console.log("Every saved title with an IMDb ID already has an OMDb plot.");
      return;
    }

    console.log(`Fetching full OMDb plots for ${ids.length} unique titles…`);
    let completed = 0;
    let saved = 0;

    await mapPool(ids, 3, async (imdbId) => {
      const plot = await fetchPlot(imdbId);
      await pool.query(
        `update titles
         set omdb_plot = $1,
             omdb_plot_fetched_at = now()
         where lower(imdb_id) = $2`,
        [plot, imdbId],
      );
      completed += 1;
      if (plot) saved += 1;
      if (completed % 25 === 0 || completed === ids.length) {
        console.log(`${completed}/${ids.length} checked, ${saved} plots saved`);
      }
    });

    console.log(
      `OMDb backfill complete: ${saved} plots saved, ${ids.length - saved} titles had no available plot.`,
    );
  } finally {
    await pool.end();
  }
}

async function fetchPlot(imdbId) {
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", process.env.OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "full");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OMDb returned HTTP ${response.status} for ${imdbId}`);
  }
  const payload = await response.json();
  if (payload.Response === "False") {
    const message = String(payload.Error ?? "Unknown OMDb error");
    if (/limit|key|request/i.test(message)) {
      throw new Error(`OMDb stopped the backfill: ${message}`);
    }
    return null;
  }

  const value = payload.Plot;
  if (typeof value !== "string" || value === "N/A") return null;
  const plot = value.replace(/\s+/g, " ").trim();
  return plot ? plot.slice(0, 8_000) : null;
}

async function mapPool(items, concurrency, worker) {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run),
  );
}
