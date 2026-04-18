import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export type { MediaType, TitleStatus, TitleRow, ListRow } from "@/lib/types";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export const supabase: SupabaseClient =
  process.env.NEXT_PUBLIC_DEMO_MODE === "1"
    ? buildDemoClient()
    : url && serviceKey
      ? createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : (() => {
          console.warn(
            "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
              "Using a no-op stub. Set them in .env.local for real data."
          );
          return createStub();
        })();

