"use server";

import {
  searchMultiWithFallback,
  findByImdbId,
  getMovie,
  getTv,
  normalizeForStorage,
  type TmdbMediaResult,
} from "@/lib/tmdb";
import { getOmdbMetadata, isOmdbConfigured } from "@/lib/omdb";
import { getLibraryClient } from "@/lib/library-db";
import { IMPORT_BATCH_LIMIT, parseCsv, type ParsedRow } from "@/lib/import-parse";

/**
 * Single-shot library import. Accepts a CSV the user exported from Letterboxd
 * or Trakt, matches each row against TMDB, and upserts `status='watched'`
 * rows into `titles`. Idempotent — existing library keys are removed before
 * insert, so a title already in the library keeps its state.
 *
 * One action, no review step: bad matches can be removed individually from
 * the grid just like any other title. This is the "no-mess" version of the
 * earlier pipeline that had a review table, extension, and token flow.
 */

export interface ImportedTitle {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  year: number | null;
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  /** How many unique titles were matched and upserted (new or already present). */
  imported: number;
  /** Rows whose CSV title couldn't be matched on TMDB — surfaced in the UI. */
  unmatched: string[];
  /** The matched titles, in file order, so the page can show their posters. */
  titles: ImportedTitle[];
}

const EMPTY: ImportResult = { ok: false, imported: 0, unmatched: [], titles: [] };

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
  return importParsedRows(rows);
}

/**
 * One piece of an import the browser has already parsed. The page reads the
 * file itself (so it can show what is in it at once) and sends the rows in
 * small batches, so each batch's posters can land while the next is matched.
 * Rows come from the client, so every field is re-checked here.
 */
export async function importBatch(input: unknown): Promise<ImportResult> {
  if (!Array.isArray(input) || input.length === 0) {
    return { ...EMPTY, error: "Nothing to import." };
  }
  if (input.length > IMPORT_BATCH_LIMIT) {
    return { ...EMPTY, error: "Too many rows in one batch." };
  }
  const rows: ParsedRow[] = [];
  for (const item of input) {
    const row = sanitiseRow(item);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return { ...EMPTY, ok: true };
  return importParsedRows(rows);
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

function sanitiseRow(item: unknown): ParsedRow | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  const title = text(raw.title, 300) ?? "";
  const sourceText = text(raw.sourceText, 400) ?? title;
  if (!title.trim() && typeof raw.tmdbId !== "number" && !raw.imdbId) return null;
  const year =
    typeof raw.year === "number" && Number.isInteger(raw.year) && raw.year > 1800 && raw.year < 2200
      ? raw.year
      : undefined;
  const tmdbId =
    typeof raw.tmdbId === "number" && Number.isInteger(raw.tmdbId) && raw.tmdbId > 0
      ? raw.tmdbId
      : undefined;
  const imdbId =
    typeof raw.imdbId === "string" && /^tt\d{1,10}$/.test(raw.imdbId) ? raw.imdbId : undefined;
  const mediaHint =
    raw.mediaHint === "movie" || raw.mediaHint === "tv" ? raw.mediaHint : undefined;
  return {
    title,
    sourceText,
    year,
    date: text(raw.date, 40),
    tmdbId,
    imdbId,
    mediaHint,
    isEpisode: raw.isEpisode === true,
  };
}

async function importParsedRows(rows: ParsedRow[]): Promise<ImportResult> {
  const db = await getLibraryClient();
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
  const titles: ImportedTitle[] = deduped.map((row) => ({
    tmdb_id: row.tmdb_id,
    media_type: row.media_type,
    title: row.title,
    poster_path: row.poster_path,
    year: row.release_date ? Number(row.release_date.slice(0, 4)) || null : null,
  }));

  if (deduped.length > 0) {
    const { data: existing, error: readError } = await db
      .from("titles")
      .select("tmdb_id, media_type");
    if (readError) {
      return { ...EMPTY, error: `Database error: ${readError.message}` };
    }
    const existingKeys = new Set(
      (existing ?? []).map((row) => `${row.tmdb_id}:${row.media_type}`)
    );
    const newRows = deduped.filter(
      (row) => !existingKeys.has(`${row.tmdb_id}:${row.media_type}`)
    );

    if (newRows.length > 0) {
      const { error } = await db.from("titles").insert(newRows);
      if (error) {
        return { ...EMPTY, error: `Database error: ${error.message}` };
      }
    }
  }

  return {
    ok: true,
    imported: deduped.length,
    unmatched,
    titles,
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
  omdb_plot: string | null;
  omdb_plot_fetched_at: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
  metacritic_score: number | null;
  ratings_fetched_at: string | null;
}

interface MatchOutcome {
  sourceText: string;
  row: UpsertRow | null;
}

async function matchRow(row: ParsedRow): Promise<MatchOutcome> {
  const watchedAt = normaliseDate(row.date) ?? new Date().toISOString();

  async function withExternalMetadata(imdbId: string | null) {
    const metadata = imdbId
      ? await getOmdbMetadata(imdbId)
      : {
          imdb_rating: null,
          imdb_votes: null,
          rt_score: null,
          metacritic_score: null,
          omdb_plot: null,
        };
    return {
      ...metadata,
      imdb_id: imdbId,
      omdb_plot_fetched_at:
        imdbId && isOmdbConfigured() ? new Date().toISOString() : null,
      ratings_fetched_at:
        metadata.imdb_rating != null ||
        metadata.rt_score != null ||
        metadata.metacritic_score != null
          ? new Date().toISOString()
          : null,
    };
  }

  // IMDb rows carry the tt id: resolve it to a TMDB id exactly, then take
  // the same fast path as Trakt.
  if (row.tmdbId == null && row.imdbId) {
    try {
      const found = await findByImdbId(row.imdbId);
      if (found) row = { ...row, tmdbId: found.id, mediaHint: found.media_type };
    } catch {
      // Fall through to title search.
    }
  }

  // Fast path: Trakt rows carry a tmdb_id + type. Skip search, fetch detail.
  if (row.tmdbId != null && row.mediaHint) {
    try {
      const detail =
        row.mediaHint === "movie"
          ? await getMovie(row.tmdbId)
          : await getTv(row.tmdbId);
      const norm = normalizeForStorage(row.mediaHint, detail);
      const externalMetadata = await withExternalMetadata(norm.imdb_id);
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
          ...externalMetadata,
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
    const externalMetadata = await withExternalMetadata(imdbId);
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
        ...externalMetadata,
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
