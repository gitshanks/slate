"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Eye, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TitleStatus } from "@/lib/supabase";
import { setStatus } from "@/lib/actions";
import { toast } from "sonner";

const OPTIONS: { value: TitleStatus; label: string; icon: React.ElementType }[] = [
  { value: "want", label: "Want", icon: Clock },
  { value: "watching", label: "Watching", icon: Eye },
  { value: "watched", label: "Watched", icon: Check },
  { value: "dropped", label: "Dropped", icon: X },
];

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

  return (
    <div className="inline-flex flex-wrap rounded-full border border-border bg-card p-1 text-xs">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === optimisticStatus;
        return (
          <button
            key={value}
            type="button"
            onClick={() => update(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-150",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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
