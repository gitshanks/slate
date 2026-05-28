import type { TmdbCrewMember } from "@/lib/tmdb";
import { PeopleGrid } from "@/components/people-grid";

interface CrewRailProps {
  crew: TmdbCrewMember[];
}

/** Key crew as a wrapped grid — mirrors the cast layout. Server component. */
export function CrewRail({ crew }: CrewRailProps) {
  return (
    <PeopleGrid
      title="Crew"
      people={crew.map((m) => ({
        id: m.id,
        name: m.name,
        subtitle: m.job,
        profilePath: m.profile_path,
      }))}
    />
  );
}
