import Link from "next/link";
import Image from "next/image";
import { Clock, Eye, Check, Heart, ThumbsUp, ThumbsDown } from "lucide-react";
import { ViewTransition } from "@/components/view-transition";
import { PosterCardActions } from "@/components/poster-card-actions";
import { cn, formatTmdbScore, formatYear } from "@/lib/utils";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow, TitleStatus } from "@/lib/supabase";

interface PosterCardProps {
  title: Pick<
    TitleRow,
    | "id"
    | "title"
    | "poster_path"
    | "release_date"
    | "media_type"
    | "status"
    | "tmdb_rating"
    | "rating"
  >;
  priority?: boolean;
  /** Show sentiment (loved/liked/disliked) instead of status chip */
  showSentiment?: boolean;
}

/** Map a status value → small icon element */
function StatusChip({ status }: { status: TitleStatus }) {
  if (status === "want") return <Clock className="h-3 w-3 text-white/90" />;
  if (status === "watching") return <Eye className="h-3 w-3 text-sky-300" />;
  if (status === "watched") return <Check className="h-3 w-3 text-emerald-300" />;
  return null;
}

/** Map a sentiment rating → icon + color for card chip */
function SentimentChip({ rating }: { rating: number | null }) {
  if (rating === 3)
    return <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />;
  if (rating === 2)
    return <ThumbsUp className="h-3 w-3 fill-emerald-400 text-emerald-400" />;
  if (rating === 1)
    return <ThumbsDown className="h-3 w-3 fill-zinc-400 text-zinc-400" />;
  return null;
}

export function PosterCard({ title, priority, showSentiment }: PosterCardProps) {
  const src = posterUrl(title.poster_path, "w500");
  const year = formatYear(title.release_date);
  const score = formatTmdbScore(title.tmdb_rating);

  return (
    <Link
      href={`/title/${title.id}`}
      prefetch
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-xl",
          "bg-card hairline",
          "transition-all duration-200 ease-out",
          "hoverable:group-hover:-translate-y-1 hoverable:group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]"
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
              className="object-cover transition-transform duration-300 ease-out hoverable:group-hover:scale-[1.04]"
            />
          </ViewTransition>
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

        {/* Status / sentiment chip (top-right) */}
        <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-black/70 backdrop-blur p-1.5">
          {showSentiment ? (
            <SentimentChip rating={title.rating != null ? Number(title.rating) : null} />
          ) : (
            <StatusChip status={title.status} />
          )}
        </div>

        {/* TMDB user score chip (top-left) — hidden on hover */}
        {score && (
          <div className="absolute left-2 top-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-1 text-[11px] font-mono font-medium text-white transition-opacity duration-200 hoverable:group-hover:opacity-0">
            {score}
          </div>
        )}

        {/* Quick-action strip: status + delete */}
        <PosterCardActions
          titleId={title.id}
          titleName={title.title}
          currentStatus={title.status}
        />
      </div>

      {/* Always-visible title under poster on mobile */}
      <div className="mt-2 px-0.5 sm:hidden">
        <p className="text-xs font-medium text-foreground line-clamp-1">{title.title}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          {year && <span>{year}</span>}
          {score && (
            <>
              {year && <span>·</span>}
              <span>{score}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
