// One-off data migration: copy Slate's tables from Supabase into Neon.
// Pure Node + `pg` — no psql/pg_dump/Docker needed.
//
// The source can be EITHER:
//   • the Supabase REST API — uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
//     which you already have in .env.local (no connection string / DB password
//     to hunt down). This is the easy path.
//   • a direct Postgres URL via SOURCE_DB_URL (Supabase → Connect → Session
//     pooler), if you prefer.
// The target is always Neon via DATABASE_URL.
//
// The script auto-loads .env.local for any vars not already set, so once you've
// added your Neon DATABASE_URL to .env.local you can just run:
//
//     node scripts/migrate-to-neon.mjs --init
//
//   --init   also creates the schema on Neon first (runs supabase/schema.sql).
//
// First un-pause the Supabase project (Free tier caps active projects, so the
// one being migrated is likely paused) — both the API and the DB are offline
// while it's paused. Idempotent: rows use INSERT … ON CONFLICT DO NOTHING, so
// re-running is safe. Read-only on the source. FK-safe order (lists + titles
// before list_titles).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local for any vars not already in the environment, so the script
// "just works" with your existing config (command-line env still wins).
try {
  const envFile = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] != null) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
} catch {
  /* no .env.local — rely on the shell environment */
}

const TARGET = process.env.DATABASE_URL;
const SOURCE_DB_URL = process.env.SOURCE_DB_URL;
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INIT = process.argv.includes("--init");

if (!TARGET) {
  console.error("Set DATABASE_URL to your Neon connection string (the migration target).");
  process.exit(1);
}
const restMode = !SOURCE_DB_URL && SUPA_URL && SUPA_KEY;
if (!SOURCE_DB_URL && !restMode) {
  console.error(
    "No source configured. Provide either:\n" +
      "  • SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (REST API — already in .env.local), or\n" +
      "  • SOURCE_DB_URL=<supabase direct postgres url>  (direct DB)"
  );
  process.exit(1);
}

// FK-safe order: list_titles references both lists and titles.
const TABLES = ["lists", "titles", "list_titles"];
const JSONB = { titles: new Set(["genres", "seasons"]) };
const CHUNK = 500;
const REST_PAGE = 1000;

const src = SOURCE_DB_URL ? new Pool({ connectionString: SOURCE_DB_URL }) : null;
const dst = new Pool({ connectionString: TARGET });
const sourceCounts = {};

async function readSourceRows(table) {
  if (src) {
    const { rows } = await src.query(`SELECT * FROM ${table}`);
    return rows;
  }
  // REST: paginate with Range headers until a short page. service_role bypasses
  // RLS, so every row comes back.
  const base = SUPA_URL.replace(/\/+$/, "");
  const headers = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };
  const all = [];
  for (let from = 0; ; from += REST_PAGE) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*`, {
      headers: { ...headers, "Range-Unit": "items", Range: `${from}-${from + REST_PAGE - 1}` },
    });
    if (!res.ok) throw new Error(`Supabase REST ${res.status} on ${table}: ${await res.text()}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < REST_PAGE) break;
  }
  return all;
}

function encode(table, col, val) {
  // jsonb: a raw driver encodes a JS array as a Postgres array literal, so
  // stringify + cast. Everything else binds directly.
  if (val != null && JSONB[table]?.has(col)) return { text: "::jsonb", val: JSON.stringify(val) };
  return { text: "", val };
}

async function copyTable(table) {
  const rows = await readSourceRows(table);
  sourceCounts[table] = rows.length;
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (nothing to copy)`);
    return;
  }
  const cols = Object.keys(rows[0]);
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const params = [];
    const tuples = batch.map((row) => {
      const cells = cols.map((c) => {
        const { text, val } = encode(table, c, row[c]);
        params.push(val);
        return `$${params.length}${text}`;
      });
      return `(${cells.join(", ")})`;
    });
    const sql =
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${tuples.join(", ")} ` +
      `ON CONFLICT DO NOTHING`;
    const res = await dst.query(sql, params);
    inserted += res.rowCount ?? 0;
  }

  console.log(`  ${table}: ${rows.length} source → ${inserted} inserted (rest already present)`);
}

async function main() {
  console.log(`Source: ${src ? "direct Postgres (SOURCE_DB_URL)" : "Supabase REST API"}`);
  if (INIT) {
    console.log("Applying schema to Neon (supabase/schema.sql)…");
    await dst.query(readFileSync(join(__dirname, "..", "supabase", "schema.sql"), "utf8"));
    console.log("  schema applied.");
  }

  console.log("Copying data → Neon…");
  for (const t of TABLES) await copyTable(t);

  console.log("\nRow-count check:");
  for (const t of TABLES) {
    const { rows: d } = await dst.query(`SELECT count(*)::int AS n FROM ${t}`);
    const s = sourceCounts[t] ?? 0;
    console.log(`  ${s === d[0].n ? "✓" : "✗"} ${t}: source ${s} / target ${d[0].n}`);
  }
  console.log("\nDone. Set DATABASE_URL in Vercel + .env.local to cut over.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (src) await src.end().catch(() => {});
    await dst.end().catch(() => {});
  });
