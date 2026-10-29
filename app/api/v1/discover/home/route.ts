import { libraryClientForOwner } from "@/lib/library-db";
import { apiData, apiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import {
  getNowPlaying,
  getRecommendedFromWatched,
  getTrending,
  type TmdbSearchResult,
} from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The three rails of the web Discover page (components/discover-default.tsx). */
export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const db = libraryClientForOwner(claims.ownerId);
    const [{ data }, recommended, trending, nowPlaying] = await Promise.all([
      db.from("titles").select("tmdb_id, media_type"),
      getRecommendedFromWatched(undefined, { db }),
      getTrending(),
      getNowPlaying(),
    ]);
    const saved = new Set(
      ((data ?? []) as { tmdb_id: number; media_type: string }[]).map(
        (row) => `${row.media_type}:${row.tmdb_id}`,
      ),
    );
    const rail = (items: TmdbSearchResult[], fallbackType?: "movie" | "tv") =>
      items
        .filter((item) => item.media_type !== "person")
        .map((item) => {
          const mediaType = item.media_type ?? fallbackType ?? "movie";
          return {
            tmdbId: item.id,
            mediaType,
            title: item.title ?? item.name ?? "",
            overview: item.overview ?? "",
            posterPath: item.poster_path,
            backdropPath: item.backdrop_path,
            releaseDate: item.release_date ?? item.first_air_date ?? null,
            voteAverage: item.vote_average ?? null,
            saved: saved.has(`${mediaType}:${item.id}`),
          };
        });

    return apiData({
      rails: [
        { id: "recommended", title: "Based on your library", items: rail(recommended) },
        { id: "trending", title: "Trending this week", items: rail(trending) },
        { id: "nowPlaying", title: "Now playing", items: rail(nowPlaying, "movie") },
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}
