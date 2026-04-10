"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Eye, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TitleStatus } from "@/lib/supabase";
import { setStatus } from "@/lib/actions";
import { toast } from "sonner";

const OPTIONS: { value: TitleStatus; label: string; icon: React.ElementType }[] = [
  { value: "want", label: "Want", icon: Clock },
  { value: "watching", label: "Watching", icon: Eye },
  { value: "watched", label: "Watched", icon: Check },
];

const INDEX: Record<string, number> = {
  want: 0,
  watching: 1,
  watched: 2,
};

export function StatusPill({
  titleId,
  status,
}: {
  titleId: string;
  status: TitleStatus;
}) {
  const [, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<TitleStatus, TitleStatus>(
    status,
    (_, next) => next
  );

  function update(next: TitleStatus) {
    if (next === optimisticStatus) return;
    startTransition(async () => {
      setOptimisticStatus(next);
      try {
        await setStatus(titleId, next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  // Map out-of-band statuses ("dropped", etc.) to "no active segment".
  const activeIndex = INDEX[optimisticStatus] ?? -1;

  return (
    <div
      role="radiogroup"
      aria-label="Watch status"
      className="relative inline-flex rounded-full border border-border bg-card p-1 shadow-sm backdrop-blur"
    >
      {/* Sliding indicator */}
      {activeIndex >= 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-primary shadow-[0_6px_20px_-8px_hsl(var(--primary)/0.7)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ transform: `translateX(calc(${activeIndex} * 100%))` }}
        />
      )}

      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === optimisticStatus;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => update(value)}
            className={cn(
              "relative z-10 inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-200",
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
