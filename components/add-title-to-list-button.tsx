"use client";

import * as React from "react";
import { ListPlus, Check, Plus, LoaderCircle, Search } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  addTitleToList,
  createListAndAddTitle,
  getTitleListMemberships,
  removeTitleFromList,
} from "@/lib/actions";
import { ActionRow } from "@/components/action-row";
import { toast } from "sonner";
import { captureAnalytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface AddTitleToListButtonBaseProps {
  lists: { id: string; name: string }[];
  /** "pill" (default), "row" (mobile More sheet), or a compact icon button. */
  variant?: "pill" | "row" | "icon";
  onOpenChange?: (open: boolean) => void;
  /** Called once a catalogue title has been saved so it could join a list. */
  onTitleSaved?: (titleId: string) => void;
}

type AddTitleToListButtonProps = AddTitleToListButtonBaseProps &
  (
    | {
        titleId: string;
        /** Optional fallback when a caller can replace the title while mounted. */
        ensureTitleId?: () => Promise<string>;
      }
    | {
        /** Resolve and save a catalogue title only when the user chooses a list. */
        titleId?: undefined;
        ensureTitleId: () => Promise<string>;
      }
  );

/** A list's row for this title: which title row it holds, if any. */
type Membership = Map<string, string>;

export function AddTitleToListButton({
  titleId,
  ensureTitleId,
  lists: listsProp,
  variant = "pill",
  onOpenChange,
  onTitleSaved,
}: AddTitleToListButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // Lists made here show straight away, before the page's own list refreshes.
  const [made, setMade] = React.useState<{ id: string; name: string }[]>([]);
  const lists = React.useMemo(() => {
    const known = new Set(listsProp.map((list) => list.id));
    return [...listsProp, ...made.filter((list) => !known.has(list.id))];
  }, [listsProp, made]);
  const [membership, setMembership] = React.useState<Membership>(new Map());
  const [loaded, setLoaded] = React.useState(false);
  // Lists with a change in flight, so each row can show its own spinner.
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [creating, setCreating] = React.useState(false);
  const resolvedTitleIdRef = React.useRef<string | null>(titleId ?? null);
  const resolvingTitleIdRef = React.useRef<Promise<string> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (titleId) resolvedTitleIdRef.current = titleId;
  }, [titleId]);

  const setPopoverOpen = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
      if (nextOpen) setQuery("");
    },
    [onOpenChange],
  );

  // Which lists already hold it. A title that isn't saved can't be in any.
  React.useEffect(() => {
    if (!open) return;
    const id = resolvedTitleIdRef.current;
    if (!id) {
      setLoaded(true);
      return;
    }
    let live = true;
    getTitleListMemberships(id)
      .then((rows) => {
        if (!live) return;
        setMembership(new Map(rows.map((row) => [row.listId, row.titleId])));
      })
      .catch(() => {})
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [open]);

  async function resolveTitleId() {
    if (resolvedTitleIdRef.current) return resolvedTitleIdRef.current;
    if (!ensureTitleId) {
      throw new Error("Save this title before adding it to a list");
    }
    if (!resolvingTitleIdRef.current) {
      resolvingTitleIdRef.current = ensureTitleId()
        .then((resolvedId) => {
          if (!resolvedId) throw new Error("Could not save this title");
          resolvedTitleIdRef.current = resolvedId;
          onTitleSaved?.(resolvedId);
          return resolvedId;
        })
        .finally(() => {
          resolvingTitleIdRef.current = null;
        });
    }
    return resolvingTitleIdRef.current;
  }

  function markBusy(listId: string, on: boolean) {
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(listId);
      else next.delete(listId);
      return next;
    });
  }

  async function toggle(list: { id: string; name: string }) {
    if (busy.has(list.id)) return;
    const inList = membership.get(list.id);
    markBusy(list.id, true);
    try {
      if (inList) {
        setMembership((current) => {
          const next = new Map(current);
          next.delete(list.id);
          return next;
        });
        await removeTitleFromList(list.id, inList);
      } else {
        const id = await resolveTitleId();
        setMembership((current) => new Map(current).set(list.id, id));
        await addTitleToList(list.id, id);
        captureAnalytics("list_title_added", {
          source: "title_detail",
          saved_title_first: !titleId,
        });
      }
    } catch (e) {
      // Put the tick back the way it was.
      setMembership((current) => {
        const next = new Map(current);
        if (inList) next.set(list.id, inList);
        else next.delete(list.id);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      markBusy(list.id, false);
    }
  }

  async function create(name: string) {
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await resolveTitleId();
      const list = await createListAndAddTitle(name, id);
      captureAnalytics("list_created", { source: "title_detail", added_title: true });
      captureAnalytics("list_title_added", {
        source: "new_list",
        saved_title_first: !titleId,
      });
      setMade((current) => [...current, list]);
      setMembership((current) => new Map(current).set(list.id, id));
      setQuery("");
      toast.success(`Made "${list.name}" and added this`);
      inputRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The list couldn't be made.");
    } finally {
      setCreating(false);
    }
  }

  const trimmed = query.trim();
  const needle = trimmed.toLocaleLowerCase();
  const shown = needle
    ? lists.filter((list) => list.name.toLocaleLowerCase().includes(needle))
    : lists;
  const exact = lists.some((list) => list.name.toLocaleLowerCase() === needle);
  const canCreate = trimmed.length > 0 && !exact;
  const count = membership.size;
  const anyBusy = busy.size > 0 || creating;

  const icon = (size: string) =>
    anyBusy ? (
      <LoaderCircle className={cn(size, "animate-spin")} />
    ) : count > 0 ? (
      <Check className={cn(size, "text-primary")} />
    ) : (
      <ListPlus className={size} />
    );

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        {variant === "row" ? (
          <ActionRow
            icon={icon("h-[18px] w-[18px]")}
            label="Add to list"
            sublabel={
              count > 0
                ? `In ${count} ${count === 1 ? "list" : "lists"}`
                : lists.length > 0
                  ? `${lists.length} ${lists.length === 1 ? "list" : "lists"}`
                  : "Make your first list"
            }
            aria-busy={anyBusy}
          />
        ) : variant === "icon" ? (
          <button
            type="button"
            aria-label="Add to list"
            aria-busy={anyBusy}
            title="Add to list"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/95 text-foreground shadow-sm transition-[background-color,border-color,transform] duration-150 hover:border-primary/40 hover:bg-card active:scale-[0.97] md:bg-card/85 md:backdrop-blur-xl"
          >
            {icon("h-[18px] w-[18px]")}
          </button>
        ) : (
          <button
            type="button"
            aria-busy={anyBusy}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-[background-color,border-color,transform] duration-150 hover:border-primary/40 hover:bg-card/80 active:scale-[0.98]"
          >
            <span className="text-muted-foreground">{icon("h-3.5 w-3.5")}</span>
            {count > 0 ? `In ${count} ${count === 1 ? "list" : "lists"}` : "Add to list"}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[min(17rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border/70 px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (canCreate && shown.length === 0) void create(trimmed);
              else if (shown[0]) void toggle(shown[0]);
              else if (canCreate) void create(trimmed);
            }}
            placeholder={lists.length ? "Find or make a list" : "Name your first list"}
            aria-label="Find or make a list"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {shown.length > 0 ? (
            <div className="space-y-0.5" role="group" aria-label="Your lists">
              {shown.map((list) => {
                const inList = membership.has(list.id);
                const working = busy.has(list.id);
                return (
                  <button
                    key={list.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={inList}
                    onClick={() => void toggle(list)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      !loaded && "opacity-70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color] duration-150",
                        inList
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {working ? (
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                      ) : inList ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="truncate">{list.name}</span>
                  </button>
                );
              })}
            </div>
          ) : !canCreate ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Type a name to make your first list.
            </p>
          ) : null}

          {canCreate ? (
            <button
              type="button"
              onClick={() => void create(trimmed)}
              disabled={creating}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60",
                shown.length > 0 && "mt-1",
              )}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                {creating ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="truncate">
                Make <span className="font-medium">&ldquo;{trimmed}&rdquo;</span>
              </span>
            </button>
          ) : null}
        </div>

        {!titleId && ensureTitleId ? (
          <p className="border-t border-border/70 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
            Adding it to a list saves it to Up Next too.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
