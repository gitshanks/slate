"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { profileUrl } from "@/lib/tmdb-image";

export interface PersonTile {
  id: number;
  name: string;
  /** Character (cast) or role (crew). */
  subtitle?: string | null;
  profilePath: string | null;
}

/**
 * Wrapped grid of people (cast or crew) — square photo tiles, each linking
 * to the person's profile. The whole set fits on the page without
 * horizontal scrolling.
 *
 * Columns auto-fill by tile width, but we nudge the count down by one
 * whenever the last row would otherwise hold a single orphan — so wide
 * screens never leave one lonely person stranded on their own line. No one
 * is dropped; the row just rebalances.
 */
export function PeopleGrid({
  title,
  people,
}: {
  title: string;
  people: PersonTile[];
}) {
  const gridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = gridRef.current;
    if (!el || people.length === 0) return;

    let lastWidth = -1;
    const adjust = () => {
      const width = el.clientWidth;
      if (width === lastWidth) return; // ignore the height change our own fix causes
      lastWidth = width;

      // Restore the responsive auto-fill, then read how many columns it
      // resolves to at this width.
      el.style.gridTemplateColumns = "";
      const natural = getComputedStyle(el).gridTemplateColumns.split(" ").length;

      let cols = natural;
      while (cols > 1 && people.length > cols && people.length % cols === 1) {
        cols--;
      }
      if (cols < natural) {
        el.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      }
    };

    adjust();
    const ro = new ResizeObserver(adjust);
    ro.observe(el);
    return () => ro.disconnect();
  }, [people.length]);

  if (!people.length) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </h2>

      <div
        ref={gridRef}
        className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-4 gap-y-6"
      >
        {people.map((person, i) => {
          const photo = profileUrl(person.profilePath, "w185");
          const initials = person.name
            .split(" ")
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <Link
              key={`${person.id}-${i}`}
              href={`/person/${person.id}`}
              className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hoverable:group-hover:border-primary/50 hoverable:group-hover:shadow-md">
                {photo ? (
                  <Image
                    src={photo}
                    alt={person.name}
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
              <p className="mt-2 truncate text-[11px] font-medium text-foreground transition-colors hoverable:group-hover:text-primary">
                {person.name}
              </p>
              {person.subtitle && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {person.subtitle}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
