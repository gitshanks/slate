/**
 * Format-agnostic parser for watch-history input. Handles:
 * - Netflix CSV (columns: Title, Date)
 * - Letterboxd diary CSV (Name, Year, Watched Date, Rating, ...)
 * - IMDb list CSV (Title, Year, ...)
 * - Trakt JSON (arrays of `{ movie: {...} }` or `{ show: {...} }`)
 * - Plain text — one title per line
 *
 * The caller hands us raw text + optional filename. We sniff the format,
 * map columns heuristically, strip Netflix's `"Show: Season N: Episode"`
 * suffixes for TV titles, and return `ParsedRow[]` — the shape every
 * downstream stage consumes.
 *
 * No external deps; the CSV splitter is hand-rolled (~40 lines) so a bad
 * row doesn't pull in 15KB of papaparse.
 */

export interface ParsedRow {
  /** Cleaned title used as the TMDB search query. */
  title: string;
  /** Whatever the user originally typed/pasted on this row. Shown dim in the review UI. */
  sourceText: string;
  /** Parsed year if the source had a Year column. */
  year?: number;
  /** Parsed date if the source had a Date column (ISO-ish). */
  date?: string;
  /** Hint from the source row ("movie" vs "tv"), if one could be inferred. */
  mediaHint?: "movie" | "tv";
  /** True if we detected this row as an episode within a series. */
  isEpisode?: boolean;
}

export type ImportFormat = "json" | "csv" | "tsv" | "plain";

// ─── Public entry point ────────────────────────────────────────────────

export function parseTextInput(raw: string, fileName?: string): ParsedRow[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const format = detectFormat(text, fileName);
  if (format === "json") return parseJson(text);
  if (format === "plain") return parsePlainLines(text);
  return parseDelimited(text, format === "tsv" ? "\t" : ",");
}

// ─── Format sniff ──────────────────────────────────────────────────────

export function detectFormat(text: string, fileName?: string): ImportFormat {
  const head = text.slice(0, 4096).trim();
  // Filename hint
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".tsv")) return "tsv";
    if (lower.endsWith(".csv")) return "csv";
  }
  // JSON
  if (head.startsWith("[") || head.startsWith("{")) {
    try {
      JSON.parse(head.endsWith(",") ? head.slice(0, -1) : head);
      return "json";
    } catch {
      /* not JSON, fall through */
    }
  }
  // Delimited: vote by first-line delimiter count
  const firstLine = head.split("\n", 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  if (tabs >= 1 && tabs >= commas) return "tsv";
  if (commas >= 1) return "csv";
  return "plain";
}

// ─── Episode stripping ─────────────────────────────────────────────────

/**
 * Netflix exports episodes as `"Breaking Bad: Season 1: Pilot"`, limited
 * series as `"The Queen's Gambit: Limited Series: Episode 1"`, some British
 * shows as `"Taskmaster: Series 5: …"`. Strip any segment whose first word
 * matches Season/Series/Chapter/Volume/Part/Book/Limited Series.
 */
export function stripEpisode(raw: string): { cleaned: string; isEpisode: boolean } {
  const parts = raw.split(/:\s+/);
  if (parts.length < 2) return { cleaned: raw, isEpisode: false };
  const idx = parts.findIndex((p) =>
    /^(Season|Series|Limited Series|Part|Book|Chapter|Volume)\b/i.test(p.trim())
  );
  if (idx > 0) {
    return { cleaned: parts.slice(0, idx).join(": ").trim(), isEpisode: true };
  }
  return { cleaned: raw, isEpisode: false };
}

// ─── JSON branch (Trakt-style) ─────────────────────────────────────────

function parseJson(text: string): ParsedRow[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const items = Array.isArray(data) ? data : findArray(data);
  if (!Array.isArray(items)) return [];
  return items
    .map((item): ParsedRow | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      // Trakt nests under `.movie` or `.show`
      const nested =
        (obj.movie as Record<string, unknown> | undefined) ??
        (obj.show as Record<string, unknown> | undefined) ??
        obj;
      const title =
        pickString(nested, ["title", "name", "movie", "show"]) ??
        pickString(obj, ["title", "name"]);
      if (!title) return null;
      const year = pickNumber(nested, ["year"]) ?? pickNumber(obj, ["year"]);
      const date =
        pickString(obj, ["watched_at", "last_watched_at", "date", "rated_at"]) ??
        undefined;
      const mediaHint: "movie" | "tv" | undefined = obj.movie
        ? "movie"
        : obj.show
        ? "tv"
        : undefined;
      const { cleaned, isEpisode } = stripEpisode(title);
      const finalHint = mediaHint ?? (isEpisode ? "tv" : undefined);
      return {
        title: cleaned,
        sourceText: title,
        year: year ?? undefined,
        date: date ?? undefined,
        mediaHint: finalHint,
        isEpisode,
      };
    })
    .filter((r): r is ParsedRow => r !== null);
}

function findArray(obj: unknown): unknown[] | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const key of ["items", "entries", "watches", "history", "results", "data"]) {
    const v = rec[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  }
  return null;
}

// ─── Plain-text branch ─────────────────────────────────────────────────

function parsePlainLines(text: string): ParsedRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line): ParsedRow => {
      const { cleaned, isEpisode } = stripEpisode(line);
      return {
        title: cleaned,
        sourceText: line,
        isEpisode,
        mediaHint: isEpisode ? "tv" : undefined,
      };
    });
}

// ─── Delimited branch (CSV / TSV) ──────────────────────────────────────

function parseDelimited(text: string, delim: string): ParsedRow[] {
  const rows = splitDelimited(text, delim);
  if (rows.length === 0) return [];
  const header = looksLikeHeader(rows[0]) ? rows[0] : null;
  const body = header ? rows.slice(1) : rows;

  const cols = header ? mapColumns(header) : null;

  return body
    .map((cells): ParsedRow | null => {
      if (cells.every((c) => !c.trim())) return null;
      const raw = cols && cols.title != null ? cells[cols.title] : cells[0];
      if (!raw || !raw.trim()) return null;
      const year =
        cols && cols.year != null
          ? numOrUndef(cells[cols.year])
          : undefined;
      const date =
        cols && cols.date != null ? cells[cols.date]?.trim() || undefined : undefined;
      const mediaHintRaw =
        cols && cols.mediaType != null ? cells[cols.mediaType]?.trim().toLowerCase() : undefined;
      const explicitHint: "movie" | "tv" | undefined =
        mediaHintRaw === "movie" || mediaHintRaw === "film"
          ? "movie"
          : mediaHintRaw === "tv" || mediaHintRaw === "show" || mediaHintRaw === "series"
          ? "tv"
          : undefined;
      const { cleaned, isEpisode } = stripEpisode(raw);
      return {
        title: cleaned,
        sourceText: raw,
        year,
        date,
        mediaHint: explicitHint ?? (isEpisode ? "tv" : undefined),
        isEpisode,
      };
    })
    .filter((r): r is ParsedRow => r !== null);
}

function numOrUndef(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.trim());
  return Number.isFinite(n) && n > 1800 && n < 2200 ? n : undefined;
}

// ─── Column mapping (fuzzy header names) ───────────────────────────────

interface ColumnIndex {
  title: number | null;
  year: number | null;
  date: number | null;
  mediaType: number | null;
}

export function mapColumns(header: string[]): ColumnIndex {
  const idx: ColumnIndex = { title: null, year: null, date: null, mediaType: null };
  header.forEach((raw, i) => {
    const h = raw.trim().toLowerCase();
    if (
      idx.title == null &&
      /^(title|name|movie|show|film)$/.test(h)
    ) {
      idx.title = i;
      return;
    }
    if (idx.year == null && h === "year") {
      idx.year = i;
      return;
    }
    if (
      idx.date == null &&
      /(date|watched|rated|last.?seen)/.test(h) &&
      !/rate|rating/.test(h)
    ) {
      idx.date = i;
      return;
    }
    if (
      idx.mediaType == null &&
      /^(type|media.?type|kind)$/.test(h)
    ) {
      idx.mediaType = i;
      return;
    }
  });
  // Letterboxd's "Name" already matched above. Fall back to first column if
  // we found nothing title-ish.
  if (idx.title == null) idx.title = 0;
  return idx;
}

function looksLikeHeader(cells: string[]): boolean {
  if (cells.length === 0) return false;
  // Header cells: no digits, at least one title-ish keyword.
  const allNoDigits = cells.every((c) => !/\d/.test(c));
  const hasTitleWord = cells.some((c) =>
    /^(title|name|movie|show|film|year|date|watched|rating|type)$/i.test(c.trim())
  );
  return allNoDigits && hasTitleWord;
}

// ─── Hand-rolled CSV/TSV splitter ──────────────────────────────────────
// Respects double-quoted fields with escaped `""` quotes. Doesn't support
// literal newlines inside quoted fields — Netflix/Letterboxd/IMDb don't
// emit those. Good-enough for v1; swap for papaparse if we see breakage.

function splitDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    rows.push(splitLine(line, delim));
  }
  return rows;
}

function splitLine(line: string, delim: string): string[] {
  const cells: string[] = [];
  let i = 0;
  let cur = "";
  let quoted = false;
  while (i < line.length) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        quoted = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"' && cur === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delim) {
      cells.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  cells.push(cur);
  return cells;
}
