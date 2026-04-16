import Link from "next/link";
import Image from "next/image";
import { profileUrl } from "@/lib/tmdb-image";
import type { TmdbCastMember } from "@/lib/tmdb";

interface CastRailProps {
  cast: TmdbCastMember[];
}

/**
 * Grid of billed cast members. Each tile links to the person's profile page.
 * Responsive: 4 columns on mobile, 8 on desktop.
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

      <div className="grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-6 md:grid-cols-8">
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
              className="group block shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
            >
              <div className="relative mx-auto aspect-square w-full max-w-[88px] overflow-hidden rounded-full border border-border bg-card shadow-sm transition-all duration-200 hoverable:group-hover:border-primary/50 hoverable:group-hover:shadow-md">
                {photo ? (
                  <Image
                    src={photo}
                    alt={member.name}
                    fill
                    sizes="(max-width: 640px) 88px, (max-width: 768px) 72px, 64px"
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
