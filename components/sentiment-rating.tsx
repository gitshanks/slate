"use client";

import { useOptimistic, useTransition } from "react";
import { Heart, ThumbsUp, ThumbsDown, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { setRating } from "@/lib/actions";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Sentiment = 1 | 2 | 3;

const SENTIMENTS: {
  value: Sentiment;
  icon: React.ElementType;
  label: string;
  activeClass: string;
}[] = [
  { value: 3, icon: Heart, label: "Love", activeClass: "text-rose-500 fill-rose-500" },
  { value: 2, icon: ThumbsUp, label: "Like", activeClass: "text-emerald-500 fill-emerald-500" },
  { value: 1, icon: ThumbsDown, label: "Dislike", activeClass: "text-zinc-400 fill-zinc-400" },
];

interface SentimentRatingProps {
  titleId: string;
  rating: number | null;
  readOnly?: boolean;
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

  function update(value: Sentiment | null) {
    if (readOnly) return;
    startTransition(async () => {
      setOptimistic(value);
      try {
        await setRating(titleId, value);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  if (compact) {
    const match = SENTIMENTS.find((s) => s.value === optimistic);
    if (!match) return null;
    const Icon = match.icon;
    return (
      <span className={cn("inline-flex", match.activeClass)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }

  const match = SENTIMENTS.find((s) => s.value === optimistic);
  const TriggerIcon = match ? match.icon : Minus;
  const triggerLabel = match ? match.label : "Rate";

  if (readOnly) {
    if (!match) return null;
    const Icon = match.icon;
    return (
      <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium", match.activeClass)}>
        <Icon className="h-3.5 w-3.5 fill-current" />
        {match.label}
      </span>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TriggerIcon className={cn("h-3.5 w-3.5", match ? cn(match.activeClass, "fill-current") : "text-muted-foreground")} />
          <span className={match ? "" : "text-muted-foreground"}>{triggerLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[9rem]">
        {SENTIMENTS.map(({ value, icon: Icon, label, activeClass }) => {
          const active = optimistic === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => update(active ? null : value)}
              className="gap-2"
            >
              <Icon className={cn("h-3.5 w-3.5", active ? cn(activeClass, "fill-current") : "text-muted-foreground")} />
              <span className={active ? "font-medium" : ""}>{label}</span>
              {active && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
          );
        })}
        {optimistic !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => update(null)} className="gap-2 text-muted-foreground">
              <Minus className="h-3.5 w-3.5" />
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
