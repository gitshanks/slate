"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Loader2, Film, Tv, Star, Clock, Eye, Check, Library } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { addTitle } from "@/lib/actions";
import type { TitleStatus } from "@/lib/supabase";

interface SearchResult {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
}

interface LibraryHit {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  release_date: string | null;
  tmdb_rating: number | null;
  status: "want" | "watching" | "watched" | "dropped";
}

interface CommandPaletteContextValue {
  open: () => void;
}

const Ctx = React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return v;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [library, setLibrary] = React.useState<LibraryHit[]>([]);
  const [approximate, setApproximate] = React.useState(false);
  const [approxQuery, setApproxQuery] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = React.useState<Set<string>>(new Set());
  const router = useRouter();

  // Cmd+K / Ctrl+K shortcut
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLibrary([]);
      setApproximate(false);
      setApproxQuery(null);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setLibrary(data.library ?? []);
        setResults(data.results ?? []);
        setApproximate(Boolean(data.approximate));
        setApproxQuery(data.approxQuery ?? null);
      } catch {
        // ignore aborts
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // tmdb_ids already in the library — used to show a "Saved" badge in the
  // TMDB section and dedupe between the two groups.
  const savedTmdbIds = React.useMemo(
    () => new Set(library.map((l) => l.tmdb_id)),
    [library]
  );

  const handleSelect = React.useCallback(
    (item: SearchResult) => {
      // Preview-before-add: navigate to the discover page where the user can
      // review TMDB details and confirm the add. Closing the palette + the
      // navigation itself is the feedback — no optimistic toast needed.
      setOpen(false);
      setQuery("");
      router.push(`/discover/${item.media_type}/${item.id}`);
    },
    [router]
  );

  const handleLibrarySelect = React.useCallback(
    (hit: LibraryHit) => {
      setOpen(false);
      setQuery("");
      router.push(`/title/${hit.id}`);
    },
    [router]
  );

  const handleQuickAdd = React.useCallback(
    async (item: SearchResult, status: TitleStatus) => {
      const key = `${item.media_type}-${item.id}`;
      if (adding.has(key) || justAdded.has(key)) return;
      setAdding((s) => new Set(s).add(key));
      try {
        await addTitle({ tmdbId: item.id, mediaType: item.media_type, status });
        setJustAdded((s) => new Set(s).add(key));
      } catch {
        // Swallow — the badge just won't flip. Next keystroke clears state.
      } finally {
        setAdding((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
    },
    [adding, justAdded]
  );

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Search movies and TV shows…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!loading && query && results.length === 0 && library.length === 0 && (
            <CommandEmpty>No results.</CommandEmpty>
          )}
          {!loading && !query && (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              Search your library or add from TMDB.
              <br />
              Press <kbd className="font-mono">↵</kbd> to open or preview.
            </div>
          )}

          {library.length > 0 && (
            <CommandGroup heading="Your library">
              {library.map((hit) => {
                const year = hit.release_date ? hit.release_date.slice(0, 4) : "";
                const poster = posterUrl(hit.poster_path, "w92");
                const vote =
                  hit.tmdb_rating != null && Number(hit.tmdb_rating) > 0
                    ? Number(hit.tmdb_rating)
                    : null;
                return (
                  <CommandItem
                    key={`lib-${hit.id}`}
                    value={`lib-${hit.id}`}
                    onSelect={() => handleLibrarySelect(hit)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleLibrarySelect(hit);
                    }}
                    className="gap-3"
                  >
                    <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                      {poster ? (
                        <Image
                          src={poster}
                          alt={hit.title}
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {hit.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono uppercase">
                        {hit.media_type === "movie" ? (
                          <Film className="h-3 w-3" />
                        ) : (
                          <Tv className="h-3 w-3" />
                        )}
                        {hit.media_type}
                        {year && <span>· {year}</span>}
                        {vote && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                            {vote.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <Library className="h-3 w-3" />
                      {hit.status}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {results.length > 0 && (
            <CommandGroup
              heading={
                approximate
                  ? `Approximate results${approxQuery ? ` for "${approxQuery}"` : ""}`
                  : "Add from TMDB"
              }
            >
              {results.map((r) => {
                const name = r.title || r.name || "Untitled";
                const date = r.release_date || r.first_air_date || "";
                const year = date ? date.slice(0, 4) : "";
                const poster = posterUrl(r.poster_path, "w92");
                const vote = r.vote_average && r.vote_average > 0 ? r.vote_average : null;
                const key = `${r.media_type}-${r.id}`;
                const isSaved = savedTmdbIds.has(r.id) || justAdded.has(key);
                const isAdding = adding.has(key);
                return (
                  <CommandItem
                    key={key}
                    value={key}
                    onSelect={() => handleSelect(r)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(r);
                    }}
                    className="gap-3"
                  >
                    <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                      {poster ? (
                        <Image src={poster} alt={name} fill className="object-cover" sizes="44px" />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono uppercase">
                        {r.media_type === "movie" ? (
                          <Film className="h-3 w-3" />
                        ) : (
                          <Tv className="h-3 w-3" />
                        )}
                        {r.media_type}
                        {year && <span>· {year}</span>}
                        {vote && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                            {vote.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                    {isSaved ? (
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-primary">
                        <Check className="h-3 w-3" />
                        Saved
                      </span>
                    ) : isAdding ? (
                      <span className="ml-auto inline-flex shrink-0 items-center">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      </span>
                    ) : (
                      <div
                        className="ml-auto inline-flex shrink-0 items-center gap-0.5"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        {([
                          { status: "want" as const, icon: Clock, label: "Want" },
                          { status: "watching" as const, icon: Eye, label: "Watching" },
                          { status: "watched" as const, icon: Check, label: "Watched" },
                        ]).map(({ status, icon: Icon, label }) => (
                          <button
                            key={status}
                            type="button"
                            aria-label={`Add as ${label}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleQuickAdd(r, status);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                          >
                            <Icon className="h-3 w-3" />
                            <span className="hidden sm:inline">{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </Ctx.Provider>
  );
}
