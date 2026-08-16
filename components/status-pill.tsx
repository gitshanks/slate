"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Eye, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TitleStatus } from "@/lib/supabase";
import { setStatus } from "@/lib/actions";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: TitleStatus; label: string; icon: React.ElementType }[] = [
  { value: "want", label: "Up Next", icon: Clock },
  { value: "watching", label: "Watching", icon: Eye },
  { value: "watched", label: "Watched", icon: Check },
];

export function StatusPill({
  titleId,
  status,
  onStatusChange,
}: {
  titleId: string;
  status: TitleStatus;
  onStatusChange?: (status: TitleStatus) => void;
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
        onStatusChange?.(next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const active = OPTIONS.find((o) => o.value === optimisticStatus) ?? OPTIONS[0];
  const Icon = active.icon;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{active.label}</span>
          <ChevronDown className="h-3 w-3 text-primary/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[9rem]">
        <DropdownMenuRadioGroup
          value={optimisticStatus}
          onValueChange={(v) => update(v as TitleStatus)}
        >
          {OPTIONS.map(({ value, label, icon: Opt }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className={cn(
                "gap-2 pl-8",
                value === optimisticStatus && "text-foreground"
              )}
            >
              <Opt className="h-3.5 w-3.5" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
