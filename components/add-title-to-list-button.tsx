"use client";

import * as React from "react";
import { ListPlus, Check, Plus, ArrowLeft, LoaderCircle } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { addTitleToList, createListAndAddTitle } from "@/lib/actions";
import { ActionRow } from "@/components/action-row";
import { toast } from "sonner";

interface AddTitleToListButtonBaseProps {
  lists: { id: string; name: string }[];
  /** "pill" (default), "row" (mobile More sheet), or a compact icon button. */
  variant?: "pill" | "row" | "icon";
  onOpenChange?: (open: boolean) => void;
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

export function AddTitleToListButton({
  titleId,
  ensureTitleId,
  lists,
  variant = "pill",
  onOpenChange,
}: AddTitleToListButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const resolvedTitleIdRef = React.useRef<string | null>(titleId ?? null);
  const resolvingTitleIdRef = React.useRef<Promise<string> | null>(null);
  // Tracks lists the title has been added to in this popover session so we can
  // show a check next to them. Also includes freshly created lists.
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  // When true the popover body swaps to the create-list input. If there are no
  // existing lists, we start in create mode so the popover doesn't open empty.
  const [creating, setCreating] = React.useState(lists.length === 0);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const setPopoverOpen = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    if (titleId) resolvedTitleIdRef.current = titleId;
  }, [titleId]);

  // Reset creating-state when the popover reopens so the default view matches
  // the user's current list count.
  React.useEffect(() => {
    if (open) {
      setCreating(lists.length === 0);
      setDraft("");
    }
  }, [open, lists.length]);

  // Autofocus the input whenever we enter create mode. We use a short
  // timeout because Radix's FocusScope may steal focus back to the popover
  // root when a focused child (the "Create new list…" button) unmounts.
  React.useEffect(() => {
    if (open && creating) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open, creating]);

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
          return resolvedId;
        })
        .finally(() => {
          resolvingTitleIdRef.current = null;
        });
    }

    return resolvingTitleIdRef.current;
  }

  function add(listId: string, listName: string) {
    start(async () => {
      try {
        const resolvedTitleId = await resolveTitleId();
        await addTitleToList(listId, resolvedTitleId);
        setAdded((prev) => new Set([...prev, listId]));
        toast.success(`Added to "${listName}"`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function create() {
    const name = draft.trim();
    if (!name) return;
    start(async () => {
      try {
        const resolvedTitleId = await resolveTitleId();
        const list = await createListAndAddTitle(name, resolvedTitleId);
        setAdded((prev) => new Set([...prev, list.id]));
        toast.success(`Created "${list.name}" and added title`);
        setDraft("");
        setCreating(false);
        setPopoverOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const hasLists = lists.length > 0;

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        {variant === "row" ? (
          <ActionRow
            icon={
              pending ? (
                <LoaderCircle className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <ListPlus className="h-[18px] w-[18px]" />
              )
            }
            label="Add to list"
            sublabel={
              lists.length > 0
                ? `${lists.length} ${lists.length === 1 ? "list" : "lists"}`
                : "Create your first list"
            }
            disabled={pending}
            aria-busy={pending}
          />
        ) : variant === "icon" ? (
          <button
            type="button"
            disabled={pending}
            aria-label="Add to list"
            aria-busy={pending}
            title="Add to list"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/95 text-foreground shadow-sm transition-[background-color,border-color,transform] duration-150 hover:border-primary/40 hover:bg-card active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 md:bg-card/85 md:backdrop-blur-xl"
          >
            {pending ? (
              <LoaderCircle className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <ListPlus className="h-[18px] w-[18px]" />
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
          >
            {pending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <ListPlus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            Add to list
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[min(22rem,var(--radix-popover-content-available-height))] w-60 overflow-y-auto p-1.5"
        align="start"
        aria-busy={pending}
      >
        {!titleId && ensureTitleId ? (
          <p className="mx-1 mb-1.5 rounded-lg bg-muted/70 px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">
            Adding to a list also saves this title to Up Next.
          </p>
        ) : null}
        {creating ? (
          <div className="p-1">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              {hasLists && (
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={pending}
                  aria-label="Back to list picker"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                New list
              </p>
            </div>
            <input
              ref={inputRef}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                } else if (e.key === "Escape" && hasLists) {
                  e.preventDefault();
                  setCreating(false);
                }
              }}
              placeholder="List name"
              disabled={pending}
              className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground disabled:opacity-60"
            />
            <button
              type="button"
              onClick={create}
              disabled={pending || !draft.trim()}
              className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Create and add
            </button>
          </div>
        ) : (
          <>
            <p className="mb-1 px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
              Your lists
            </p>
            <div className="space-y-0.5">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  disabled={pending || added.has(list.id)}
                  onClick={() => add(list.id, list.name)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {added.has(list.id) ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <div className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{list.name}</span>
                </button>
              ))}
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Create new list…</span>
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
