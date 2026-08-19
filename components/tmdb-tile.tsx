"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { useDiscoverTitleOverlay } from "@/components/discover-title-overlay-context";
import { posterUrl } from "@/lib/tmdb-image";
import { cn, formatYear } from "@/lib/utils";
import type { TmdbSearchResult } from "@/lib/tmdb";

interface TmdbTileProps {
  item: TmdbSearchResult;
  saved?: boolean;
  /** Rail tiles are fixed-width; grid tiles fill the cell. */
  variant?: "rail" | "grid";
  /** Match the compact poster language used by the Library shelf. */
  presentation?: "default" | "library";
}

/**
 * One TMDB result tile — poster, saved badge, title + year. Discovery
 * surfaces don't show a rating chip: the rails are about exploration, and
 * stuffing a TMDB-only number into every tile crowds the layout. Real
 * IMDb / RT / Metacritic numbers appear once the user opens the title.
 *
 * Shared by the discover rail and the "You might like" expanded grid so
 * both surfaces match pixel-for-pixel.
 */
export function TmdbTile({
  item,
  saved,
  variant = "rail",
  presentation = "default",
}: TmdbTileProps) {
  const overlay = useDiscoverTitleOverlay();
  const reactId = React.useId().replaceAll(":", "");
  const name = item.title ?? item.name ?? "Untitled";
  const date = item.release_date ?? item.first_air_date;
  const year = formatYear(date);
  const libraryPresentation = presentation === "library";
  const poster = posterUrl(
    item.poster_path,
    libraryPresentation ? "w500" : "w342",
  );
  const mediaType = item.media_type === "tv" ? "tv" : "movie";
  const anchorElementId = `discover-title-${mediaType}-${item.id}-${reactId}`;
  const active = overlay?.selectedAnchorElementId === anchorElementId;
  const dimmed = Boolean(overlay?.hasSelection && !active);
  const resolvedSaved = overlay?.isSaved(item, saved ?? false) ?? saved ?? false;

  const wrapperClass =
    libraryPresentation
      ? "group block w-full snap-start rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      : variant === "rail"
      ? "group block w-[140px] shrink-0 snap-start rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-[160px]"
      : "group block w-full rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const content = (
    <>
      <div
        data-rail-poster
        className={cn(
          "relative aspect-[2/3] overflow-hidden bg-card hairline transition-[border-color,box-shadow,transform] duration-200 ease-out hoverable:group-hover:-translate-y-1 hoverable:group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]",
          libraryPresentation
            ? [
                "rounded-[1rem] border bg-card/60 shadow-[0_24px_54px_-28px_rgba(15,23,42,0.32)] dark:shadow-[0_28px_65px_-28px_rgba(0,0,0,0.9)]",
                resolvedSaved
                  ? "border-primary/35 hoverable:group-hover:border-primary/65"
                  : "border-border hoverable:group-hover:border-foreground/35",
              ]
            : "rounded-xl",
          active &&
            "ring-2 ring-primary shadow-[0_22px_64px_-24px_hsl(var(--primary)/0.72)]",
        )}
      >
        {poster ? (
          <Image
            src={poster}
            alt={name}
            fill
            sizes={
              libraryPresentation
                ? "(max-width: 640px) 25vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
                : variant === "rail"
                  ? "160px"
                  : "(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
            }
            className="object-cover transition-transform duration-300 ease-out hoverable:group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
            {name}
          </div>
        )}

        {resolvedSaved && !libraryPresentation && (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/90 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
            <Check className="h-3 w-3" />
            Saved
          </div>
        )}
      </div>
      {libraryPresentation ? (
        <div className="mt-1.5 block px-0.5 sm:mt-2.5">
          <p className="truncate text-[10px] font-medium leading-tight text-foreground/85 sm:text-[12px]">
            {name}
          </p>
          <div
            className={cn(
              "mt-0.5 flex items-center gap-1 font-mono text-[8px] uppercase leading-tight tracking-[0.1em] sm:mt-1 sm:gap-1.5 sm:text-[9px]",
              resolvedSaved ? "text-primary/65" : "text-muted-foreground",
            )}
          >
            <span>{resolvedSaved ? "Saved" : mediaType === "tv" ? "Series" : "Film"}</span>
            {year ? (
              <span className="ml-auto text-muted-foreground/70">{year}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2 px-0.5">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          {year && (
            <p className="font-mono text-[11px] text-muted-foreground">{year}</p>
          )}
        </div>
      )}
    </>
  );

  if (overlay) {
    return (
      <button
        id={anchorElementId}
        type="button"
        aria-label={`Open ${name} details`}
        onPointerDown={() => overlay.prefetch(item)}
        onClick={() => overlay.open(item, resolvedSaved, anchorElementId)}
        className={cn(
          wrapperClass,
          "transition-[opacity,transform] duration-200",
          active && "relative z-10",
          dimmed && "opacity-[0.62]",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      id={anchorElementId}
      href={`/discover/${mediaType}/${item.id}`}
      prefetch={false}
      className={wrapperClass}
    >
      {content}
    </Link>
  );
}
