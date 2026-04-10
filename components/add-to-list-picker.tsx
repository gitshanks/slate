"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { addTitleToList } from "@/lib/actions";
import { toast } from "sonner";
import type { TitleRow } from "@/lib/supabase";
import { formatYear } from "@/lib/utils";

export function AddToListPicker({
  listId,
  candidates,
}: {
  listId: string;
  candidates: TitleRow[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  function add(titleId: string, name: string) {
    start(async () => {
      try {
        await addTitleToList(listId, titleId);
        toast.success(`Added "${name}"`);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Your library is empty — add titles via ⌘K first.
      </p>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />}>
          Add from library
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search your library…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {candidates.map((t) => {
                const year = formatYear(t.release_date);
                return (
                  <CommandItem
                    key={t.id}
                    value={`${t.title} ${year}`}
                    disabled={pending}
                    onSelect={() => add(t.id, t.title)}
                    className="text-sm"
                  >
                    <span className="truncate">{t.title}</span>
                    {year && (
                      <span className="ml-auto text-[11px] text-muted-foreground font-mono">
                        {year}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
