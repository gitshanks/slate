import type { TmdbCastMember } from "@/lib/tmdb";
import { PeopleGrid } from "@/components/people-grid";

interface CastRailProps {
  cast: TmdbCastMember[];
}

/** Billed cast as a wrapped grid. Server component. */
export function CastRail({ cast }: CastRailProps) {
  return (
    <PeopleGrid
      title="Cast"
      people={cast.map((m) => ({
        id: m.id,
        name: m.name,
        subtitle: m.character,
        profilePath: m.profile_path,
      }))}
    />
  );
}
