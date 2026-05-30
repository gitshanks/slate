import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { searchEverything } from "@/lib/search";
import { SearchResults } from "@/components/search-results";
import { EmptyState } from "@/components/empty-state";
import type { PersonTile } from "@/components/people-grid";
import type { TmdbPersonResult } from "@/lib/tmdb";

export const metadata: Metadata = {
  title: "slate — Search",
};

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** TMDB person result → the tile shape PeopleGrid renders. */
function toPersonTile(p: TmdbPersonResult): PersonTile {
  const knownFor = (p.known_for ?? [])
    .map((k) => k.title || k.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  return {
    id: p.id,
    name: p.name ?? "Unknown",
    subtitle: knownFor || p.known_for_department || null,
    profilePath: p.profile_path ?? null,
  };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const q = pick((await props.searchParams).q).trim();

  if (!q) {
    return (
      <EmptyState
        icon={<SearchX className="h-6 w-6" />}
        title="Search movies, shows & people"
        description="Press ⌘K, type a title or name, and hit Enter to land here."
      />
    );
  }

  const { library, media, people, savedTmdbIds, approximate, approxQuery } =
    await searchEverything(q);

  const nothing = library.length === 0 && media.length === 0 && people.length === 0;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Search results
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {q}
        </h1>
        {approximate && approxQuery && (
          <p className="mt-2 text-sm text-muted-foreground">
            No exact match — showing results for{" "}
            <span className="text-foreground">&ldquo;{approxQuery}&rdquo;</span>
          </p>
        )}
      </div>

      {nothing ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title={`No results for "${q}"`}
          description="Try a different spelling or fewer words."
        />
      ) : (
        <SearchResults
          library={library}
          media={media}
          people={people.map(toPersonTile)}
          savedTmdbIds={[...savedTmdbIds]}
        />
      )}
    </div>
  );
}
