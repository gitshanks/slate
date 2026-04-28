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
import {
  Loader2,
  Film,
  Tv,
  Clock,
  Eye,
  Check,
  Library,
  Sparkles,
  Wand2,
} from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { addTitle } from "@/lib/actions";
import { RatingPair } from "@/components/rating-pair";
import { formatTmdbScore, cn } from "@/lib/utils";
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
  imdb_rating: number | null;
  rt_score: number | null;
  metacritic_score: number | null;
  status: "want" | "watching" | "watched" | "dropped";
}

interface SearchIntent {
  media_type: "movie" | "tv" | "both";
  genres: string[];
  year_min: number | null;
  year_max: number | null;
  query_text: string | null;
  sort_by: "popularity" | "rating" | "recent" | null;
  min_rating: number | null;
  interpretation: string;
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

interface ProviderProps {
  children: React.ReactNode;
  /** Set server-side from `aiSearchEnabled`. When false the AI toggle is hidden. */
  aiEnabled?: boolean;
}

export function CommandPaletteProvider({ children, aiEnabled = false }: ProviderProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [aiMode, setAiMode] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [library, setLibrary] = React.useState<LibraryHit[]>([]);
  const [intent, setIntent] = React.useState<SearchIntent | null>(null);
  const [approximate, setApproximate] = React.useState(false);
  const [approxQuery, setApproxQuery] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = React.useState<Set<string>>(new Set());
  const router = useRouter();

  // Cmd+K / Ctrl+K toggles open. Cmd+Shift+K opens straight into AI mode.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey && aiEnabled) {
          setAiMode(true);
          setOpen(true);
        } else {
          setOpen((o) => !o);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aiEnabled]);

  // Reset transient state when the palette closes — fresh open should feel fresh.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLibrary([]);
      setIntent(null);
      setSuggestions([]);
      setApproximate(false);
      setApproxQuery(null);
    }
  }, [open]);

  // Debounced search. Routes to /api/ai-search in AI mode, /api/tmdb/search otherwise.
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLibrary([]);
      setIntent(null);
      setApproximate(false);
      setApproxQuery(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    // AI mode warrants a longer debounce — it's a slower call and users
    // typing a long question shouldn't fire it on every keystroke.
    const delay = aiMode ? 600 : 300;
    const t = setTimeout(async () => {
      try {
        if (aiMode) {
          const res = await fetch("/api/ai-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed }),
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error("ai search failed");
          const data = await res.json();
          setLibrary(data.library ?? []);
          setResults(data.results ?? []);
          setIntent(data.intent ?? null);
          setApproximate(false);
          setApproxQuery(null);
        } else {
          const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(trimmed)}`, {
            signal: ctrl.signal,
          });
          const data = await res.json();
          setLibrary(data.library ?? []);
          setResults(data.results ?? []);
          setIntent(null);
          setApproximate(Boolean(data.approximate));
          setApproxQuery(data.approxQuery ?? null);
        }
      } catch {
        // Aborts and AI errors both land here; the empty state already
        // explains a missing key, and aborts are expected on every keystroke.
      } finally {
        setLoading(false);
      }
    }, delay);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, aiMode]);

  // Live suggestions — independent of search, so they keep ticking even
  // while AI search results are loading. Only fires when AI is configured.
  React.useEffect(() => {
    if (!aiEnabled) return;
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ai-suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch {
        // Abort or fetch failure — just skip this round of suggestions.
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, aiEnabled]);

  const savedTmdbIds = React.useMemo(
    () => new Set(library.map((l) => l.tmdb_id)),
    [library]
  );

  const handleSelect = React.useCallback(
    (item: SearchResult) => {
      setOpen(false);
      router.push(`/discover/${item.media_type}/${item.id}`);
    },
    [router]
  );

  const handleLibrarySelect = React.useCallback(
    (hit: LibraryHit) => {
      setOpen(false);
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
        // Swallow — badge just won't flip.
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

  const placeholder = aiMode
    ? "Ask anything — \"feel-good 90s rom-coms\", \"Nolan thrillers\"…"
    : "Search movies and TV shows…";
  const heading = aiMode
    ? approximate
      ? `AI: results for "${approxQuery}"`
      : intent
        ? `AI: ${intent.interpretation}`
        : "AI results"
    : approximate
      ? `Approximate results${approxQuery ? ` for "${approxQuery}"` : ""}`
      : "Add from TMDB";

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <div className="relative">
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          {aiEnabled && (
            <button
              type="button"
              aria-label={aiMode ? "Switch to standard search" : "Switch to AI search"}
              aria-pressed={aiMode}
              onClick={() => setAiMode((m) => !m)}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
                aiMode
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              <Sparkles className="h-3 w-3" />
              <span>{aiMode ? "AI on" : "Ask AI"}</span>
            </button>
          )}
        </div>

        {/* Suggestion chips — render between input and list when we have any. */}
        {aiEnabled && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Wand2 className="h-3 w-3" />
              Try
            </span>
            {suggestions.map((s, i) => (
              <button
                key={`${i}-${s}`}
                type="button"
                onClick={() => {
                  setAiMode(true);
                  setQuery(s);
                }}
                className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

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
              {aiMode ? (
                <>
                  Describe what you&rsquo;re in the mood for.
                  <br />
                  <span className="opacity-70">
                    e.g. <em>&ldquo;cozy autumn mysteries&rdquo;</em>,{" "}
                    <em>&ldquo;A24 horror after 2020&rdquo;</em>
                  </span>
                </>
              ) : (
                <>
                  Search your library or add from TMDB.
                  <br />
                  Press <kbd className="font-mono">↵</kbd> to open or preview.
                  {aiEnabled && (
                    <>
                      <br />
                      <span className="mt-1 inline-block opacity-70">
                        <kbd className="font-mono">⌘⇧K</kbd> for AI search
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {library.length > 0 && (
            <CommandGroup heading="Your library">
              {library.map((hit) => {
                const year = hit.release_date ? hit.release_date.slice(0, 4) : "";
                const poster = posterUrl(hit.poster_path, "w92");
                const hasRating =
                  (hit.imdb_rating != null && Number(hit.imdb_rating) > 0) ||
                  (hit.rt_score != null && Number(hit.rt_score) > 0) ||
                  (hit.metacritic_score != null && Number(hit.metacritic_score) > 0);
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
                        {hasRating && (
                          <span className="ml-1">
                            <RatingPair
                              imdb={hit.imdb_rating}
                              rt={hit.rt_score}
                              metacritic={hit.metacritic_score}
                              variant="compact"
                            />
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
            <CommandGroup heading={heading}>
              {results.map((r) => {
                const name = r.title || r.name || "Untitled";
                const date = r.release_date || r.first_air_date || "";
                const year = date ? date.slice(0, 4) : "";
                const poster = posterUrl(r.poster_path, "w92");
                const vote = formatTmdbScore(r.vote_average);
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
                        {vote && <span className="ml-1">{vote}</span>}
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
