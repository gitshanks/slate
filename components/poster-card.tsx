import Link from "next/link";
import Image from "next/image";
import { ViewTransition } from "@/components/view-transition";
import { cn, formatYear } from "@/lib/utils";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/supabase";
import { Star } from "lucide-react";

interface PosterCardProps {
  title: Pick<
    TitleRow,
    | "id"
    | "title"
    | "poster_path"
    | "release_date"
    | "media_type"
    | "rating"
    | "tmdb_rating"
  >;
  priority?: boolean;
}

export function PosterCard({ title, priority }: PosterCardProps) {
  const src = posterUrl(title.poster_path, "w500");
  const year = formatYear(title.release_date);
  const tmdb = title.tmdb_rating != null ? Number(title.tmdb_rating) : null;

  return (
    <Link
      href={`/title/${title.id}`}
      prefetch
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl will-change-transform"
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-xl",
          "bg-card hairline",
          "transition-all duration-200 ease-out",
          "group-hover:-translate-y-1 group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]"
        )}
      >
        {src ? (
          <ViewTransition name={`poster-${title.id}`}>
            <Image
              src={src}
              alt={title.title}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
          </ViewTransition>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {title.title}
          </div>
        )}

        {/* Bottom gradient + meta on hover */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
          <p className="text-sm font-medium text-white line-clamp-2 leading-snug">
            {title.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/70 font-mono">
            <span className="uppercase tracking-wider">{title.media_type}</span>
            {year && <span>· {year}</span>}
          </div>
        </div>

        {/* Personal rating chip (top-right) */}
        {title.rating != null && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
            <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
            {Number(title.rating).toFixed(1)}
          </div>
        )}

        {/* TMDB rating chip (top-left) — hidden on hover so the meta overlay is clean */}
        {tmdb != null && tmdb > 0 && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-1 text-[11px] font-mono font-medium text-white transition-opacity duration-200 group-hover:opacity-0">
            <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
            {tmdb.toFixed(1)}
          </div>
        )}
      </div>

      {/* Always-visible title under poster on mobile, hidden on desktop where hover reveals */}
      <div className="mt-2 px-0.5 sm:hidden">
        <p className="text-xs font-medium text-foreground line-clamp-1">{title.title}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          {year && <span>{year}</span>}
          {tmdb != null && tmdb > 0 && (
            <>
              {year && <span>·</span>}
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                {tmdb.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
