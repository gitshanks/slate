import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
    // Production migration jobs normally inject DATABASE_URL directly.
  }
}

loadLocalEnv();
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (process.argv.includes("--check")) {
    const result = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = current_schema()
        and table_name in ('list_members', 'list_invites')
      order by table_name
    `);
    console.log(JSON.stringify({ sharedListTables: result.rows.map((row) => row.table_name) }));
  } else {
    const sql = readFileSync(
      join(root, "supabase", "migrations", "20260923_shared_lists.sql"),
      "utf8",
    );
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("Shared lists migration applied.");
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
