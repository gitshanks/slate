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
  ArrowUp,
} from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { addTitle } from "@/lib/actions";
import { RatingPair } from "@/components/rating-pair";
import { formatTmdbScore, cn } from "@/lib/utils";
import type { TitleStatus } from "@/lib/supabase";
import { AiChatPanel } from "@/components/ai-chat-panel";

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
  const [approximate, setApproximate] = React.useState(false);
  const [approxQuery, setApproxQuery] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = React.useState<Set<string>>(new Set());
  // Bumped each time the user hits Enter in AI mode — picked up by AiChatPanel
  // to fire the next chat turn.
  const [submitTick, setSubmitTick] = React.useState(0);
  const chatResetRef = React.useRef<(() => void) | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Mobile keyboard reliability: when the dialog opens (or AI mode toggles
  // on), iOS sometimes doesn't surface the soft keyboard because cmdk's
  // auto-focus runs after the user gesture. Explicitly focus the input on
  // open so the keyboard pops up reliably on phones.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, aiMode]);

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
  // Per product spec: chat conversation also resets every time.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLibrary([]);
      setSuggestions([]);
      setApproximate(false);
      setApproxQuery(null);
      chatResetRef.current?.();
    }
  }, [open]);

  // Standard-mode debounced search. Skipped entirely in AI mode — the chat
  // panel owns its own request flow there.
  React.useEffect(() => {
    if (aiMode) {
      setLoading(false);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLibrary([]);
      setApproximate(false);
      setApproxQuery(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setLibrary(data.library ?? []);
        setResults(data.results ?? []);
        setApproximate(Boolean(data.approximate));
        setApproxQuery(data.approxQuery ?? null);
      } catch {
        // Aborts are expected on every keystroke.
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, aiMode]);

  // Live suggestion chips for the AI empty state. Only fetched while AI mode
  // is active and there's no chat history (the panel renders chips itself).
  React.useEffect(() => {
    if (!aiEnabled || !aiMode) {
      setSuggestions([]);
      return;
    }
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
  }, [query, aiEnabled, aiMode]);

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
        // addTitle calls revalidateTag('titles', {}) on the server, but
        // that only invalidates the cache — it doesn't push fresh data
        // to the page the user is currently looking at. router.refresh()
        // re-fetches the current route's RSC payload, which now reads
        // the freshly-revalidated cache and shows the new tile without
        // requiring a hard reload. Critical on PWA where pull-to-refresh
        // is missing or unreliable.
        router.refresh();
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
    [adding, justAdded, router]
  );

  // Enter in AI mode submits the input as a chat turn instead of letting
  // cmdk navigate (which is moot anyway — there's no list to select from).
  // Blurring after submit dismisses the iOS soft keyboard so the user can
  // see the streaming response without manually tapping outside the input.
  // Desktop browsers don't show a soft keyboard so the blur is harmless
  // there — users can re-click to type a follow-up.
  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (aiMode && e.key === "Enter" && query.trim()) {
        e.preventDefault();
        e.stopPropagation();
        setSubmitTick((t) => t + 1);
        e.currentTarget.blur();
      }
    },
    [aiMode, query]
  );

  // Mobile screens are narrow; long placeholders get clipped under the
  // AI Mode pill + Send arrow buttons. Use a tight placeholder under the
  // sm breakpoint and the descriptive one above it. We pick which on the
  // client based on a media query to avoid hydration mismatch.
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const placeholder = aiMode
    ? isMobile
      ? "Ask AI…"
      : "Ask anything — \"feel-good 90s rom-coms\", \"Nolan thrillers\"…"
    : isMobile
      ? "Search…"
      : "Search movies and TV shows…";
  const heading = approximate
    ? `Approximate results${approxQuery ? ` for "${approxQuery}"` : ""}`
    : "Add from TMDB";

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        // Roomier in AI mode so the conversation has space to breathe.
        contentClassName={aiMode ? "sm:max-w-2xl" : undefined}
      >
        <div className="relative">
          <CommandInput
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleInputKeyDown}
            // iOS uses inputMode to choose the soft keyboard's action key.
            // "search" surfaces a return key labelled "go"/"search" on most
            // keyboards — better affordance than the default "return" when
            // the user clearly typed a query they want to send.
            inputMode="search"
            // Avoid the iOS Safari "smart" autocaps/autocorrect which mangles
            // titles like "Brad Pitt" → "Brad Pitt." or capitalises the
            // first letter of every chip suggestion.
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            // Reserve space for the trailing buttons so they never overlap
            // typed text. Mobile only ever shows one icon pill (~28px) at
            // right-12 → left edge ~76px → pr-20 (80px) clears it with
            // 4px buffer. Desktop in AI mode shows the labelled AI pill
            // at right-24 (~96px wide → left edge ~192px) plus the Send
            // arrow → pr-52 (208px). Desktop in search mode shows just
            // the labelled pill at right-12 (left ~144px) → pr-40 (160px).
            className={cn(
              aiMode
                ? "pr-20 sm:pr-52"
                : aiEnabled
                  ? "pr-20 sm:pr-40"
                  : "pr-10",
            )}
          />
          {aiEnabled && (
            <button
              type="button"
              aria-label={aiMode ? "Turn off AI mode" : "Turn on AI mode"}
              aria-pressed={aiMode}
              title={aiMode ? "AI mode on · ⌘⇧K" : "AI mode · ⌘⇧K"}
              onClick={() => {
                if (aiMode) {
                  // Already on — toggle off.
                  setAiMode(false);
                  return;
                }
                // Turning on. If there's text in the input already, submit it
                // as the first chat turn in the same gesture so the user
                // doesn't have to also press Enter. Empty input → just enter
                // AI mode and wait.
                setAiMode(true);
                if (query.trim()) {
                  setSubmitTick((t) => t + 1);
                  // Submitted via toggle — also dismiss the iOS keyboard.
                  inputRef.current?.blur();
                } else {
                  // Empty input → keep focus so the user can type their
                  // first chat message immediately.
                  inputRef.current?.focus();
                }
              }}
              // Sits clear of the dialog's close-X (right-4 top-4). On mobile
              // the pill collapses to an icon-only square so it doesn't crowd
              // the typed text + Send arrow. Desktop keeps the labelled pill.
              className={cn(
                "absolute top-1/2 -translate-y-1/2 inline-flex h-7 items-center justify-center rounded-md transition-colors",
                // Mobile: icon-only square. Desktop: full pill with label.
                "w-7 sm:w-auto sm:gap-1.5 sm:px-2 sm:text-[11px] sm:font-medium",
                // Position: on mobile the Send arrow is hidden (the iOS
                // keyboard's "go" key handles submit), so the AI Mode pill
                // can sit at right-12 in both modes. On desktop in AI mode
                // we shift left to leave room for the Send arrow.
                aiMode ? "right-12 sm:right-24" : "right-12",
                aiMode
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-accent"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Mode</span>
            </button>
          )}
          {aiMode && (
            // Desktop-only Send button. On mobile the iOS soft keyboard's
            // "go" key (we set inputMode="search") already submits, so the
            // arrow would just crowd the input. We hide it under the sm:
            // breakpoint and shift the AI Mode pill back to its natural
            // right-12 position there.
            <button
              type="button"
              aria-label="Send"
              title="Send (↵)"
              disabled={!query.trim()}
              onClick={() => {
                if (!query.trim()) return;
                setSubmitTick((t) => t + 1);
                // Drop focus → iOS soft keyboard dismisses, the conversation
                // panel takes the full screen instead of being squeezed
                // above the keyboard.
                inputRef.current?.blur();
              }}
              className={cn(
                "absolute right-12 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                query.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {aiMode ? (
          <AiChatPanel
            query={query}
            setQuery={setQuery}
            suggestions={suggestions}
            onClose={() => setOpen(false)}
            registerReset={(reset) => {
              chatResetRef.current = reset;
            }}
            submitTick={submitTick}
          />
        ) : (
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
                {aiEnabled && (
                  <>
                    <br />
                    <span className="mt-1 hidden sm:inline-block opacity-70">
                      <kbd className="font-mono">⌘⇧K</kbd> for AI search
                    </span>
                    {/* Mobile: kbd shortcut isn't reachable, so surface a tap target. */}
                    <button
                      type="button"
                      onClick={() => {
                        setAiMode(true);
                        inputRef.current?.focus();
                      }}
                      className="mt-2 inline-flex sm:hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground"
                    >
                      <Sparkles className="h-3 w-3" />
                      Try AI search
                    </button>
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
        )}
      </CommandDialog>
    </Ctx.Provider>
  );
}
