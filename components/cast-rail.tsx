import Image from "next/image";
import { profileUrl } from "@/lib/tmdb-image";
import { RailScroller } from "@/components/rail-scroller";
import type { TmdbCastMember } from "@/lib/tmdb";

interface CastRailProps {
  cast: TmdbCastMember[];
}

/**
 * Horizontal rail of billed cast members. Each tile is a circular headshot
 * with the actor's name and character underneath. Uses the same RailScroller
 * as TmdbRail so iPad swipe + desktop drag behavior is identical.
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

      <div className="-mr-4 sm:-mr-6 lg:-mr-10">
        <RailScroller>
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
              <div
                key={member.id}
                className="group block w-[104px] shrink-0 snap-start"
              >
                <div className="relative mx-auto aspect-square w-[88px] overflow-hidden rounded-full border border-border bg-card shadow-sm">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={member.name}
                      fill
                      sizes="88px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-mono font-medium text-muted-foreground">
                      {initials || "?"}
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate text-center text-[11px] font-medium text-foreground">
                  {member.name}
                </p>
                {member.character && (
                  <p className="truncate text-center text-[10px] text-muted-foreground">
                    {member.character}
                  </p>
                )}
              </div>
            );
          })}
        </RailScroller>
      </div>
    </section>
  );
}
