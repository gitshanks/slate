import type { ProfileRow } from "@/lib/profiles";
import { profileAvatarUrl } from "@/lib/profiles";
import type { ListRow, TitleRow } from "@/lib/types";

export function profileDTO(profile: ProfileRow, origin: string) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profileAvatarUrl(profile, origin),
    isPublic: profile.is_public,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export function titleDTO(title: TitleRow) {
  return {
    id: title.id,
    tmdbId: title.tmdb_id,
    mediaType: title.media_type,
    title: title.title,
    originalTitle: title.original_title,
    overview: title.omdb_plot || title.overview,
    posterPath: title.poster_path,
    backdropPath: title.backdrop_path,
    releaseDate: title.release_date,
    runtime: title.runtime,
    genres: title.genres,
    status: title.status,
    rating: title.rating,
    review: title.review,
    favorite: title.favorite,
    addedAt: title.added_at,
    watchedAt: title.watched_at,
    updatedAt: title.updated_at ?? title.added_at,
    position: title.position ?? 0,
    tmdbRating: title.tmdb_rating,
    tmdbVoteCount: title.tmdb_vote_count,
    imdbId: title.imdb_id,
    imdbRating: title.imdb_rating,
    imdbVotes: title.imdb_votes,
    rottenTomatoesScore: title.rt_score,
    metacriticScore: title.metacritic_score,
    currentSeason: title.current_season,
    currentEpisode: title.current_episode,
    seasons: title.seasons,
  };
}

export function listDTO(list: ListRow) {
  return {
    id: list.id,
    slug: list.slug,
    name: list.name,
    description: list.description,
    createdAt: list.created_at,
    updatedAt: list.updated_at ?? list.created_at,
  };
}
