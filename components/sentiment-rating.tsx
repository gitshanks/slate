"use client";

import { useOptimistic, useTransition } from "react";
import { Heart, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { setRating } from "@/lib/actions";
import { toast } from "sonner";

/**
 * Love / Like / Dislike sentiment picker.
 *
 * Stored in the existing `rating` column as integers:
 *   3 = Love ❤️
 *   2 = Like 👍
 *   1 = Dislike 👎
 *   null = not yet rated
 *
 * No DB migration needed — the column is numeric(3,1).
 */

export type Sentiment = 1 | 2 | 3;

const SENTIMENTS: {
  value: Sentiment;
  icon: React.ElementType;
  label: string;
  activeClass: string;
}[] = [
  {
    value: 3,
    icon: Heart,
    label: "Love",
    activeClass: "text-rose-500 fill-rose-500",
  },
  {
    value: 2,
    icon: ThumbsUp,
    label: "Like",
    activeClass: "text-emerald-500 fill-emerald-500",
  },
  {
    value: 1,
    icon: ThumbsDown,
    label: "Dislike",
    activeClass: "text-zinc-400 fill-zinc-400",
  },
];

interface SentimentRatingProps {
  titleId: string;
  rating: number | null;
  /** If true, renders as display-only (no click handlers) */
  readOnly?: boolean;
  /** Compact icon-only mode for grid chips */
  compact?: boolean;
}

export function SentimentRating({
  titleId,
  rating,
  readOnly = false,
  compact = false,
}: SentimentRatingProps) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic<number | null, number | null>(
    rating,
    (_, next) => next
  );

  function update(value: Sentiment) {
    if (readOnly) return;
    const next = optimistic === value ? null : value;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await setRating(titleId, next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  if (compact) {
    // Single icon chip for grid cards
    const match = SENTIMENTS.find((s) => s.value === optimistic);
    if (!match) return null;
    const Icon = match.icon;
    return (
      <span className={cn("inline-flex", match.activeClass)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <div
      role={readOnly ? "img" : "group"}
      aria-label="Your sentiment"
      className="inline-flex items-center gap-1"
    >
      {SENTIMENTS.map(({ value, icon: Icon, label, activeClass }) => {
        const active = optimistic === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => update(value)}
            disabled={readOnly}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-all duration-150",
              active
                ? cn("bg-card border-transparent shadow-sm", activeClass)
                : "bg-card text-muted-foreground hover:text-foreground hover:border-border/80",
              readOnly && "cursor-default"
            )}
          >
            <Icon className={cn("h-4 w-4", active && "fill-current")} />
          </button>
        );
      })}
    </div>
  );
}
