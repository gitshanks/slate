import "server-only";
import { revalidateTag } from "next/cache";
import { searchMultiWithFallback, type TmdbMediaResult } from "@/lib/tmdb";
import { supabase } from "@/lib/supabase";
import type { ParsedRow } from "@/lib/import-parse";

/**
 * Shared backend pipeline for the two import entry points:
 *   1. `/import` web page  → user pastes/uploads a CSV, reviews matches, commits.
 *   2. `/api/import/submit` → browser extension pushes scraped rows, auto-commits.
 *
 * Both paths call `matchToTmdb(rows)` to enrich `ParsedRow[]` into `ReviewRow[]`
 * (one TMDB search per row, bounded concurrency). The web page renders the
 * review table, lets the user uncheck bad matches, then calls
 * `upsertReviewedRows()`. The extension skips the review step and pipes its
 * matches straight into `upsertReviewedRows()` — same function, same guarantees
 * (idempotent upsert, tag revalidation).
 *
 * No per-row TMDB detail fetch — we use the search hit's title/poster/overview
 * as-is. Missing runtime/genres/real rating get backfilled by the title-detail
 * page on first view. Documented trade-off, called out in the plan.
 */

export interface ReviewRowCandidate {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  year: number | null;
}

export interface ReviewRow {
  /** Stable key for React lists — `sourceIndex` + a slice of the raw text. */
  key: string;
  /** Whatever the source originally said — shown dim in the review UI. */
  sourceText: string;
  /** Cleaned query that was fed to TMDB (after episode strip). */
  searchQuery: string;
  /** ISO-ish date from the source, if any. Becomes `watched_at` on commit. */
  sourceDate?: string;
  /** Year from the source column, used for disambiguation. */
  sourceYear?: number;
  /** True if the raw text looked like a specific episode ("…: Season 1: …"). */
  isEpisode: boolean;
  /** TMDB gave no direct hit; we dropped trailing words to find a match. */
  approximate: boolean;
  /** The query that actually produced the match, if different from `searchQuery`. */
  approxQuery: string | null;

  // ─ Primary match (null fields when no match at all) ─
  tmdbId: number | null;
  mediaType: "movie" | "tv" | null;
  title: string | null;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  tmdbRating: number | null;
  /** Release year of the matched TMDB entry (for review UI). */
  matchYear: number | null;

  /** Up to 4 alternative candidates for a future "swap match" UI. */
  alternatives: ReviewRowCandidate[];

  /** Review UI checkbox state. Defaults to true for anything with a match. */
  selected: boolean;
}

// ─── Bounded concurrency ────────────────────────────────────────────────
// Hand-rolled `Promise.all` with a worker pool so we don't fan out 500
// simultaneous TMDB fetches (they'd 429 us in seconds). Eight workers is
// comfortably below TMDB's ~40 req/s limit even with word-drop retries.

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ─── Matcher ───────────────────────────────────────────────────────────

const CONCURRENCY = 8;

/** Pick the best candidate from TMDB results given the parse hints. */
function pickBest(
  results: TmdbMediaResult[],
  hints: { mediaHint?: "movie" | "tv"; year?: number; isEpisode?: boolean }
): TmdbMediaResult | null {
  if (results.length === 0) return null;
  const preferredType =
    hints.mediaHint ?? (hints.isEpisode ? ("tv" as const) : undefined);

  // If we know the media type, narrow first — otherwise fall back to all.
  const typed = preferredType
    ? results.filter((r) => r.media_type === preferredType)
    : results;
  const pool = typed.length > 0 ? typed : results;

  // Year match beats popularity rank.
  if (hints.year != null) {
    const yearMatch = pool.find((r) => matchYear(r) === hints.year);
    if (yearMatch) return yearMatch;
  }

  return pool[0];
}

function matchYear(r: TmdbMediaResult): number | null {
  const raw = r.media_type === "movie" ? r.release_date : r.first_air_date;
  if (!raw) return null;
  const y = Number(raw.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function displayTitle(r: TmdbMediaResult): string {
  return r.title ?? r.name ?? "";
}

function displayOriginal(r: TmdbMediaResult): string {
  return r.original_title ?? r.original_name ?? displayTitle(r);
}

function candidateFromResult(r: TmdbMediaResult): ReviewRowCandidate {
  return {
    tmdbId: r.id,
    mediaType: r.media_type,
    title: displayTitle(r),
    posterPath: r.poster_path ?? null,
    year: matchYear(r),
  };
}

/**
 * Takes the parsed rows and runs each through `searchMultiWithFallback`,
 * picking the best match using the media-type hint + year. Returns a
 * `ReviewRow[]` aligned with the input (one output per input, no reordering).
 */
export async function matchToTmdb(rows: ParsedRow[]): Promise<ReviewRow[]> {
  return mapPool(rows, CONCURRENCY, async (row, i) => {
    const keyPrefix = `${i}-${row.sourceText.slice(0, 24).replace(/\s+/g, "_")}`;
    const base: ReviewRow = {
      key: keyPrefix,
      sourceText: row.sourceText,
      searchQuery: row.title,
      sourceDate: row.date,
      sourceYear: row.year,
      isEpisode: row.isEpisode ?? false,
      approximate: false,
      approxQuery: null,
      tmdbId: null,
      mediaType: null,
      title: null,
      originalTitle: null,
      overview: null,
      posterPath: null,
      backdropPath: null,
      releaseDate: null,
      tmdbRating: null,
      matchYear: null,
      alternatives: [],
      selected: false,
    };

    if (!row.title.trim()) return base;

    try {
      const { results, approximate, approxQuery } =
        await searchMultiWithFallback(row.title);
      const best = pickBest(results, {
        mediaHint: row.mediaHint,
        year: row.year,
        isEpisode: row.isEpisode,
      });
      if (!best) {
        return { ...base, approximate, approxQuery };
      }

      // Alternatives: up to 4 other viable hits, same type or not.
      const alternatives = results
        .filter((r) => r.id !== best.id)
        .slice(0, 4)
        .map(candidateFromResult);

      return {
        ...base,
        approximate,
        approxQuery,
        tmdbId: best.id,
        mediaType: best.media_type,
        title: displayTitle(best),
        originalTitle: displayOriginal(best),
        overview: best.overview ?? null,
        posterPath: best.poster_path ?? null,
        backdropPath: best.backdrop_path ?? null,
        releaseDate:
          (best.media_type === "movie" ? best.release_date : best.first_air_date) ??
          null,
        tmdbRating: best.vote_average ?? null,
        matchYear: matchYear(best),
        alternatives,
        selected: true,
      };
    } catch {
      // A single row's TMDB call failing doesn't kill the batch.
      return base;
    }
  });
}

// ─── Upsert ────────────────────────────────────────────────────────────

/**
 * Row shape that hits the Supabase `titles` table. Mirrors the schema fields
 * that exist at import time — detail-only fields (runtime, genres, real
 * rating) stay null and are backfilled when the user visits the title page.
 */
interface UpsertRow {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  tmdb_rating: number | null;
  tmdb_vote_count: number | null;
  status: "watched";
  watched_at: string;
}

export interface UpsertResult {
  /** How many unique (tmdb_id, media_type) rows were upserted. */
  inserted: number;
  /** Source rows that had no match and were skipped. */
  unmatchedCount: number;
}

/**
 * Commit the user's (or extension's) reviewed rows. Dedupes multiple episode
 * hits of the same show down to one row with the earliest `watched_at`,
 * batches into a single `upsert()` call with `onConflict: "tmdb_id,media_type"`,
 * and revalidates the `"titles"` tag so every grid page picks up the new data.
 *
 * Idempotent: re-importing the same CSV is a no-op for rows already in the
 * library (the existing row's watched_at/watched-status stays — upsert with
 * ignoreDuplicates=false would overwrite it, so we pass true).
 */
export async function upsertReviewedRows(
  reviewed: ReviewRow[]
): Promise<UpsertResult> {
  const unmatchedCount = reviewed.filter((r) => r.tmdbId == null).length;

  const raw: UpsertRow[] = reviewed
    .filter(
      (r): r is ReviewRow & { tmdbId: number; mediaType: "movie" | "tv" } =>
        r.tmdbId != null && r.mediaType != null && r.selected
    )
    .map((r) => ({
      tmdb_id: r.tmdbId,
      media_type: r.mediaType,
      title: r.title ?? r.searchQuery,
      original_title: r.originalTitle ?? r.title ?? r.searchQuery,
      overview: r.overview,
      poster_path: r.posterPath,
      backdrop_path: r.backdropPath,
      release_date: r.releaseDate,
      tmdb_rating: r.tmdbRating,
      tmdb_vote_count: null,
      status: "watched" as const,
      watched_at: normaliseDate(r.sourceDate) ?? new Date().toISOString(),
    }));

  if (raw.length === 0) {
    return { inserted: 0, unmatchedCount };
  }

  // Dedupe by (tmdb_id, media_type); keep the earliest watched_at so e.g. a
  // Netflix dump's 62 Breaking Bad episodes collapse into one show row dated
  // the first time you watched any episode.
  const dedup = new Map<string, UpsertRow>();
  for (const row of raw) {
    const key = `${row.tmdb_id}:${row.media_type}`;
    const prev = dedup.get(key);
    if (!prev) {
      dedup.set(key, row);
      continue;
    }
    if (row.watched_at < prev.watched_at) {
      dedup.set(key, row);
    }
  }
  const payload = Array.from(dedup.values());

  // ignoreDuplicates:true — if the title is already in the library (maybe
  // status='watching' or rated 8), we don't want to stomp the user's state.
  // The conflict target then falls through as a no-op for that row.
  const { error } = await supabase
    .from("titles")
    .upsert(payload, {
      onConflict: "tmdb_id,media_type",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`Import upsert failed: ${error.message}`);
  }

  revalidateTag("titles", {});
  return { inserted: payload.length, unmatchedCount };
}

/**
 * Turn whatever the source gave us (`"2024-03-12"`, `"3/12/2024"`,
 * `"2024-03-12T08:00:00Z"`) into an ISO string Supabase will accept, or undefined
 * if we can't parse it.
 */
function normaliseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
