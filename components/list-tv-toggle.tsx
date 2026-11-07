"use client";

import * as React from "react";
import { Check, Tv } from "lucide-react";
import { toast } from "sonner";
import { setListOnTv } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Whether this list shows as a rail on your Slate TV's Home. A pressable chip the same
 * size as the actions beside it: lit with a check while the list is on your TV, outlined
 * when it isn't. It changes only your own TV, not anyone you share the list with.
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
        toast.success(next ? "Showing on your TV's Home" : "Hidden from your TV");
      } catch (error) {
        setShown(!next);
        toast.error(error instanceof Error ? error.message : "That didn't save. Try again.");
      }
    });
  }

  return (
    <button
      type="button"
      aria-pressed={shown}
      aria-busy={pending}
      onClick={toggle}
      title={shown ? "Shown on your TV's Home. Press to hide it there." : "Not on your TV. Press to show it on Home."}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        shown
          ? "border-primary/35 bg-primary/12 text-primary hover:bg-primary/18"
          : "border-border bg-background/85 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <span className="relative grid h-3.5 w-3.5 place-items-center" aria-hidden>
        <Tv className={cn("absolute h-3.5 w-3.5 transition-[opacity,transform] duration-200 motion-reduce:transition-none", shown ? "scale-75 opacity-0" : "opacity-100")} />
        <Check className={cn("absolute h-3.5 w-3.5 transition-[opacity,transform] duration-200 motion-reduce:transition-none", shown ? "opacity-100" : "scale-75 opacity-0")} />
      </span>
      <span>{shown ? "On TV" : "Not on TV"}</span>
    </button>
  );
}
