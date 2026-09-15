import type { TmdbPreviewItem, TmdbPreviewSource } from "@/lib/tmdb";

export const SOURCE_LABELS: Record<TmdbPreviewSource, string> = {
  library: "Based on your library",
  trending: "Trending this week",
  now_playing: "Now playing",
};

export const SOURCE_TONES: Record<TmdbPreviewSource, string> = {
  library: "text-emerald-200",
  trending: "text-amber-200",
  now_playing: "text-sky-200",
};

const MOVIE_GENRE_NAMES = new Map<number, string>([
  [28, "Action"],
  [12, "Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [14, "Fantasy"],
  [36, "History"],
  [27, "Horror"],
  [10402, "Music"],
  [9648, "Mystery"],
  [10749, "Romance"],
  [878, "Science Fiction"],
  [53, "Thriller"],
  [10752, "War"],
  [37, "Western"],
]);
const TV_GENRE_NAMES = new Map<number, string>([
  [10759, "Action & Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [10762, "Kids"],
  [9648, "Mystery"],
  [10764, "Reality"],
  [10765, "Sci-Fi & Fantasy"],
  [10766, "Soap"],
  [10767, "Talk"],
  [10768, "War & Politics"],
  [37, "Western"],
]);

export function titleFor(item: TmdbPreviewItem) {
  return item.title || item.name || "Untitled";
}

export function yearFor(item: TmdbPreviewItem) {
  const date = item.release_date || item.first_air_date || "";
  return date.slice(0, 4);
}

export function primaryGenre(item: TmdbPreviewItem) {
  const genreId = item.genre_ids?.[0];
  if (!genreId) return null;
  const table =
    item.media_type === "movie" ? MOVIE_GENRE_NAMES : TV_GENRE_NAMES;
  const name = table.get(genreId);
  if (!name) return null;
  return name;
}
