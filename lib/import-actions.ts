"use server";

import { revalidateTag } from "next/cache";
import {
  searchMultiWithFallback,
  getMovie,
  getTv,
  normalizeForStorage,
  type TmdbMediaResult,
} from "@/lib/tmdb";
import { getOmdbRatings } from "@/lib/omdb";
import { supabase } from "@/lib/supabase";
import { parseCsv, type ParsedRow } from "@/lib/import-parse";

/**
 * Single-shot library import. Accepts a CSV the user exported from Letterboxd
 * or Trakt, matches each row against TMDB, and upserts `status='watched'`
 * rows into `titles`. Idempotent — re-running against the same CSV is a
 * no-op because of the `(tmdb_id, media_type)` unique constraint and
 * `ignoreDuplicates:true` (a title already in the library keeps its state).
 *
 * One action, no review step: bad matches can be removed individually from
 * the grid just like any other title. This is the "no-mess" version of the
 * earlier pipeline that had a review table, extension, and token flow.
 */

export interface ImportResult {
  ok: boolean;
  error?: string;
  /** How many unique titles were matched and upserted (new or already present). */
  imported: number;
  /** Rows whose CSV title couldn't be matched on TMDB — surfaced in the UI. */
  unmatched: string[];
}

const EMPTY: ImportResult = { ok: false, imported: 0, unmatched: [] };

export async function runImport(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...EMPTY, error: "Pick a CSV file to import." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ...EMPTY, error: "File is over 5 MB — split it up first." };
  }

  const raw = await file.text();
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return { ...EMPTY, error: "Couldn't find any rows. Is this a CSV with a Title/Name column?" };
  }

  const matched = await mapPool(rows, CONCURRENCY, matchRow);

  const upserts: UpsertRow[] = [];
  const unmatched: string[] = [];
  for (const m of matched) {
    if (m.row) upserts.push(m.row);
    else unmatched.push(m.sourceText);
  }

  // Collapse many-episodes-of-same-show down to one tv row with the earliest
  // watched_at. Trakt episode exports and re-scrapes both benefit from this.
  const deduped = dedupeByTmdbId(upserts);

  if (deduped.length > 0) {
    const { error } = await supabase
      .from("titles")
      // ignoreDuplicates:true so we don't stomp existing rows' status /
      // rating / review if the user re-imports over a library they've
      // already curated. New titles land as status='watched'.
      .upsert(deduped, { onConflict: "tmdb_id,media_type", ignoreDuplicates: true });
    if (error) {
      return { ...EMPTY, error: `Database error: ${error.message}` };
    }
    revalidateTag("titles", {});
  }

  return {
    ok: true,
    imported: deduped.length,
    unmatched,
  };
}

// ─── Matching ──────────────────────────────────────────────────────────

const CONCURRENCY = 6; // TMDB ~40 req/s; our word-drop fallback can triple that.

interface UpsertRow {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  status: "watched";
  watched_at: string;
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
  ratings_fetched_at: string | null;
}

interface MatchOutcome {
  sourceText: string;
  row: UpsertRow | null;
}

async function matchRow(row: ParsedRow): Promise<MatchOutcome> {
  const watchedAt = normaliseDate(row.date) ?? new Date().toISOString();

  async function withOmdb(imdbId: string | null) {
    const r = imdbId
      ? await getOmdbRatings(imdbId)
      : { imdb_rating: null, imdb_votes: null, rt_score: null };
    return {
      ...r,
      imdb_id: imdbId,
      ratings_fetched_at:
        r.imdb_rating != null || r.rt_score != null
          ? new Date().toISOString()
          : null,
    };
  }

  // Fast path: Trakt rows carry a tmdb_id + type. Skip search, fetch detail.
  if (row.tmdbId != null && row.mediaHint) {
    try {
      const detail =
        row.mediaHint === "movie"
          ? await getMovie(row.tmdbId)
          : await getTv(row.tmdbId);
      const norm = normalizeForStorage(row.mediaHint, detail);
      const ratings = await withOmdb(norm.imdb_id);
      return {
        sourceText: row.sourceText,
        row: {
          tmdb_id: norm.tmdb_id,
          media_type: norm.media_type,
          title: norm.title,
          original_title: norm.original_title,
          overview: norm.overview,
          poster_path: norm.poster_path,
          backdrop_path: norm.backdrop_path,
          release_date: norm.release_date,
          status: "watched",
          watched_at: watchedAt,
          ...ratings,
        },
      };
    } catch {
      // Fall through to title search if the ID is stale.
    }
  }

  if (!row.title.trim()) {
    return { sourceText: row.sourceText, row: null };
  }

  try {
    const { results } = await searchMultiWithFallback(row.title);
    const best = pickBest(results, row);
    if (!best) return { sourceText: row.sourceText, row: null };
    // Search results don't carry imdb_id; fetch full detail to get it,
    // then OMDB. A miss on either still produces a valid row.
    let imdbId: string | null = null;
    try {
      const detail =
        best.media_type === "movie"
          ? await getMovie(best.id)
          : await getTv(best.id);
      imdbId = detail.imdb_id ?? null;
    } catch {
      // Ignore — proceed without ratings.
    }
    const ratings = await withOmdb(imdbId);
    return {
      sourceText: row.sourceText,
      row: {
        tmdb_id: best.id,
        media_type: best.media_type,
        title: displayTitle(best),
        original_title: displayOriginal(best),
        overview: best.overview ?? null,
        poster_path: best.poster_path ?? null,
        backdrop_path: best.backdrop_path ?? null,
        release_date:
          (best.media_type === "movie" ? best.release_date : best.first_air_date) ??
          null,
        status: "watched",
        watched_at: watchedAt,
        ...ratings,
      },
    };
  } catch {
    // A single bad row shouldn't kill the batch.
    return { sourceText: row.sourceText, row: null };
  }
}

function pickBest(results: TmdbMediaResult[], row: ParsedRow): TmdbMediaResult | null {
  if (results.length === 0) return null;
  const preferred =
    row.mediaHint ?? (row.isEpisode ? ("tv" as const) : undefined);
  const typed = preferred
    ? results.filter((r) => r.media_type === preferred)
    : results;
  const pool = typed.length > 0 ? typed : results;
  // Year match beats popularity — disambiguates remakes.
  if (row.year != null) {
    const byYear = pool.find((r) => yearOf(r) === row.year);
    if (byYear) return byYear;
  }
  return pool[0];
}

function yearOf(r: TmdbMediaResult): number | null {
  const raw = r.media_type === "movie" ? r.release_date : r.first_air_date;
  if (!raw) return null;
  const y = Number(raw.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function displayTitle(r: TmdbMediaResult) {
  return r.title ?? r.name ?? "";
}
function displayOriginal(r: TmdbMediaResult) {
  return r.original_title ?? r.original_name ?? displayTitle(r);
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Bounded worker-pool. Keeps us below TMDB's rate limit even when every row
 * triggers the fuzzy retry (up to 3 TMDB calls per row).
 */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function dedupeByTmdbId(rows: UpsertRow[]): UpsertRow[] {
  const byId = new Map<string, UpsertRow>();
  for (const row of rows) {
    const key = `${row.tmdb_id}:${row.media_type}`;
    const prev = byId.get(key);
    if (!prev || row.watched_at < prev.watched_at) {
      byId.set(key, row);
    }
  }
  return Array.from(byId.values());
}

function normaliseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
