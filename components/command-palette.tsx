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
  Check,
  Library,
  Sparkles,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Plus,
  Mic,
  Search,
} from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { addTitle } from "@/lib/actions";
import { RatingPair } from "@/components/rating-pair";
import { formatTmdbScore, cn } from "@/lib/utils";
import type { TitleStatus } from "@/lib/supabase";
import { AiChatPanel } from "@/components/ai-chat-panel";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface PersonMatch {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
  results: SearchResult[];
}

interface SavedTitleHit {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  status: "want" | "watching" | "watched" | "dropped";
}

interface LibrarySelection {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
}

interface SmartSearchOpenOptions {
  initialQuery?: string;
  mode?: "search" | "ask";
  submit?: boolean;
  onLibrarySelect?: (selection: LibrarySelection) => void;
}

interface CommandPaletteContextValue {
  open: () => void;
  openWith: (options: SmartSearchOpenOptions) => void;
  aiEnabled: boolean;
}

const Ctx = React.createContext<CommandPaletteContextValue | null>(null);

const ADD_STATUSES: { value: TitleStatus; label: string }[] = [
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

function statusLabel(status: TitleStatus) {
  return ADD_STATUSES.find((option) => option.value === status)?.label ?? "Saved";
}

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
  const [askReturnQuery, setAskReturnQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [library, setLibrary] = React.useState<LibraryHit[]>([]);
  const [personMatch, setPersonMatch] = React.useState<PersonMatch | null>(null);
  const [saved, setSaved] = React.useState<Record<string, SavedTitleHit>>({});
  const [approximate, setApproximate] = React.useState(false);
  const [approxQuery, setApproxQuery] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = React.useState<Set<string>>(new Set());
  // Bumped each time the user submits an Ask — picked up by AiChatPanel
  // to fire the next chat turn.
  const [submitTick, setSubmitTick] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const standardSearchRequestRef = React.useRef(0);
  const skipAutoFocusRef = React.useRef(false);
  const librarySelectionRef = React.useRef<
    ((selection: LibrarySelection) => void) | null
  >(null);
  const router = useRouter();

  const openPalette = React.useCallback(() => {
    librarySelectionRef.current = null;
    skipAutoFocusRef.current = false;
    setAiMode(false);
    setAskReturnQuery("");
    setOpen(true);
  }, []);

  const openWith = React.useCallback((options: SmartSearchOpenOptions) => {
    const initialQuery = options.initialQuery?.trim() ?? "";
    librarySelectionRef.current = options.onLibrarySelect ?? null;
    skipAutoFocusRef.current = Boolean(
      options.mode === "ask" && options.submit && initialQuery,
    );
    setQuery(initialQuery);
    setAskReturnQuery(options.mode === "ask" ? initialQuery : "");
    setAiMode(options.mode === "ask");
    setOpen(true);
    if (options.mode === "ask" && options.submit && initialQuery) {
      setSubmitTick((tick) => tick + 1);
    }
  }, []);

  // Voice search (standard mode). Dictation fills the box and stops; the user
  // reviews and presses Enter. Hidden entirely when unsupported.
  const { supported: voiceSupported, listening, toggle: toggleVoice } =
    useSpeechRecognition({
      onResult: (transcript) => setQuery(transcript),
      onEnd: () => inputRef.current?.focus(),
    });

  // Open the full, browsable results page for the current query. Driven by the
  // "Search all results" row (which cmdk auto-highlights), so a bare
  // type-then-Enter lands here instead of opening result #1.
  const handleSearchAll = React.useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }, [query, router]);

  // Mobile keyboard reliability: when the dialog opens (or Ask opens), iOS
  // sometimes doesn't surface the soft keyboard because cmdk's
  // auto-focus runs after the user gesture. Explicitly focus the input on
  // open so the keyboard pops up reliably on phones.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      if (skipAutoFocusRef.current) {
        inputRef.current?.blur();
        skipAutoFocusRef.current = false;
      } else {
        inputRef.current?.focus();
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, aiMode]);

  // Cmd+K / Ctrl+K toggles open. Cmd+Shift+K opens straight into Ask.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey && aiEnabled) {
          setAskReturnQuery(query.trim());
          setAiMode(true);
          setOpen(true);
        } else {
          setOpen((o) => !o);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aiEnabled, query]);

  // Reset transient *search* state when the palette closes — fresh open feels
  // fresh. The AI conversation deliberately persists (it lives in the shared
  // provider) so it survives close and the modal → /discover page hop.
  React.useEffect(() => {
    if (!open) {
      skipAutoFocusRef.current = false;
      setQuery("");
      setResults([]);
      setLibrary([]);
      setPersonMatch(null);
      setSaved({});
      setSuggestions([]);
      setApproximate(false);
      setApproxQuery(null);
      setJustAdded(new Set());
      setAskReturnQuery("");
      librarySelectionRef.current = null;
    }
  }, [open]);

  // Debounced catalogue search. Skipped while Ask owns the surface.
  React.useEffect(() => {
    const request = ++standardSearchRequestRef.current;
    if (aiMode) {
      setLoading(false);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLibrary([]);
      setPersonMatch(null);
      setSaved({});
      setApproximate(false);
      setApproxQuery(null);
      setLoading(false);
      return;
    }
    // Never leave results for the previous query interactive during the
    // debounce/network window. The fixed-height loading state below preserves
    // the dialog geometry without letting a fast click open or add a stale row.
    setResults([]);
    setLibrary([]);
    setPersonMatch(null);
    setSaved({});
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (request !== standardSearchRequestRef.current) return;
        setLibrary(data.library ?? []);
        setResults(data.results ?? []);
        setPersonMatch(data.personMatch ?? null);
        setSaved(data.saved ?? {});
        setApproximate(Boolean(data.approximate));
        setApproxQuery(data.approxQuery ?? null);
      } catch {
        // Aborts are expected on every keystroke.
      } finally {
        if (request === standardSearchRequestRef.current) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, aiMode]);

  // Live suggestion chips for an empty Ask. The panel renders them itself.
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
      const customSelection = librarySelectionRef.current;
      if (customSelection) {
        customSelection({
          id: hit.id,
          tmdbId: hit.tmdb_id,
          mediaType: hit.media_type,
        });
        return;
      }
      router.push(`/title/${hit.id}`);
    },
    [router]
  );

  const handleSavedTitleSelect = React.useCallback(
    (hit: SavedTitleHit) => {
      setOpen(false);
      const customSelection = librarySelectionRef.current;
      if (customSelection) {
        customSelection({
          id: hit.id,
          tmdbId: hit.tmdb_id,
          mediaType: hit.media_type,
        });
        return;
      }
      router.push(`/title/${hit.id}`);
    },
    [router],
  );

  const handleQuickAdd = React.useCallback(
    async (item: SearchResult, status: TitleStatus) => {
      const key = `${item.media_type}-${item.id}`;
      if (adding.has(key) || justAdded.has(key)) return;
      setAdding((s) => new Set(s).add(key));
      try {
        const row = await addTitle({
          tmdbId: item.id,
          mediaType: item.media_type,
          status,
        });
        if (row?.id) {
          setSaved((current) => ({
            ...current,
            [key]: {
              id: row.id,
              tmdb_id: item.id,
              media_type: item.media_type,
              status,
            },
          }));
        }
        setJustAdded((s) => new Set(s).add(key));
        const name = item.title || item.name || "Title";
        toast.success(`${name} added to ${statusLabel(status)}.`);
        // The Server Action revalidates the Library page and returns its
        // updated RSC payload in this same roundtrip. A second router.refresh
        // here used to repaint the entire app once more after every save.
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Title could not be added.",
        );
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

  const startAsk = React.useCallback(() => {
    if (!aiEnabled || !query.trim()) return;
    setAskReturnQuery(query.trim());
    setAiMode(true);
    setSubmitTick((tick) => tick + 1);
    inputRef.current?.blur();
  }, [aiEnabled, query]);

  // Enter in Ask submits the input as a chat turn instead of letting cmdk
  // navigate (there is no command list in that state).
  // Blurring after submit dismisses the iOS soft keyboard so the user can
  // see the streaming response without manually tapping outside the input.
  // Desktop browsers don't show a soft keyboard so the blur is harmless
  // there — users can re-click to type a follow-up.
  // In catalogue results, cmdk handles Enter itself — it fires the
  // highlighted row's onSelect, and the auto-highlighted row is "Search all
  // results", so a bare type-then-Enter opens the results page.
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

  // Mobile screens are narrow; keep the prompt compact there while the
  // desktop field can explain the full titles + people + natural-language
  // search surface.
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const placeholder = listening
    ? "Listening…"
    : aiMode
      ? isMobile
        ? "Ask anything…"
        : "Ask about a title, person, or what to watch…"
      : isMobile
        ? "Find titles or people…"
        : "Find titles, people, or describe what you want…";
  const heading = approximate
    ? `Approximate results${approxQuery ? ` for "${approxQuery}"` : ""}`
    : "Movies & shows";

  const contextValue = React.useMemo<CommandPaletteContextValue>(
    () => ({ open: openPalette, openWith, aiEnabled }),
    [aiEnabled, openPalette, openWith],
  );

  const renderCatalogResult = (result: SearchResult) => {
    const name = result.title || result.name || "Untitled";
    const date = result.release_date || result.first_air_date || "";
    const year = date ? date.slice(0, 4) : "";
    const poster = posterUrl(result.poster_path, "w92");
    const vote = formatTmdbScore(result.vote_average);
    const key = `${result.media_type}-${result.id}`;
    const savedTitle = saved[key];
    const isSaved = Boolean(savedTitle) || justAdded.has(key);
    const isAdding = adding.has(key);
    const currentStatus = savedTitle?.status ?? (justAdded.has(key) ? "want" : null);
    const selectResult = () => {
      if (savedTitle) handleSavedTitleSelect(savedTitle);
      else handleSelect(result);
    };

    return (
      <div key={key} className="relative">
        <CommandItem
          value={key}
          onSelect={selectResult}
          onMouseDown={(event) => {
            event.preventDefault();
            selectResult();
          }}
          className="gap-3 pr-[7.75rem]"
        >
          <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
            {poster ? (
              <Image
                src={poster}
                alt={name}
                fill
                className="object-cover"
                sizes="44px"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {name}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase text-muted-foreground">
              {result.media_type === "movie" ? (
                <Film className="h-3 w-3" />
              ) : (
                <Tv className="h-3 w-3" />
              )}
              {result.media_type}
              {year ? <span>· {year}</span> : null}
              {vote ? <span className="ml-1">{vote}</span> : null}
            </span>
          </div>
        </CommandItem>

        <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
          {isSaved ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/15 px-2.5 text-[11px] font-medium text-primary">
              <Check className="h-3 w-3" />
              {statusLabel(currentStatus ?? "want")}
            </span>
          ) : (
            <div className="inline-flex h-8 overflow-hidden rounded-full border border-primary/35 bg-primary/12 text-primary shadow-sm">
              <button
                type="button"
                disabled={isAdding}
                aria-label={`Add ${name} to Up Next`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleQuickAdd(result, "want")}
                className="inline-flex min-w-[5.35rem] items-center justify-center gap-1.5 px-2.5 text-[11px] font-medium transition-[background-color,transform] hover:bg-primary/12 active:scale-[0.97] disabled:cursor-wait"
              >
                {isAdding ? (
                  <Loader2 className="loading-spinner h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>{isAdding ? "Adding" : "Up Next"}</span>
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isAdding}
                    aria-label={`Choose where to add ${name}`}
                    className="inline-flex w-8 items-center justify-center border-l border-primary/20 transition-[background-color,transform] hover:bg-primary/12 active:scale-[0.96] disabled:cursor-wait"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="z-[100] min-w-[9rem] rounded-xl border-border bg-popover p-1.5"
                >
                  {ADD_STATUSES.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => handleQuickAdd(result, option.value)}
                      className="h-9 rounded-lg px-3 text-xs"
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Ctx.Provider value={contextValue}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        preventOutsideDismiss
        // One stable canvas: mobile gets a dedicated full-height surface,
        // desktop keeps the same geometry across results and Ask.
        contentClassName="h-[100dvh] rounded-none sm:h-[min(720px,calc(100dvh-2rem))] sm:max-w-2xl sm:rounded-2xl"
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
            className={cn(
              aiMode
                ? "pr-20"
                : voiceSupported
                  ? "pr-20"
                  : "pr-10",
            )}
          />
          {!aiMode && voiceSupported && (
            <button
              type="button"
              aria-label={listening ? "Stop listening" : "Search by voice"}
              title={listening ? "Listening… tap to stop" : "Search by voice"}
              aria-pressed={listening}
              onClick={toggleVoice}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                "right-12",
                listening
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-accent"
              )}
            >
              <Mic className={cn("h-3.5 w-3.5", listening && "loading-breathe")} />
            </button>
          )}
          {aiMode && (
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
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center border-b border-border/60 px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setQuery(askReturnQuery);
                  setAiMode(false);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-[background-color,color,transform] hover:bg-accent hover:text-foreground active:scale-[0.97]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to results
              </button>
            </div>
            <AiChatPanel
              query={query}
              setQuery={setQuery}
              suggestions={suggestions}
              onClose={() => setOpen(false)}
              submitTick={submitTick}
            />
          </div>
        ) : (
          <CommandList
            className={cn(
              "max-h-none flex-1",
              query.trim().length >= 2 && "min-h-[220px]",
            )}
          >
            {/* Exact search stays the default Enter action. Ask lives in the
                same surface as a contextual command, not a separate mode the
                user has to turn on before typing. */}
            {query.trim().length >= 2 && (
              <CommandGroup>
                <CommandItem
                  value="search-all"
                  onSelect={handleSearchAll}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSearchAll();
                  }}
                  className="gap-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Search className="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    Search all results for{" "}
                    <span className="font-medium">&ldquo;{query.trim()}&rdquo;</span>
                  </span>
                  <kbd className="ml-auto shrink-0 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    ↵
                  </kbd>
                </CommandItem>
                {aiEnabled ? (
                  <CommandItem
                    value="ask"
                    onSelect={startAsk}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      startAsk();
                    }}
                    className="gap-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      Ask about{" "}
                      <span className="font-medium">
                        &ldquo;{query.trim()}&rdquo;
                      </span>
                    </span>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            )}
            {loading && (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="loading-spinner h-4 w-4" />
              </div>
            )}
            {!loading &&
              query &&
              results.length === 0 &&
              library.length === 0 &&
              (!personMatch || personMatch.results.length === 0) && (
              <CommandEmpty>No results.</CommandEmpty>
            )}
            {!loading && !query && (
              <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-xs leading-relaxed text-muted-foreground">
                Find a title, search by cast, or describe what you want to watch.
              </div>
            )}

            {library.length > 0 && (
              <CommandGroup heading="Your slate">
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
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                        <Library className="h-3 w-3" />
                        {hit.status === "want" ? "Up Next" : hit.status}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {personMatch && personMatch.results.length > 0 ? (
              <CommandGroup heading={`With ${personMatch.name}`}>
                <div className="mx-2 mb-1 flex items-center gap-2 rounded-lg border border-border/70 bg-card/55 px-2.5 py-2">
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                    {personMatch.profile_path ? (
                      <Image
                        src={posterUrl(personMatch.profile_path, "w92")!}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {personMatch.name}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {personMatch.known_for_department || "Filmography"}
                    </p>
                  </div>
                </div>
                {personMatch.results.map(renderCatalogResult)}
              </CommandGroup>
            ) : null}

            {results.length > 0 && (
              <CommandGroup heading={heading}>
                {results.map(renderCatalogResult)}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </CommandDialog>
    </Ctx.Provider>
  );
}
