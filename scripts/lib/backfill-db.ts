// Shared env loading + backend selection for the one-off backfill scripts
// (scripts/backfill-ratings.ts, scripts/backfill-seasons.ts).
//
// These scripts run under plain `tsx`, outside Next, so they deliberately
// bypass the lib/supabase.ts seam: that seam's Neon path goes through
// next/server's connection(), which only works inside a Next request. A direct
// `pg` connection is the right tool for a standalone script.
//
// Backend precedence mirrors lib/supabase.ts, so a backfill targets whatever
// the deployment is configured for:
//
//   DATABASE_URL present            → direct pg (Neon / any Postgres)
//   SUPABASE_URL + service-role key → supabase-js
//   neither                         → throw (caller prints + exits 1)

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

const { Client } = pg;

// Tiny .env loader — no dotenv dependency. First value set wins, so the shell
// environment overrides files and .env.local overrides .env (matches the
// previous per-script loaders and migrate-to-neon.mjs).
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

/** Load .env.local then .env for any vars not already in the environment. */
export function loadEnv() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

export type Backend =
  | {
      kind: "neon";
      /** Run parameterized SQL and return the rows. */
      query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
      close(): Promise<void>;
    }
  | { kind: "supabase"; client: SupabaseClient; close(): Promise<void> };

/**
 * Open a backend using the same precedence as lib/supabase.ts. Throws if
 * neither is configured (callers print the message and exit 1). Always
 * `close()` the result so an open pg connection doesn't keep the process alive.
 */
export async function openBackend(): Promise<Backend> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    // SSL is driven by the connection string's `sslmode` (Neon's pooled URL
    // includes `sslmode=require`); local Postgres URLs omit it. A single Client
    // suffices — these scripts run one query at a time, sequentially.
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    return {
      kind: "neon",
      async query(sql, params) {
        const res = await client.query(sql, params as unknown[] | undefined);
        return res.rows as Record<string, unknown>[];
      },
      close: () => client.end(),
    };
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { kind: "supabase", client, close: async () => {} };
  }

  throw new Error(
    "No database configured. Set DATABASE_URL (Neon/Postgres) or " +
      "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local."
  );
}
