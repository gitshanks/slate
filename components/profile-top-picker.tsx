"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { setTopTitles } from "@/lib/profile-actions";
import { TOP_TITLES_MAX } from "@/lib/profile-taste-core";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TopCandidate {
  id: string;
  title: string;
  posterPath: string | null;
  year: string | null;
  status: TitleStatus;
}

const STATUS_ORDER: Record<TitleStatus, number> = {
  watched: 0,
  watching: 1,
  want: 2,
  dropped: 3,
};

function tap() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(6);
}

/**
 * Choose the Top 4. Tapping a title drops it into the next free slot (or the
 * slot picked first); tapping two filled slots swaps them; the X empties one.
 */
export function ProfileTopPicker({
  open,
  onOpenChange,
  initial,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: string[];
  candidates: TopCandidate[];
}) {
  const router = useRouter();
  const [slots, setSlots] = React.useState<string[]>(initial);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [saving, startSaving] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setSlots(initial);
    setSelected(null);
    setQuery("");
    // Reset only when the sheet opens, not when the saved list refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const byId = React.useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );
  const shown = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return candidates
      .filter((candidate) => candidate.status !== "dropped")
      .filter((candidate) => !needle || candidate.title.toLocaleLowerCase().includes(needle))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      .slice(0, 120);
  }, [candidates, query]);

  function choose(id: string) {
    setSlots((current) => {
      const next = [...current];
      const at = next.indexOf(id);
      if (selected != null) {
        if (at !== -1) {
          // Already picked: swap it with the slot chosen first.
          [next[at], next[selected]] = [next[selected], next[at]];
        } else {
          next[selected] = id;
        }
        tap();
        return next.filter(Boolean);
      }
      if (at !== -1) return next.filter((item) => item !== id);
      if (next.length >= TOP_TITLES_MAX) {
        toast("Your Top 4 is full. Tap a slot to replace it.");
        return current;
      }
      tap();
      return [...next, id];
    });
    setSelected(null);
  }

  function pickSlot(index: number) {
    if (!slots[index]) {
      setSelected(null);
      return;
    }
    if (selected == null) {
      setSelected(index);
      return;
    }
    if (selected !== index) {
      setSlots((current) => {
        const next = [...current];
        [next[index], next[selected]] = [next[selected], next[index]];
        return next;
      });
      tap();
    }
    setSelected(null);
  }

  function remove(index: number) {
    setSlots((current) => current.filter((_, at) => at !== index));
    setSelected(null);
  }

  function save() {
    startSaving(async () => {
      const result = await setTopTitles(slots);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  const changed = slots.join() !== initial.join();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 max-sm:max-h-[calc(100dvh-1rem)]"
      >
        <div className="flex flex-col gap-1 px-5 pb-4 pr-12 pt-5">
          <DialogTitle className="text-lg font-semibold tracking-[-0.02em]">Your Top 4</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            The first one becomes your backdrop. Tap two picks to swap them.
          </DialogDescription>
        </div>

        <ol className="grid grid-cols-4 gap-2 px-5 sm:gap-3">
          {Array.from({ length: TOP_TITLES_MAX }, (_, index) => {
            const pick = slots[index] ? byId.get(slots[index]) : null;
            const src = pick ? posterUrl(pick.posterPath, "w185") : null;
            return (
              <li key={pick ? pick.id : `empty-${index}`} className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => pickSlot(index)}
                  aria-pressed={selected === index}
                  aria-label={pick ? `Number ${index + 1}: ${pick.title}` : `Number ${index + 1}, empty`}
                  className={cn(
                    "relative block aspect-[2/3] w-full overflow-hidden rounded-[10px] transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    pick
                      ? "taste-drop bg-card shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08)]"
                      : index === slots.length
                        ? "border-[1.5px] border-dashed border-primary/55 bg-primary/[0.06]"
                        : "border-[1.5px] border-dashed border-foreground/15",
                    selected === index && "-translate-y-1.5 ring-2 ring-primary",
                  )}
                >
                  {pick ? (
                    <>
                      <span className="absolute inset-x-1.5 bottom-1.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                        {pick.title}
                      </span>
                      {src ? <Image src={src} alt="" fill sizes="96px" className="object-cover" /> : null}
                    </>
                  ) : null}
                </button>
                {pick ? (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${pick.title}`}
                    className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="px-5 pb-3 pt-4">
          <label className="relative block">
            <span className="sr-only">Find a title on your slate</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a title on your slate"
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 sm:h-10 sm:text-sm"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {shown.length ? (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
              {shown.map((candidate) => {
                const picked = slots.indexOf(candidate.id);
                const src = posterUrl(candidate.posterPath, "w185");
                return (
                  <li key={candidate.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => choose(candidate.id)}
                      aria-pressed={picked !== -1}
                      aria-label={
                        picked !== -1
                          ? `${candidate.title}, number ${picked + 1}`
                          : candidate.year
                            ? `${candidate.title} (${candidate.year})`
                            : candidate.title
                      }
                      className={cn(
                        "relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-card shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08)] transition-[transform,opacity] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        picked !== -1 && "opacity-45",
                      )}
                    >
                      <span className="absolute inset-x-1.5 bottom-1.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                        {candidate.title}
                      </span>
                      {src ? <Image src={src} alt="" fill sizes="80px" className="object-cover" /> : null}
                      {picked !== -1 ? (
                        <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                          {picked + 1}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {candidates.length
                ? "Nothing on your slate matches that."
                : "Add a few titles to your slate first, then pick your favourites here."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border/70 px-5 py-4 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-11 items-center justify-center rounded-[14px] border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!changed || saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[background-color,opacity] hover:bg-primary/90 disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
