import { unstable_cache } from "next/cache";
import { libraryClientForOwner } from "@/lib/library-db";
import { apiData, apiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import {
  getNowPlaying,
  getRecommendedFromWatched,
  getStreamingRail,
  getTrending,
  type TmdbSearchResult,
} from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This route has to be dynamic for its auth, which also turns off the TMDB fetch cache
// (see lib/tmdb.ts), and every TV polls it. So its TMDB work is cached here instead.
// These return nothing when TMDB fails; throwing keeps that out of the cache for hours.
function notEmpty(items: TmdbSearchResult[]) {
  if (items.length === 0) throw new Error("TMDB returned no titles");
  return items;
}
const SHARED_RAIL_SECONDS = 6 * 60 * 60;
const cachedTrending = unstable_cache(async () => notEmpty(await getTrending()), ["discover-home-trending"], { revalidate: SHARED_RAIL_SECONDS });
const cachedNowPlaying = unstable_cache(async () => notEmpty(await getNowPlaying()), ["discover-home-now-playing"], { revalidate: SHARED_RAIL_SECONDS });
const cachedStreamingRail = unstable_cache(
  (providerId: string) => getStreamingRail(providerId),
  ["discover-home-streaming"],
  { revalidate: SHARED_RAIL_SECONDS },
);

// TMDB's watch provider ids.
const STREAMING_SERVICES = [
  { id: "8", slug: "netflix", name: "Netflix" },
  { id: "9", slug: "prime", name: "Prime Video" },
  { id: "337", slug: "disney", name: "Disney+" },
  { id: "15", slug: "hulu", name: "Hulu" },
  { id: "350", slug: "apple", name: "Apple TV" },
  { id: "1899", slug: "max", name: "HBO Max" },
  { id: "386", slug: "peacock", name: "Peacock" },
  // Listed under its plans as well as the service.
  { id: "531|2303|2616", slug: "paramount", name: "Paramount+" },
];

/** The three rails of the web Discover page (components/discover-default.tsx), then one per streaming service. */
export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const db = libraryClientForOwner(claims.ownerId);
    const streaming = Promise.all(
      STREAMING_SERVICES.map((service) => cachedStreamingRail(service.id).catch(() => [] as TmdbSearchResult[])),
    );
    const [{ data }, recommended, trending, nowPlaying, serviceRails] = await Promise.all([
      db.from("titles").select("tmdb_id, media_type"),
      // Not in unstable_cache: this reads the library, which came back empty there. TVs only
      // ask every few hours, so this costs little. A wider read of the library than the default.
      getRecommendedFromWatched(undefined, { db, seedCount: 14 }),
      cachedTrending().catch(() => [] as TmdbSearchResult[]),
      cachedNowPlaying().catch(() => [] as TmdbSearchResult[]),
      streaming,
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
        ...STREAMING_SERVICES.map((service, i) => ({
          id: `service-${service.slug}`,
          title: `On ${service.name}`,
          items: rail(serviceRails[i]),
        })),
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}
