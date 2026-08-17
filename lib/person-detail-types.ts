export interface PersonKnownForTitle {
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

export interface PersonProfileDetail {
  id: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownForDepartment: string | null;
  knownFor: PersonKnownForTitle[];
}
