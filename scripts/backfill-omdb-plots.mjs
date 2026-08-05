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

    const cached = await pool.query(
      "select id, omdb_plot from titles where nullif(trim(omdb_plot), '') is not null",
    );
    let reformatted = 0;
    await mapPool(cached.rows, 12, async (row) => {
      const formatted = formatPlot(row.omdb_plot);
      if (!formatted || formatted === row.omdb_plot) return;
      await pool.query("update titles set omdb_plot = $1 where id = $2", [
        formatted,
        row.id,
      ]);
      reformatted += 1;
    });
    console.log(`Reformatted ${reformatted} cached OMDb plots.`);

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
  return formatPlot(value);
}

function formatPlot(value) {
  if (typeof value !== "string") return null;
  const text = value
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/([\p{L}])["”](s|t|re|ve|ll|d|m)\b/giu, "$1'$2")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?=(?:["'“‘])?[\p{L}])/gu, "$1 ")
    .replace(/([.!?])(?=(?:["'”’])?[\p{Lu}][\p{Ll}])/gu, "$1 ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/ {2,}/g, " ")
    .trim();
  if (!text) return null;
  if (countWords(text) < 100) return text.slice(0, 8_000);

  const sentences = text.split(
    /(?<=[.!?])\s+(?=(?:["'“‘])?[\p{Lu}\d])/u,
  );
  if (sentences.length < 4) return text.slice(0, 8_000);

  const paragraphs = [];
  let current = [];
  let currentWords = 0;
  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (
      current.length >= 2 &&
      (current.length >= 3 || currentWords + sentenceWords > 95)
    ) {
      paragraphs.push(current.join(" "));
      current = [];
      currentWords = 0;
    }
    current.push(sentence);
    currentWords += sentenceWords;
  }
  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs.join("\n\n").slice(0, 8_000);
}

function countWords(value) {
  return value.split(/\s+/).filter(Boolean).length;
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
