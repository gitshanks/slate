"use client";

import { useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addTitleWithStatus } from "@/lib/actions";
import type { TitleStatus } from "@/lib/supabase";

const OPTIONS: { value: TitleStatus; label: string }[] = [
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

interface AddStatusDropdownProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

/**
 * Blank status dropdown for the discover page. Visually matches the
 * StatusPill / SentimentRating unset state — muted chevron pill with no
 * active selection. Picking a status adds the title to the library and
 * navigates to the title detail page.
 */
export function AddStatusDropdown({ tmdbId, mediaType }: AddStatusDropdownProps) {
  const [isPending, startTransition] = useTransition();

  function add(status: TitleStatus) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tmdbId", String(tmdbId));
      fd.set("mediaType", mediaType);
      fd.set("status", status);
      await addTitleWithStatus(fd);
    });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Add to library</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[9rem]">
        {OPTIONS.map(({ value, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => add(value)}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
