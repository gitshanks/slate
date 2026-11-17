// Publish or update a list made by Slate. The list is owned by the house
// account (@slate) and is public at /l/<slug>.
//
//   node scripts/publish-slate-list.mjs content/slate-lists/7-for-007.json [--dry-run]
//
// Safe to run again: titles are matched by TMDB id, the list by its slug, and
// the list's order is replaced with the order in the file.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOUSE = { id: "slate", username: "slate", displayName: "Slate" };

function loadLocalEnv() {
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Production jobs inject the variables directly.
  }
}

async function tmdb(path) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/${path}?api_key=${process.env.TMDB_API_KEY}`,
      );
      if (response.ok) return await response.json();
      lastError = new Error(`TMDB ${response.status} for ${path}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((done) => setTimeout(done, 1500));
  }
  throw lastError;
}

// Mirrors normalizeForStorage in lib/tmdb.ts.
function normalize(type, d) {
  if (type === "movie") {
    return {
      tmdb_id: d.id, media_type: "movie", title: d.title, original_title: d.original_title,
      overview: d.overview, poster_path: d.poster_path, backdrop_path: d.backdrop_path,
      release_date: d.release_date || null, runtime: d.runtime ?? null,
      genres: JSON.stringify(d.genres ?? []), tmdb_rating: d.vote_average ?? null,
      tmdb_vote_count: d.vote_count ?? null, imdb_id: d.imdb_id ?? null,
    };
  }
  return {
    tmdb_id: d.id, media_type: "tv", title: d.name, original_title: d.original_name,
    overview: d.overview, poster_path: d.poster_path, backdrop_path: d.backdrop_path,
    release_date: d.first_air_date || null, runtime: d.episode_run_time?.[0] ?? null,
    genres: JSON.stringify(d.genres ?? []), tmdb_rating: d.vote_average ?? null,
    tmdb_vote_count: d.vote_count ?? null, imdb_id: null,
  };
}

loadLocalEnv();
const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
if (!file) {
  console.error("Usage: node scripts/publish-slate-list.mjs <list.json> [--dry-run]");
  process.exit(1);
}
for (const key of ["DATABASE_URL", "TMDB_API_KEY"]) {
  if (!process.env[key]) {
    console.error(`${key} is not set.`);
    process.exit(1);
  }
}

const spec = JSON.parse(readFileSync(resolve(file), "utf8"));
if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(spec.slug ?? "") || !spec.name || !spec.titles?.length) {
  console.error("The list needs a slug (lowercase, digits, hyphens), a name and at least one title.");
  process.exit(1);
}

const details = [];
for (const entry of spec.titles) {
  const type = entry.mediaType === "tv" ? "tv" : "movie";
  details.push(normalize(type, await tmdb(`${type}/${entry.tmdbId}`)));
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");

  const taken = await client.query(
    "select id from profiles where username = $1 and id <> $2",
    [HOUSE.username, HOUSE.id],
  );
  if (taken.rowCount) throw new Error(`@${HOUSE.username} already belongs to another account.`);
  await client.query(
    `insert into profiles (id, username, display_name, identity_customized, is_public)
     values ($1, $2, $3, true, true)
     on conflict (id) do update set is_public = true, updated_at = now()`,
    [HOUSE.id, HOUSE.username, HOUSE.displayName],
  );

  const titleIds = [];
  for (const [index, t] of details.entries()) {
    const existing = await client.query(
      "select id from titles where owner_id = $1 and tmdb_id = $2 and media_type = $3 limit 1",
      [HOUSE.id, t.tmdb_id, t.media_type],
    );
    if (existing.rowCount) {
      titleIds.push(existing.rows[0].id);
      continue;
    }
    const columns = Object.keys(t);
    const inserted = await client.query(
      `insert into titles (owner_id, status, position, ${columns.join(", ")})
       values ($1, 'want', $2, ${columns.map((_, i) => `$${i + 3}`).join(", ")})
       returning id`,
      [HOUSE.id, index, ...columns.map((column) => t[column])],
    );
    titleIds.push(inserted.rows[0].id);
  }

  const list = await client.query(
    `insert into lists (owner_id, slug, name, description)
     values ($1, $2, $3, $4)
     on conflict (owner_id, slug) do update set name = excluded.name, description = excluded.description
     returning id`,
    [HOUSE.id, spec.slug, spec.name, spec.description ?? null],
  );
  const listId = list.rows[0].id;
  await client.query("delete from list_titles where owner_id = $1 and list_id = $2", [HOUSE.id, listId]);
  for (const [position, titleId] of titleIds.entries()) {
    await client.query(
      "insert into list_titles (owner_id, list_id, title_id, position) values ($1, $2, $3, $4)",
      [HOUSE.id, listId, titleId, position],
    );
  }

  await client.query(dryRun ? "rollback" : "commit");
  console.log(`${dryRun ? "Dry run, nothing saved" : "Published"}: /l/${spec.slug}`);
  details.forEach((t, i) => console.log(`  ${i + 1}. ${t.title} (${(t.release_date ?? "").slice(0, 4)})`));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
