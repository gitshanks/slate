import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

export function formatYear(date: string | null | undefined): string {
  if (!date) return "";
  return date.slice(0, 4);
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a TMDB vote_average (0–10) as a user score percentage: 7.4 → "74%".
 * Returns null if the value isn't a usable number.
 */
export function formatTmdbScore(
  value: number | string | null | undefined
): string | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n * 10)}%`;
}

/** Format an IMDB rating (0–10) as a one-decimal string: 8.234 → "8.2". */
export function formatImdbRating(
  value: number | string | null | undefined
): string | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(1);
}

/** Format a Rotten Tomatoes Tomatometer (0–100) as a percentage string. */
export function formatRtScore(
  value: number | string | null | undefined
): string | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n < 0) return null;
  return `${Math.round(n)}%`;
}
