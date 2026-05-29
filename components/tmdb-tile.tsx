import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { formatYear } from "@/lib/utils";
import type { TmdbSearchResult } from "@/lib/tmdb";

interface TmdbTileProps {
  item: TmdbSearchResult;
  saved?: boolean;
  /** Rail tiles are fixed-width; grid tiles fill the cell. */
  variant?: "rail" | "grid";
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
export function TmdbTile({ item, saved, variant = "rail" }: TmdbTileProps) {
  const name = item.title ?? item.name ?? "Untitled";
  const date = item.release_date ?? item.first_air_date;
  const year = formatYear(date);
  const poster = posterUrl(item.poster_path, "w342");
  const mediaType = item.media_type === "tv" ? "tv" : "movie";

  const wrapperClass =
    variant === "rail"
      ? "group block w-[140px] shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl sm:w-[160px]"
      : "group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl";

  return (
    <Link href={`/discover/${mediaType}/${item.id}`} prefetch={false} className={wrapperClass}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-card hairline transition-all duration-200 ease-out hoverable:group-hover:-translate-y-1 hoverable:group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]">
        {poster ? (
          <Image
            src={poster}
            alt={name}
            fill
            sizes={variant === "rail" ? "160px" : "(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"}
            className="object-cover transition-transform duration-300 ease-out hoverable:group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
            {name}
          </div>
        )}

        {saved && (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            <Check className="h-3 w-3" />
            Saved
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {year && (
          <p className="text-[11px] text-muted-foreground font-mono">{year}</p>
        )}
      </div>
    </Link>
  );
}
