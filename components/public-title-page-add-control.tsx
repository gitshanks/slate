"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/status-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addTitle } from "@/lib/actions";
import type { TitleStatus } from "@/lib/types";

const STATUS_OPTIONS: {
  value: Exclude<TitleStatus, "dropped">;
  label: string;
}[] = [
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

/** Add control for the standalone shared title page (`/u/:user/title/:id`). */
export function PublicTitlePageAddControl({
  tmdbId,
  mediaType,
  viewerSignedIn,
  initialSaved,
}: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  viewerSignedIn: boolean;
  initialSaved: { id: string; status: TitleStatus } | null;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(initialSaved);

  if (!viewerSignedIn) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add to your library
      </Link>
    );
  }

  if (saved) {
    return (
      <StatusPill
        titleId={saved.id}
        status={saved.status}
        onStatusChange={(status) => setSaved({ ...saved, status })}
      />
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span>{isPending ? "Adding…" : "Add to your library"}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => {
              startTransition(async () => {
                try {
                  const row = await addTitle({
                    tmdbId,
                    mediaType,
                    status: value,
                  });
                  if (!row?.id) throw new Error("Title could not be added.");
                  const nextStatus = (row.status ?? value) as TitleStatus;
                  setSaved({ id: row.id, status: nextStatus });
                  const savedLabel =
                    STATUS_OPTIONS.find(
                      (option) => option.value === nextStatus,
                    )?.label ?? label;
                  toast.success(`In ${savedLabel}`);
                } catch (error) {
                  if (
                    error instanceof Error &&
                    error.message.includes("NEXT_REDIRECT")
                  ) {
                    throw error;
                  }
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Title could not be added.",
                  );
                }
              });
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
