"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Heart, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { removeTitle, setRating } from "@/lib/actions";
import { toast } from "sonner";

type Sentiment = 1 | 2 | 3;

const SENTIMENTS: {
  value: Sentiment;
  icon: React.ElementType;
  label: string;
  activeClass: string;
}[] = [
  { value: 3, icon: Heart, label: "Love", activeClass: "text-rose-400 fill-rose-400" },
  { value: 2, icon: ThumbsUp, label: "Like", activeClass: "text-emerald-400 fill-emerald-400" },
  { value: 1, icon: ThumbsDown, label: "Dislike", activeClass: "text-zinc-400 fill-zinc-400" },
];

interface PosterCardActionsProps {
  titleId: string;
  titleName: string;
  currentRating: number | null;
}

export function PosterCardActions({
  titleId,
  titleName,
  currentRating,
}: PosterCardActionsProps) {
  const [deletePending, startDelete] = useTransition();
  const [ratingPending, startRating] = useTransition();
  const router = useRouter();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Remove "${titleName}" from your library?`)) return;
    startDelete(async () => {
      try {
        await removeTitle(titleId);
        toast.success("Removed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function handleRating(e: React.MouseEvent, value: Sentiment) {
    e.preventDefault();
    e.stopPropagation();
    const next = currentRating === value ? null : value;
    startRating(async () => {
      try {
        await setRating(titleId, next);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const isPending = deletePending || ratingPending;

  return (
    // Visible on mobile always (small icons); revealed on hover on desktop
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-2 py-2",
        "bg-gradient-to-t from-black/80 via-black/50 to-transparent",
        // Desktop: hidden until hover
        "opacity-0 translate-y-1 transition-all duration-200",
        "hoverable:group-hover:opacity-100 hoverable:group-hover:translate-y-0",
        // Mobile: always visible
        "max-[767px]:opacity-100 max-[767px]:translate-y-0",
        isPending && "pointer-events-none opacity-50"
      )}
      onClick={(e) => e.preventDefault()}
    >
      {/* Sentiment buttons */}
      <div className="flex items-center gap-1">
        {SENTIMENTS.map(({ value, icon: Icon, label, activeClass }) => {
          const active = currentRating === value;
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              onClick={(e) => handleRating(e, value)}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                active
                  ? activeClass
                  : "text-white/60 hover:text-white"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active && "fill-current")} />
            </button>
          );
        })}
      </div>

      {/* Delete */}
      <button
        type="button"
        aria-label={`Remove ${titleName}`}
        onClick={handleDelete}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
