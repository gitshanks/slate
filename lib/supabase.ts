import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export const supabase: SupabaseClient =
  url && serviceKey
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

// ─── Types mirroring the schema ───────────────────────────────

export type MediaType = "movie" | "tv";
export type TitleStatus = "want" | "watching" | "watched" | "dropped";

export interface TitleRow {
  id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[] | null;
  status: TitleStatus;
  rating: number | null;
  review: string | null;
  favorite: boolean;
  added_at: string;
  watched_at: string | null;
  tmdb_rating: number | null;
  tmdb_vote_count: number | null;
}

export interface ListRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
}
