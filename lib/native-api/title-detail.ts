import "server-only";

import { libraryClientForOwner } from "@/lib/library-db";
import { listDTO, titleDTO } from "@/lib/native-api/dto";
import { NativeApiError } from "@/lib/native-api/http";
import { getTitleMeta, type TmdbSearchResult } from "@/lib/tmdb";
import type { ListRow, TitleRow } from "@/lib/types";

function recommendationDTO(item: TmdbSearchResult, fallbackType: "movie" | "tv") {
  const mediaType = item.media_type === "movie" || item.media_type === "tv"
    ? item.media_type
    : fallbackType;
  return {
    tmdbId: item.id,
    mediaType,
    title: item.title || item.name || "Untitled",
    originalTitle: item.original_title || item.original_name || null,
    overview: item.overview || null,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    releaseDate: item.release_date || item.first_air_date || null,
    tmdbRating: item.vote_average ?? null,
  };
}

export async function getNativeTitleDetail(
  ownerId: string,
  titleId: string,
) {
  const db = libraryClientForOwner(ownerId);
  const { data: titleData, error: titleError } = await db
    .from("titles")
    .select("*")
    .eq("id", titleId)
    .maybeSingle();
  if (titleError) throw new Error(titleError.message);
  if (!titleData) {
    throw new NativeApiError(404, "not_found", "This title is not in your library.");
  }

  const title = titleData as TitleRow;
  const [meta, listsResult, membershipsResult] = await Promise.all([
    getTitleMeta(title.media_type, title.tmdb_id),
    db.from("lists").select("*").order("name", { ascending: true }),
    db.from("list_titles").select("list_id").eq("title_id", title.id),
  ]);
  if (listsResult.error) throw new Error(listsResult.error.message);
  if (membershipsResult.error) throw new Error(membershipsResult.error.message);

  const memberListIds = new Set(
    (membershipsResult.data ?? []).map((row) => String(row.list_id)),
  );

  return {
    title: titleDTO(title),
    trailerKey: meta.trailerKey,
    cast: meta.cast.map((person) => ({
      id: person.id,
      name: person.name,
      subtitle: person.character || null,
      profilePath: person.profile_path,
    })),
    crew: meta.crew.map((person) => ({
      id: person.id,
      name: person.name,
      subtitle: person.job || null,
      profilePath: person.profile_path,
    })),
    recommendations: meta.recommendations.map((item) =>
      recommendationDTO(item, title.media_type),
    ),
    watchProviders: meta.watchProviders
      ? {
          link: meta.watchProviders.link,
          providers: meta.watchProviders.providers.map((provider) => ({
            id: provider.provider_id,
            name: provider.provider_name,
            logoPath: provider.logo_path,
          })),
        }
      : null,
    lists: ((listsResult.data ?? []) as ListRow[]).map((list) => ({
      ...listDTO(list),
      containsTitle: memberListIds.has(list.id),
    })),
  };
}
