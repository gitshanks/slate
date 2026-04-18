"use client";

import * as React from "react";
import { ListPlus, Check } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { addTitleToList } from "@/lib/actions";
import { toast } from "sonner";

interface AddTitleToListButtonProps {
  titleId: string;
  lists: { id: string; name: string }[];
}

export function AddTitleToListButton({ titleId, lists }: AddTitleToListButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [added, setAdded] = React.useState<Set<string>>(new Set());

  if (lists.length === 0) return null;

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
        >
          <ListPlus className="h-3.5 w-3.5 text-muted-foreground" />
          Add to list
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start">
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
      </PopoverContent>
    </Popover>
  );
}
