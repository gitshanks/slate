"use client";

import * as React from "react";
import { ListPlus, Check, Plus, ArrowLeft } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { addTitleToList, createListAndAddTitle } from "@/lib/actions";
import { toast } from "sonner";

interface AddTitleToListButtonProps {
  titleId: string;
  lists: { id: string; name: string }[];
}

export function AddTitleToListButton({ titleId, lists }: AddTitleToListButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  // Tracks lists the title has been added to in this popover session so we can
  // show a check next to them. Also includes freshly created lists.
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  // When true the popover body swaps to the create-list input. If there are no
  // existing lists, we start in create mode so the popover doesn't open empty.
  const [creating, setCreating] = React.useState(lists.length === 0);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

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

  function add(listId: string, listName: string) {
    start(async () => {
      try {
        await addTitleToList(listId, titleId);
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
        const list = await createListAndAddTitle(name, titleId);
        setAdded((prev) => new Set([...prev, list.id]));
        toast.success(`Created "${list.name}" and added title`);
        setDraft("");
        setCreating(false);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const hasLists = lists.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
        >
          <ListPlus className="h-3.5 w-3.5 text-muted-foreground" />
          Add to list
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5" align="start">
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
