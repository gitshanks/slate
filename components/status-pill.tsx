"use client";

import { useTransition } from "react";
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
  const [pending, start] = useTransition();

  function update(next: TitleStatus) {
    if (next === status || pending) return;
    start(async () => {
      try {
        await setStatus(titleId, next);
        toast.success(`Marked as ${next}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-border bg-card p-1 text-xs",
        pending && "opacity-60"
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === status;
        return (
          <button
            key={value}
            type="button"
            disabled={pending}
            onClick={() => update(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
              active
                ? "bg-primary text-primary-foreground"
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
