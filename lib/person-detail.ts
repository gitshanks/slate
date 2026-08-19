import "server-only";

import type { PersonProfileDetail } from "@/lib/person-detail-types";
import { getPersonDetail, getPersonRelevantCredits } from "@/lib/tmdb";

export async function buildPersonProfileDetail(
  id: number,
): Promise<PersonProfileDetail> {
  const person = await getPersonDetail(id);
  const credits = await getPersonRelevantCredits(
    id,
    person.known_for_department,
  );

  return {
    id: person.id,
    name: person.name,
    biography: person.biography || null,
    birthday: person.birthday,
    placeOfBirth: person.place_of_birth,
    profilePath: person.profile_path,
    knownForDepartment: person.known_for_department || null,
    knownFor: credits.map((credit) => ({
      tmdbId: credit.id,
      mediaType: credit.media_type,
      title: credit.title || credit.name || "Untitled",
      originalTitle:
        credit.original_title || credit.original_name || null,
      overview: credit.overview || null,
      posterPath: credit.poster_path,
      backdropPath: credit.backdrop_path,
      releaseDate: credit.release_date || credit.first_air_date || null,
      tmdbRating: credit.vote_average ?? null,
    })),
  };
}
