import Link from "next/link";
import Image from "next/image";
import { Heart, ThumbsUp, ThumbsDown } from "lucide-react";
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
  readOnly?: boolean;
  href?: string;
  onOpen?: () => void;
  compactMobile?: boolean;
  highlighted?: boolean;
  /** Public-profile shelf cards use the same visual language as Space. */
  presentation?: "default" | "profile";
  /** Hide inline quick actions when the surrounding inspector owns edits. */
  showActions?: boolean;
}

function profileStatusPresentation(status: PosterCardProps["title"]["status"]) {
  if (status === "watching") {
    return {
      label: "Watching",
      borderClass: "border-primary/80",
      hoverBorderClass: "group-hover:border-primary",
      metaClass: "text-primary",
    };
  }
  if (status === "watched") {
    return {
      label: "Watched",
      borderClass: "border-primary/35",
      hoverBorderClass: "group-hover:border-primary/65",
      metaClass: "text-primary/65",
    };
  }
  return {
    label: "Up Next",
    borderClass: "border-border",
    hoverBorderClass: "group-hover:border-foreground/35",
    metaClass: "text-muted-foreground",
  };
}

export function PosterCard({
  title,
  priority,
  dragPreview = false,
  suppressLongPressMenu = false,
  readOnly = false,
  href,
  onOpen,
  compactMobile = false,
  highlighted = false,
  presentation = "default",
  showActions = true,
}: PosterCardProps) {
  const src = posterUrl(title.poster_path, "w500");
  const year = formatYear(title.release_date);
  const imdb = formatImdbRating(title.imdb_rating);
  const rt = formatRtScore(title.rt_score);
  const mc = formatMetacriticScore(title.metacritic_score);
  const hasRating = Boolean(imdb || rt || mc);
  const genre = title.genres?.[0]?.name ?? null;
  const profilePresentation = presentation === "profile";
  const profileStatus = profilePresentation
    ? profileStatusPresentation(title.status)
    : null;

  const content = (
    <>
      <div
        data-rail-poster
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-xl",
          compactMobile && !profilePresentation && "max-[639px]:rounded-[0.65rem]",
          "bg-card hairline",
          "transition-all duration-200 ease-out",
          profilePresentation && [
            "rounded-[1rem] border bg-card/60 shadow-[0_24px_54px_-28px_rgba(15,23,42,0.32)] dark:shadow-[0_28px_65px_-28px_rgba(0,0,0,0.9)]",
            profileStatus?.borderClass,
            profileStatus?.hoverBorderClass,
          ],
          highlighted &&
            "ring-2 ring-primary/90 shadow-[0_0_0_5px_hsl(var(--primary)/0.12),0_24px_64px_-20px_hsl(var(--primary)/0.55)]",
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
              sizes={
                compactMobile
                  ? "(max-width: 640px) 25vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
                  : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
              }
              className="object-cover"
            />
          ) : (
            <Image
              src={src}
              alt={title.title}
              fill
              draggable={false}
              priority={priority}
              sizes={
                compactMobile
                  ? "(max-width: 640px) 25vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
                  : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
              }
              className="object-cover transition-transform duration-300 ease-out hoverable:group-hover:scale-[1.04]"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {title.title}
          </div>
        )}

        {profilePresentation ? (
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        ) : (
          <>
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
          </>
        )}

        {/* IMDB rating + RT score chip (top-left) — hidden on hover */}
        {!profilePresentation && hasRating && (
          <div
            className={cn(
              "absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-opacity duration-200 hoverable:group-hover:opacity-0",
              compactMobile &&
                "max-[639px]:left-1 max-[639px]:top-1 max-[639px]:px-1 max-[639px]:py-0.5 max-[639px]:text-[8px]",
            )}
          >
            <RatingPair
              imdb={title.imdb_rating}
              rt={title.rt_score}
              metacritic={title.metacritic_score}
              variant="compact"
              condenseOnNarrow={compactMobile}
            />
          </div>
        )}

        {/* Sentiment badge (bottom-right) — only when the title has a user rating */}
        {!profilePresentation && title.rating != null && (
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
        {!dragPreview && !readOnly && showActions && (
          <PosterCardActions
            titleId={title.id}
            titleName={title.title}
            currentStatus={title.status}
          />
        )}
      </div>

      {profilePresentation ? (
        <div className={cn("mt-2.5 block px-0.5", compactMobile && "mt-1.5")}>
          <p
            className={cn(
              "truncate text-[12px] font-medium text-foreground/85",
              compactMobile && "text-[10px] leading-tight",
            )}
          >
            {title.title}
          </p>
          <div
            className={cn(
              "mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em]",
              profileStatus?.metaClass,
              compactMobile && "mt-0.5 gap-1 text-[8px] leading-tight",
            )}
          >
            <span>{profileStatus?.label}</span>
            {year ? <span className="ml-auto text-muted-foreground/70">{year}</span> : null}
          </div>
        </div>
      ) : (
        /* Always-visible title under poster on mobile */
        <div
          className={cn("mt-2 px-0.5 sm:hidden", compactMobile && "mt-1.5")}
        >
          <p
            className={cn(
              "line-clamp-1 text-sm font-medium text-foreground",
              compactMobile && "text-[10px] leading-tight",
            )}
          >
            {title.title}
          </p>
          <div
            className={cn(
              "flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground",
              compactMobile && "gap-1 text-[8px] leading-tight",
            )}
          >
            {year && <span>{year}</span>}
            {genre && (
              <>
                {year && <span>·</span>}
                <span className="line-clamp-1">{genre}</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );

  const className = cn(
    "group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    suppressLongPressMenu && "suppress-touch-callout"
  );

  const targetHref = href ?? (readOnly ? null : `/title/${title.id}`);

  if (onOpen) {
    return (
      <button
        type="button"
        data-drag-card
        onClick={onOpen}
        className={cn(className, "w-full text-left")}
      >
        {content}
      </button>
    );
  }

  if (!targetHref) return <div className={className}>{content}</div>;

  return (
    <Link
      href={targetHref}
      prefetch
      draggable={false}
      onContextMenu={
        suppressLongPressMenu
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      className={className}
    >
      {content}
    </Link>
  );
}
