import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SLATE_PUBLIC } from "@/lib/public-mode";
export type { MediaType, TitleStatus, TitleRow, ListRow } from "@/lib/types";

/**
 * When env vars are missing we hand back a stub that resolves every query
 * to an empty result, so pages render their empty state instead of crashing.
 * Actual writes will surface the configured error message via toast.
 */
function createStub(): SupabaseClient {
  const empty = { data: [] as unknown[], error: null };
  const single = { data: null, error: { message: "Supabase is not configured" } };
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    upsert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(single),
    then: (resolve: (v: typeof empty) => void) => resolve(empty),
  };
  // Make it await-able so `await supabase.from('x').select()` resolves to []
  return {
    from: () => builder,
  } as unknown as SupabaseClient;
}

// Demo mode: per-visitor cookie-backed sandbox. Gated at build time so the
// private deployment never imports this code.
function buildDemoClient(): SupabaseClient {
  // Dynamic import keeps demo-client.ts out of the private bundle entirely.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createDemoClient } = require("@/lib/demo-client") as typeof import("@/lib/demo-client");
  return createDemoClient() as unknown as SupabaseClient;
}

// Neon / Postgres backend: a drop-in for the supabase-js query surface backed
// by `pg`. Dynamic import keeps `pg` out of bundles that don't select it.
function buildNeonClient(): SupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createNeonClient } = require("@/lib/neon-client") as typeof import("@/lib/neon-client");
  return createNeonClient() as unknown as SupabaseClient;
}

// Backend selection, in precedence order:
//   Hosted mode + DATABASE_URL → Neon/Postgres
//   Demo-only mode             → cookie-backed demo sandbox
//   DATABASE_URL             → Neon/Postgres (the non-pausing primary)
//   SUPABASE_URL + key       → hosted Supabase / self-host PostgREST
//   otherwise                → no-op stub (renders empty states)
function buildClient(): SupabaseClient {
  if (SLATE_PUBLIC) return buildDemoClient();
  if (process.env.DATABASE_URL) return buildNeonClient();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  console.warn(
    "[supabase] No DATABASE_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY. " +
      "Using a no-op stub. Set them in .env.local for real data."
  );
  return createStub();
}

let cachedClient: SupabaseClient | null = null;
function client(): SupabaseClient {
  return (cachedClient ??= buildClient());
}

// Lazy facade. The app only ever calls `supabase.from(...)`, so we defer
// constructing the real client (and, for Neon, loading `pg`) until the first
// query at runtime. This is what keeps the DB driver out of Next's build-time
// "collect page data" pass, which imports every route module and would
// otherwise evaluate pg's bundled internals and crash.
export const supabase: SupabaseClient = {
  from: (table: string) => client().from(table),
} as unknown as SupabaseClient;
