// frameXTV deep links (https://framextv.xyz/api — iframe/embed docs).
//
// URL scheme (TMDB ids):
//   movie        → /watch/{tmdbId}
//   series       → /tv/{tmdbId} (detail + episode picker)
//   episode      → /watch/{tmdbId}/{season}/{episode}
// Client-safe: no server-only imports so buttons can use this directly.

export const FRAMEXTV_ORIGIN = "https://framextv.xyz";

export function frameXtvMovieUrl(tmdbId: number): string {
  return `${FRAMEXTV_ORIGIN}/watch/${tmdbId}`;
}

export function frameXtvSeriesUrl(tmdbId: number): string {
  return `${FRAMEXTV_ORIGIN}/tv/${tmdbId}`;
}

export function frameXtvEpisodeUrl(
  tmdbId: number,
  season: number,
  episode: number,
): string {
  return `${FRAMEXTV_ORIGIN}/watch/${tmdbId}/${season}/${episode}`;
}

// ─── Native embeds (iframe src — plays inside Slate, no redirect) ─────
// Docs: /embed/{tmdbId} for movies, /embed/{tmdbId}/{season}/{episode}
// for series. Query params: autoplay, muted, t/start, speed, controls,
// server/provider, title, poster/backdrop.

export interface FrameXtvEmbedOptions {
  autoplay?: boolean;
  title?: string;
}

function embedQuery(options: FrameXtvEmbedOptions): string {
  const params = new URLSearchParams();
  params.set("autoplay", options.autoplay === false ? "0" : "1");
  if (options.title?.trim()) params.set("title", options.title.trim());
  return params.toString();
}

export function frameXtvMovieEmbed(
  tmdbId: number,
  options: FrameXtvEmbedOptions = {},
): string {
  return `${FRAMEXTV_ORIGIN}/embed/${tmdbId}?${embedQuery(options)}`;
}

export function frameXtvEpisodeEmbed(
  tmdbId: number,
  season: number,
  episode: number,
  options: FrameXtvEmbedOptions = {},
): string {
  return `${FRAMEXTV_ORIGIN}/embed/${tmdbId}/${season}/${episode}?${embedQuery(options)}`;
}

/** A watchable season: regular seasons only (no specials bucket). */
export interface FrameXtvSeason {
  season_number: number;
  episode_count: number;
  name: string;
}

/** Episode row served by /api/tv/[tmdbId]/season/[season]. */
export interface FrameXtvEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
}

export function toFrameXtvSeasons(
  seasons: { season_number: number; episode_count: number; name: string }[] | null | undefined,
): FrameXtvSeason[] {
  return (seasons ?? []).filter(
    (season) => season.season_number >= 1 && season.episode_count > 0,
  );
}
