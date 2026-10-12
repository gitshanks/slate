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
import { updateCachedPublicTitleSavedTitle } from "@/lib/public-title-detail-cache";
import type {
  PublicSpatialSavedTitle,
  PublicSpatialTitleDetail,
} from "@/lib/public-spatial-detail-types";
import type { TitleRow, TitleStatus } from "@/lib/types";

const STATUS_OPTIONS: {
  value: Exclude<TitleStatus, "dropped">;
  label: string;
}[] = [
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

/**
 * Add control for a title discovered on someone else's shared profile.
 * The visible row belongs to the profile owner; adds and status edits always
 * apply to the viewer's own library copy (matched by tmdb id + media type).
 */
export function PublicProfileTitleActions({
  title,
  detail,
  username,
  viewerSignedIn,
}: {
  title: TitleRow;
  detail: PublicSpatialTitleDetail | null;
  username: string;
  viewerSignedIn: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [savedRecord, setSavedRecord] =
    React.useState<PublicSpatialSavedTitle | null>(null);

  const detailRecord = detail?.savedTitle ?? null;

  React.useEffect(() => {
    if (detailRecord) setSavedRecord(detailRecord);
  }, [detailRecord]);

  const record = savedRecord ?? detailRecord;
  const ownerShelfLabel =
    title.status === "watching"
      ? "Watching"
      : title.status === "watched"
        ? "Watched"
        : "Up Next";

  let viewerControl: React.ReactNode;
  if (!viewerSignedIn) {
    viewerControl = (
      <Link
        href="/login"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background/55 px-3.5 text-xs font-medium text-foreground shadow-sm transition-[background-color,border-color,transform] hover:border-primary/35 hover:bg-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        Add to library
      </Link>
    );
  } else if (record) {
    viewerControl = (
      <StatusPill
        titleId={record.id}
        status={record.status}
        onStatusChange={(status) => {
          const next = { ...record, status };
          setSavedRecord(next);
          updateCachedPublicTitleSavedTitle(username, title.id, next);
        }}
      />
    );
  } else if (!detail) {
    // Wait for the single ownership lookup so an already-saved title never gets
    // a duplicate add or a false toast.
    viewerControl = (
      <span className="inline-flex h-9 items-center rounded-full border border-border bg-background/45 px-3.5 text-xs font-medium text-muted-foreground">
        Checking library&hellip;
      </span>
    );
  } else {
    viewerControl = (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background/55 px-3.5 text-xs font-medium text-foreground shadow-sm transition-[background-color,border-color,transform] hover:border-primary/35 hover:bg-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{isPending ? "Adding…" : "Add to library"}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[80] min-w-[10rem]">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const row = await addTitle({
                      tmdbId: title.tmdb_id,
                      mediaType: title.media_type,
                      status: value,
                    });
                    if (!row?.id) throw new Error("Title could not be added.");
                    const next = {
                      id: row.id,
                      status: (row.status ?? value) as TitleStatus,
                    };
                    setSavedRecord(next);
                    updateCachedPublicTitleSavedTitle(username, title.id, next);
                    const savedLabel =
                      STATUS_OPTIONS.find(
                        (option) => option.value === next.status,
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

  return (
    <>
      <span
        title="On their slate"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground"
      >
        {ownerShelfLabel}
      </span>
      {viewerControl}
    </>
  );
}
