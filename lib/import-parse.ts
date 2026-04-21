/**
 * Minimal CSV parser for library imports. Supports:
 * - Letterboxd `watched.csv` and `diary.csv` (columns: Name, Year, Watched Date, …)
 * - Trakt CSV exports                        (columns: title, year, tmdb_id, watched_at, …)
 * - Any CSV with a Title/Name column and optionally Year + Date + tmdb_id
 *
 * Hand-rolled splitter — no papaparse. Handles double-quoted fields and
 * escaped `""` quotes, which is what Letterboxd/Trakt/IMDb actually emit.
 * If the source is a plain one-title-per-line text file we still parse it;
 * column detection falls through to "first column = title."
 */

export interface ParsedRow {
  /** Cleaned query fed to TMDB search (after stripEpisode). */
  title: string;
  /** Whatever the source row said, for displaying in "unmatched" lists. */
  sourceText: string;
  /** Disambiguates remakes when present. */
  year?: number;
  /** ISO-ish date → maps to `watched_at` on the title row. */
  date?: string;
  /** Trakt exports include this — skip TMDB search entirely when we have it. */
  tmdbId?: number;
  /** Explicit source hint that beats the isEpisode fallback. */
  mediaHint?: "movie" | "tv";
  /** True if the raw title looked like "Show: Season 1: Episode 3". */
  isEpisode?: boolean;
}

export function parseCsv(raw: string): ParsedRow[] {
  const text = raw.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const rows = splitDelimited(text);
  if (rows.length === 0) return [];
  const header = looksLikeHeader(rows[0]) ? rows[0] : null;
  const body = header ? rows.slice(1) : rows;
  const cols = header ? mapColumns(header) : defaultColumns();

  return body
    .map((cells): ParsedRow | null => {
      const rawTitle = (cols.title != null ? cells[cols.title] : cells[0]) ?? "";
      if (!rawTitle.trim()) return null;
      const year =
        cols.year != null ? parseYear(cells[cols.year]) : undefined;
      const date =
        cols.date != null ? cells[cols.date]?.trim() || undefined : undefined;
      const tmdbId =
        cols.tmdbId != null ? parseIntLoose(cells[cols.tmdbId]) : undefined;
      const explicitHint =
        cols.mediaType != null ? parseMediaHint(cells[cols.mediaType]) : undefined;
      const { cleaned, isEpisode } = stripEpisode(rawTitle);
      return {
        title: cleaned,
        sourceText: rawTitle,
        year,
        date,
        tmdbId,
        mediaHint: explicitHint ?? (isEpisode ? "tv" : undefined),
        isEpisode,
      };
    })
    .filter((r): r is ParsedRow => r !== null);
}

// ─── Episode stripping ─────────────────────────────────────────────────
// Not hit by Letterboxd, but Trakt history exports can include per-episode
// rows (e.g. Breaking Bad: Season 1: Pilot). Collapse these so every episode
// of the same show dedups to one tv row with the earliest watched date.

export function stripEpisode(raw: string): { cleaned: string; isEpisode: boolean } {
  const parts = raw.split(/:\s+/);
  if (parts.length < 2) return { cleaned: raw.trim(), isEpisode: false };
  const idx = parts.findIndex((p) =>
    /^(Season|Series|Limited Series|Part|Book|Chapter|Volume)\b/i.test(p.trim())
  );
  if (idx > 0) return { cleaned: parts.slice(0, idx).join(": ").trim(), isEpisode: true };
  return { cleaned: raw.trim(), isEpisode: false };
}

// ─── Column mapping ────────────────────────────────────────────────────

interface ColumnIndex {
  title: number | null;
  year: number | null;
  date: number | null;
  tmdbId: number | null;
  mediaType: number | null;
}

function defaultColumns(): ColumnIndex {
  return { title: 0, year: null, date: null, tmdbId: null, mediaType: null };
}

function mapColumns(header: string[]): ColumnIndex {
  const idx: ColumnIndex = { title: null, year: null, date: null, tmdbId: null, mediaType: null };
  header.forEach((cell, i) => {
    const h = cell.trim().toLowerCase();
    if (idx.title == null && /^(title|name|movie|show|film)$/.test(h)) idx.title = i;
    else if (idx.year == null && /^(year|release year|released)$/.test(h)) idx.year = i;
    else if (
      idx.date == null &&
      /(watched[\s_]*(date|at)|last[\s_]*(seen|watched(?:_at)?))|^date$/.test(h)
    ) idx.date = i;
    else if (idx.tmdbId == null && /^tmdb[\s_]*id$/.test(h)) idx.tmdbId = i;
    else if (idx.mediaType == null && /^(type|media[\s_]*type|kind)$/.test(h)) idx.mediaType = i;
  });
  if (idx.title == null) idx.title = 0;
  return idx;
}

function looksLikeHeader(cells: string[]): boolean {
  if (cells.length === 0) return false;
  const anyDigits = cells.some((c) => /\d/.test(c));
  const hasKeyword = cells.some((c) =>
    /^(title|name|movie|show|film|year|date|watched|rating|type|tmdb[\s_]*id)$/i.test(c.trim())
  );
  // Header rows have keyword-like cells and no bare numbers like "2024".
  return hasKeyword && !anyDigits;
}

// ─── Field parsing ─────────────────────────────────────────────────────

function parseYear(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.trim());
  return Number.isFinite(n) && n > 1800 && n < 2200 ? n : undefined;
}

function parseIntLoose(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseMediaHint(s: string | undefined): "movie" | "tv" | undefined {
  if (!s) return undefined;
  const h = s.trim().toLowerCase();
  if (h === "movie" || h === "film") return "movie";
  if (h === "tv" || h === "show" || h === "series" || h === "episode") return "tv";
  return undefined;
}

// ─── Splitter ──────────────────────────────────────────────────────────
// Rows terminated by \n; fields by `,`. A `"`-quoted field can contain commas,
// newlines, and `""` escaped quotes. Letterboxd/Trakt/IMDb all follow RFC 4180.

function splitDelimited(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { quoted = false; continue; }
      cur += ch;
      continue;
    }
    if (ch === '"' && cur === "") { quoted = true; continue; }
    if (ch === ",") { row.push(cur); cur = ""; continue; }
    if (ch === "\n") {
      row.push(cur);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = []; cur = "";
      continue;
    }
    cur += ch;
  }
  // Trailing row (no final newline).
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}
