import Link from "next/link";
import Image from "next/image";
import { Heart, ThumbsUp, ThumbsDown } from "lucide-react";
import { ViewTransition } from "@/components/view-transition";
import { PosterCardActions } from "@/components/poster-card-actions";
import { RatingPair } from "@/components/rating-pair";
import {
  cn,
  formatImdbRating,
  formatMetacriticScore,
  formatRtScore,
  formatYear,
} from "@/lib/utils";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/supabase";

interface PosterCardProps {
  title: Pick<
    TitleRow,
    | "id"
    | "title"
    | "poster_path"
    | "release_date"
    | "media_type"
    | "status"
    | "imdb_rating"
    | "rt_score"
    | "metacritic_score"
    | "genres"
    | "rating"
  >;
  priority?: boolean;
  dragPreview?: boolean;
  suppressLongPressMenu?: boolean;
}

export function PosterCard({
  title,
  priority,
  dragPreview = false,
  suppressLongPressMenu = false,
}: PosterCardProps) {
  const src = posterUrl(title.poster_path, "w500");
  const year = formatYear(title.release_date);
  const imdb = formatImdbRating(title.imdb_rating);
  const rt = formatRtScore(title.rt_score);
  const mc = formatMetacriticScore(title.metacritic_score);
  const hasRating = Boolean(imdb || rt || mc);
  const genre = title.genres?.[0]?.name ?? null;

  return (
    <Link
      href={`/title/${title.id}`}
      prefetch
      draggable={false}
      onContextMenu={
        suppressLongPressMenu
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      className={cn(
        "group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        suppressLongPressMenu &&
          "suppress-touch-callout"
      )}
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-xl",
          "bg-card hairline",
          "transition-all duration-200 ease-out",
          dragPreview &&
            "ring-1 ring-black/10 shadow-[0_22px_56px_-18px_rgba(0,0,0,0.85)] dark:ring-white/15",
          "hoverable:group-hover:-translate-y-1 hoverable:group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]"
        )}
      >
        {src ? (
          dragPreview ? (
            <Image
              src={src}
              alt=""
              fill
              draggable={false}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
              className="object-cover"
            />
          ) : (
            <ViewTransition name={`poster-${title.id}`}>
              <Image
                src={src}
                alt={title.title}
                fill
                draggable={false}
                priority={priority}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
                className="object-cover transition-transform duration-300 ease-out hoverable:group-hover:scale-[1.04]"
              />
            </ViewTransition>
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {title.title}
          </div>
        )}

        {/* Bottom gradient + title meta on hover (pointer devices only) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 transition-opacity duration-200 hoverable:group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pb-12 opacity-0 translate-y-1 transition-all duration-200 hoverable:group-hover:opacity-100 hoverable:group-hover:translate-y-0">
          <p className="text-sm font-medium text-white line-clamp-2 leading-snug">
            {title.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/70 font-mono">
            <span className="uppercase tracking-wider">{title.media_type}</span>
            {year && <span>· {year}</span>}
          </div>
        </div>

        {/* IMDB rating + RT score chip (top-left) — hidden on hover */}
        {hasRating && (
          <div className="absolute left-2 top-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-1 text-[11px] font-medium text-white transition-opacity duration-200 hoverable:group-hover:opacity-0">
            <RatingPair
              imdb={title.imdb_rating}
              rt={title.rt_score}
              metacritic={title.metacritic_score}
              variant="compact"
            />
          </div>
        )}

        {/* Sentiment badge (bottom-right) — only when the title has a user rating */}
        {title.rating != null && (
          <div
            className="absolute bottom-2 right-2 rounded-full bg-black/55 backdrop-blur-sm p-1.5"
            aria-label={
              title.rating === 3 ? "Loved" : title.rating === 2 ? "Liked" : "Disliked"
            }
          >
            {title.rating === 3 && (
              <Heart className="h-3.5 w-3.5 fill-current text-rose-400" aria-hidden />
            )}
            {title.rating === 2 && (
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            )}
            {title.rating === 1 && (
              <ThumbsDown className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            )}
          </div>
        )}

        {/* Quick-action strip: status + delete */}
        {!dragPreview && (
          <PosterCardActions
            titleId={title.id}
            titleName={title.title}
            currentStatus={title.status}
          />
        )}
      </div>

      {/* Always-visible title under poster on mobile */}
      <div className="mt-2 px-0.5 sm:hidden">
        <p className="text-sm font-medium text-foreground line-clamp-1">{title.title}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          {year && <span>{year}</span>}
          {genre && (
            <>
              {year && <span>·</span>}
              <span className="line-clamp-1">{genre}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
