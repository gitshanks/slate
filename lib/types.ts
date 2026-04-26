// Shared types — no server-only dependency, importable from client components.

export type MediaType = "movie" | "tv";
export type TitleStatus = "want" | "watching" | "watched" | "dropped";

export interface TitleRow {
  id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[] | null;
  status: TitleStatus;
  rating: number | null;
  review: string | null;
  favorite: boolean;
  added_at: string;
  watched_at: string | null;
  tmdb_rating: number | null;
  tmdb_vote_count: number | null;
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
  ratings_fetched_at: string | null;
}

export interface ListRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
}
