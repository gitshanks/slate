import { NextResponse } from "next/server";
import { verifyImportToken } from "@/lib/slate-token";
import { matchToTmdb, upsertReviewedRows } from "@/lib/import-pipeline";
import type { ParsedRow } from "@/lib/import-parse";

/**
 * The browser extension's push endpoint. Unlike the web `/import` page,
 * there's no interactive review step — the extension fires a background
 * sync, so we auto-commit everything that matches and return the list of
 * `sourceText` values that didn't. The extension's toast surfaces the
 * count; the user can open Slate's /import page to retry unmatched ones.
 *
 * Auth: `Authorization: Bearer <token>` against the token stored in
 * `app_settings` (see `lib/slate-token.ts`). Single-user app — one token
 * globally, rotatable from /settings.
 */

export const dynamic = "force-dynamic";
// Guard against runaway payloads — a normal Netflix history is ~1–5k rows,
// so 10k is comfortably above realistic with headroom for Prime's noisier
// history (every episode replay logs separately).
const MAX_ROWS = 10_000;

interface SubmitBody {
  service?: string;
  rows?: unknown;
}

/** Shape of a row the extension submits. Same fields as `ParsedRow`. */
function sanitiseRows(raw: unknown): ParsedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!title) continue;
    const sourceText = typeof r.sourceText === "string" ? r.sourceText : title;
    const date = typeof r.date === "string" ? r.date : undefined;
    const year = typeof r.year === "number" ? r.year : undefined;
    const mediaHint =
      r.mediaHint === "movie" || r.mediaHint === "tv" ? r.mediaHint : undefined;
    const isEpisode = r.isEpisode === true;
    out.push({ title, sourceText, date, year, mediaHint, isEpisode });
    if (out.length >= MAX_ROWS) break;
  }
  return out;
}

export async function POST(request: Request) {
  // Bearer auth — refuse before parsing the body so abusive clients get
  // rejected with minimal work.
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!bearer) {
    return NextResponse.json(
      { error: "Missing bearer token" },
      { status: 401 }
    );
  }
  const ok = await verifyImportToken(bearer);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = sanitiseRows(body.rows);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No importable rows in payload" },
      { status: 400 }
    );
  }

  try {
    const reviewed = await matchToTmdb(rows);
    const { inserted, unmatchedCount } = await upsertReviewedRows(reviewed);
    // Hand back the raw titles that didn't match so the extension can
    // forward them into Slate's /import page with `?unmatched=…` for
    // manual retry.
    const unmatched = reviewed
      .filter((r) => r.tmdbId == null)
      .map((r) => r.sourceText)
      .slice(0, 100);
    return NextResponse.json({
      service: typeof body.service === "string" ? body.service : null,
      inserted,
      unmatchedCount,
      unmatched,
      received: rows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
