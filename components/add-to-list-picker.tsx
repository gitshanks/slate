"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { addCatalogueTitleToList, addTitleToList } from "@/lib/actions";
import { toast } from "sonner";
import type { TitleRow } from "@/lib/supabase";
import type { TmdbMediaResult } from "@/lib/tmdb";
import { cn, formatYear } from "@/lib/utils";
import { captureAnalytics } from "@/lib/analytics";

/** A row the picker can add: from your library, or anything in the catalogue. */
type Candidate = {
  key: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  poster: string | null;
  libraryId: string | null;
};

function fromLibrary(title: TitleRow): Candidate {
  return {
    key: `${title.media_type}:${title.tmdb_id}`,
    tmdbId: title.tmdb_id,
    mediaType: title.media_type,
    title: title.title,
    year: formatYear(title.release_date),
    poster: title.poster_path,
    libraryId: title.id,
  };
}

function fromCatalogue(item: TmdbMediaResult): Candidate {
  return {
    key: `${item.media_type}:${item.id}`,
    tmdbId: item.id,
    mediaType: item.media_type,
    title: item.title || item.name || "Untitled",
    year: formatYear(item.release_date || item.first_air_date),
    poster: item.poster_path,
    libraryId: null,
  };
}

type SearchResponse = {
  results?: TmdbMediaResult[];
  personMatch?: { results?: TmdbMediaResult[] } | null;
};

export function AddToListPicker({
  listId,
  candidates,
  inList,
  defaultOpen = false,
}: {
  listId: string;
  /** Library titles not in this list yet, newest first. */
  candidates: TitleRow[];
  /** Catalogue keys (`movie:123`) already in this list. */
  inList: string[];
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const [catalogue, setCatalogue] = React.useState<Candidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState<Set<string>>(new Set());
  const changed = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const library = React.useMemo(() => candidates.map(fromLibrary), [candidates]);
  const listed = React.useMemo(() => new Set(inList), [inList]);
  const trimmed = query.trim();
  const needle = trimmed.toLocaleLowerCase();

  // The catalogue is searched once typing pauses, so a quick word is one request.
  React.useEffect(() => {
    if (trimmed.length < 2) {
      setCatalogue([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as SearchResponse;
        const items = [...(data.results ?? []), ...(data.personMatch?.results ?? [])];
        const seen = new Set<string>();
        setCatalogue(
          items.map(fromCatalogue).filter((pick) => {
            if (seen.has(pick.key)) return false;
            seen.add(pick.key);
            return true;
          }),
        );
      } catch {
        if (!controller.signal.aborted) setCatalogue([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  const libraryShown = needle
    ? library.filter((pick) => pick.title.toLocaleLowerCase().includes(needle)).slice(0, 6)
    : library.slice(0, 30);
  const libraryKeys = new Set(library.map((pick) => pick.key));
  const catalogueShown = catalogue.filter((pick) => !libraryKeys.has(pick.key));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setQuery("");
    // Show the new titles in the grid once the picker is out of the way.
    if (changed.current) {
      changed.current = false;
      router.refresh();
    }
  }

  async function add(pick: Candidate) {
    if (adding.has(pick.key) || added.has(pick.key) || listed.has(pick.key)) return;
    setAdding((current) => new Set(current).add(pick.key));
    try {
      if (pick.libraryId) await addTitleToList(listId, pick.libraryId);
      else await addCatalogueTitleToList(listId, pick.tmdbId, pick.mediaType);
      captureAnalytics("list_title_added", {
        source: "list_page",
        saved_title_first: !pick.libraryId,
      });
      changed.current = true;
      setAdded((current) => new Set(current).add(pick.key));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `"${pick.title}" couldn't be added.`);
    } finally {
      setAdding((current) => {
        const next = new Set(current);
        next.delete(pick.key);
        return next;
      });
    }
  }

  function row(pick: Candidate) {
    const done = added.has(pick.key) || listed.has(pick.key);
    const working = adding.has(pick.key);
    return (
      <button
        key={pick.key}
        type="button"
        onClick={() => void add(pick)}
        disabled={done}
        className="group/row flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted disabled:hover:bg-transparent"
      >
        <span className="h-12 w-8 shrink-0 overflow-hidden rounded-[5px] bg-muted ring-1 ring-border/60">
          {pick.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://image.tmdb.org/t/p/w92${pick.poster}`}
              alt=""
              width={32}
              height={48}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{pick.title}</span>
          <span className="block text-[11px] text-muted-foreground font-mono">
            {[pick.year, pick.mediaType === "tv" ? "Series" : "Film"].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color] duration-150",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground group-hover/row:border-primary/50 group-hover/row:text-foreground",
          )}
          aria-hidden
        >
          {working ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : done ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="sr-only">{done ? "In this list" : "Add to this list"}</span>
      </button>
    );
  }

  const heading = (text: string) => (
    <p className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
      {text}
    </p>
  );

  const addedCount = added.size;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />}>
          Add titles
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-[min(30rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border/70 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const first = [...libraryShown, ...catalogueShown].find(
                (pick) => !added.has(pick.key) && !listed.has(pick.key),
              );
              if (first) void add(first);
            }}
            placeholder="Search any film or show"
            aria-label="Search any film or show"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searching ? (
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {libraryShown.length > 0 ? (
            <>
              {heading(needle ? "In your library" : "Recently in your library")}
              {libraryShown.map(row)}
            </>
          ) : null}
          {catalogueShown.length > 0 ? (
            <>
              {heading("Everything else")}
              {catalogueShown.map(row)}
            </>
          ) : null}
          {libraryShown.length === 0 && catalogueShown.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {trimmed.length < 2
                ? "Search for any film or show to add it."
                : searching
                  ? "Searching…"
                  : `Nothing found for "${trimmed}".`}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            {addedCount > 0
              ? `${addedCount} added`
              : "Titles not in your library go into Up Next too."}
          </span>
          {addedCount > 0 ? (
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted"
            >
              Done
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
