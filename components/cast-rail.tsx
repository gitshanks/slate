import Link from "next/link";
import Image from "next/image";
import { profileUrl } from "@/lib/tmdb-image";
import type { TmdbCastMember } from "@/lib/tmdb";

interface CastRailProps {
  cast: TmdbCastMember[];
}

/**
 * Billed cast as a wrapped grid — the whole set fits on the page without
 * horizontal scrolling. Each tile links to the person's profile page.
 *
 * Server component — takes pre-fetched data as props.
 */
export function CastRail({ cast }: CastRailProps) {
  if (!cast.length) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
        Cast
      </h2>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-4 gap-y-6">
        {cast.map((member) => {
          const photo = profileUrl(member.profile_path, "w185");
          const initials = member.name
            .split(" ")
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <Link
              key={member.id}
              href={`/person/${member.id}`}
              className="group block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-full border border-border bg-card shadow-sm transition-all duration-200 hoverable:group-hover:border-primary/50 hoverable:group-hover:shadow-md">
                {photo ? (
                  <Image
                    src={photo}
                    alt={member.name}
                    fill
                    sizes="96px"
                    className="object-cover transition-transform duration-300 hoverable:group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-mono font-medium text-muted-foreground">
                    {initials || "?"}
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-center text-[11px] font-medium text-foreground transition-colors hoverable:group-hover:text-primary">
                {member.name}
              </p>
              {member.character && (
                <p className="truncate text-center text-[10px] text-muted-foreground">
                  {member.character}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
