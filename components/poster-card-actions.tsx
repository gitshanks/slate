"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Clock, Eye, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { removeTitle, setStatus } from "@/lib/actions";
import type { TitleStatus } from "@/lib/supabase";
import { toast } from "sonner";

const STATUS_OPTIONS: {
  value: TitleStatus;
  icon: React.ElementType;
  label: string;
  activeClass: string;
}[] = [
  { value: "want", icon: Clock, label: "Want to watch", activeClass: "text-white" },
  { value: "watching", icon: Eye, label: "Watching", activeClass: "text-sky-300" },
  { value: "watched", icon: Check, label: "Watched", activeClass: "text-emerald-300" },
];

interface PosterCardActionsProps {
  titleId: string;
  titleName: string;
  currentStatus: TitleStatus;
}

export function PosterCardActions({
  titleId,
  titleName,
  currentStatus,
}: PosterCardActionsProps) {
  const [deletePending, startDelete] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic<
    TitleStatus,
    TitleStatus
  >(currentStatus, (_, next) => next);
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

  function handleStatus(e: React.MouseEvent, value: TitleStatus) {
    e.preventDefault();
    e.stopPropagation();
    if (value === optimisticStatus) return;
    startStatus(async () => {
      setOptimisticStatus(value);
      try {
        await setStatus(titleId, value);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const isPending = deletePending || statusPending;

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
      {/* Status quick-actions */}
      <div className="flex items-center gap-1">
        {STATUS_OPTIONS.map(({ value, icon: Icon, label, activeClass }) => {
          const active = optimisticStatus === value;
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              title={label}
              onClick={(e) => handleStatus(e, value)}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                active ? activeClass : "text-white/60 hover:text-white"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
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
