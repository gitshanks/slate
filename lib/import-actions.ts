"use server";

import { parseTextInput } from "@/lib/import-parse";
import {
  matchToTmdb,
  upsertReviewedRows,
  type ReviewRow,
} from "@/lib/import-pipeline";

/**
 * Thin server-action wrappers the `/import` page calls from its client
 * component. Keeps the component free of direct Supabase/TMDB imports —
 * it just hands raw text in and gets structured data back.
 *
 * The two-phase shape (parseAndMatch → confirmImport) mirrors the UI:
 * the widget shows a review table between the two calls so the user can
 * uncheck bad matches before any writes happen.
 */

export interface ParseAndMatchResult {
  rows: ReviewRow[];
  /** Parsed row count before matching — used for "showing N of M" copy. */
  parsedCount: number;
}

/**
 * Parse a raw CSV / TSV / JSON / plain-text blob and look each row up on TMDB.
 * Returns everything the review UI needs to render. Does **not** write to
 * Supabase; the user has to click "Import N titles" first.
 */
export async function parseAndMatch(
  raw: string,
  fileName?: string
): Promise<ParseAndMatchResult> {
  const parsed = parseTextInput(raw, fileName);
  if (parsed.length === 0) {
    return { rows: [], parsedCount: 0 };
  }
  const rows = await matchToTmdb(parsed);
  return { rows, parsedCount: parsed.length };
}

/**
 * Commit the user-approved review rows to Supabase. Bumps `status` to
 * `"watched"` and stamps `watched_at` from the source date when available.
 * Returns `{ inserted, unmatchedCount }` so the widget can show a
 * completion toast.
 */
export async function confirmImport(
  rows: ReviewRow[]
): Promise<{ inserted: number; unmatchedCount: number }> {
  return upsertReviewedRows(rows);
}
