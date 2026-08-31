"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDown } from "lucide-react";
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

const OPTIONS: { value: TitleStatus; label: string }[] = [
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
  { value: "dropped", label: "Dropped" },
];

export function StatusPill({
  titleId,
  status,
  onStatusChange,
  onOpenChange,
}: {
  titleId: string;
  status: TitleStatus;
  onStatusChange?: (status: TitleStatus) => void;
  onOpenChange?: (open: boolean) => void;
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

  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{active.label}</span>
          <ChevronDown className="h-3 w-3 text-primary/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[9rem]">
        <DropdownMenuRadioGroup
          value={optimisticStatus}
          onValueChange={(v) => update(v as TitleStatus)}
        >
          {OPTIONS.map(({ value, label }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className={cn(
                "pl-8",
                value === optimisticStatus && "text-foreground"
              )}
            >
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
