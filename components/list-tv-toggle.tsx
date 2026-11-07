"use client";

import * as React from "react";
import { Tv } from "lucide-react";
import { toast } from "sonner";
import { setListOnTv } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Whether this list shows as a rail on your Slate TV's Home. A switch, so the
 * state reads at a glance; it changes only your own TV, not anyone you share with.
 */
export function ListTvToggle({ listId, onTv }: { listId: string; onTv: boolean }) {
  const [shown, setShown] = React.useState(onTv);
  const [pending, start] = React.useTransition();

  React.useEffect(() => setShown(onTv), [onTv]);

  function toggle() {
    const next = !shown;
    setShown(next);
    start(async () => {
      try {
        await setListOnTv(listId, next);
      } catch (error) {
        setShown(!next);
        toast.error(error instanceof Error ? error.message : "That didn't save. Try again.");
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-busy={pending}
      onClick={toggle}
      title={shown ? "Showing on your TV's Home" : "Not on your TV"}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card pl-3 pr-1.5 text-xs font-medium transition-[background-color,border-color,transform] duration-150 hover:border-primary/40 active:scale-[0.98]"
    >
      <Tv className={cn("h-3.5 w-3.5 transition-colors", shown ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span>Show on TV</span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
          shown ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full bg-background shadow-sm transition-transform duration-200 ease-out",
            shown ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
