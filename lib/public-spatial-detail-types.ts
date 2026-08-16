import type { TitleRow, TitleStatus } from "@/lib/types";

export interface PublicSpatialPerson {
  id: number;
  name: string;
  subtitle: string | null;
  profilePath: string | null;
}

export interface PublicSpatialProvider {
  id: number;
  name: string;
  logoPath: string;
}

export interface PublicSpatialRecommendation {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  tmdbRating: number | null;
}

export interface PublicSpatialSavedTitle {
  id: string;
  status: TitleStatus;
}

export interface PublicSpatialTitleDetail {
  /**
   * Discover opens immediately from catalogue data, then hydrates the richer
   * runtime, genres, artwork, and ratings returned by its detail endpoint.
   * Library/public inspectors already own a complete row and omit this field.
   */
  resolvedTitle?: TitleRow;
  /** Present for authenticated Discover titles that already exist in Library. */
  savedTitle?: PublicSpatialSavedTitle | null;
  summary: string | null;
  tagline: string | null;
  trailerKey: string | null;
  directedBy: string[];
  cast: PublicSpatialPerson[];
  crew: PublicSpatialPerson[];
  recommendations: PublicSpatialRecommendation[];
  watchProviders: {
    link: string;
    providers: PublicSpatialProvider[];
  } | null;
}
