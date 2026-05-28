"use client";

import * as React from "react";
import Image from "next/image";
import { ExternalLink, ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TmdbReview } from "@/lib/tmdb";

// "What people are saying" — TMDB reviews, styled after a modern comments
// thread: avatar, name + date, a rating chip, and a body clamped to a
// uniform preview height that expands inline. Each card is the same height
// when collapsed so a wall-of-text review can't dominate the section.

function resolveAvatar(path: string | null | undefined): string | null {
  if (!path) return null;
  // TMDB stores some avatars as gravatar URLs prefixed with a leading slash.
  if (path.startsWith("/http")) return path.slice(1);
  return `https://image.tmdb.org/t/p/w185${path}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TitleReviews({
  reviews,
  tmdbUrl,
}: {
  reviews: TmdbReview[];
  tmdbUrl: string;
}) {
  if (reviews.length === 0) return null;
  return (
    <div className="mt-12">
      <a
        href={tmdbUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono transition-colors hover:text-foreground"
      >
        What people are saying
        <ExternalLink className="h-3 w-3" />
      </a>

      <div className="mt-5 space-y-3">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: TmdbReview }) {
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  const [imgFailed, setImgFailed] = React.useState(false);
  const bodyRef = React.useRef<HTMLParagraphElement>(null);

  // Measure once in the collapsed state: only offer "Show more" when the
  // body actually overflows the clamp.
  React.useEffect(() => {
    const el = bodyRef.current;
    if (el) setOverflows(el.scrollHeight - el.clientHeight > 4);
  }, []);

  const rating = review.author_details?.rating ?? null;
  const avatar = resolveAvatar(review.author_details?.avatar_path);
  const showAvatar = avatar && !imgFailed;

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center gap-3">
        <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border">
          {showAvatar ? (
            <Image
              src={avatar}
              alt={review.author}
              fill
              sizes="40px"
              className="object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            initials(review.author)
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {review.author}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(review.created_at)}
          </span>
        </div>

        {rating != null && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono">
            <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
            {rating.toFixed(1)}
          </span>
        )}
      </header>

      <p
        ref={bodyRef}
        className={cn(
          "mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80",
          !expanded && "line-clamp-4"
        )}
      >
        {review.content}
      </p>

      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}
    </article>
  );
}
