"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Command,
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

export interface LibrarySelection {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
}

export interface SmartSearchOpenOptions {
  initialQuery?: string;
  mode?: "search" | "ask";
  submit?: boolean;
  onLibrarySelect?: (selection: LibrarySelection) => void;
}

export interface SmartSearchSurfaceHandle {
  id: string;
  getAnchor: () => HTMLElement | null;
  focus: () => void;
  supportsInline: () => boolean;
  onLibrarySelect?: (selection: LibrarySelection) => void;
}

interface CommandPaletteContextValue {
  open: () => void;
  openWith: (options: SmartSearchOpenOptions) => void;
  activate: (options?: SmartSearchOpenOptions) => void;
  registerSurface: (surface: SmartSearchSurfaceHandle) => () => void;
  activateSurface: (
    id: string,
    options?: SmartSearchOpenOptions,
  ) => boolean;
  dismissInline: () => void;
  aiEnabled: boolean;
}

interface SmartSearchSessionValue {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  inlineOpen: boolean;
  activeSurfaceId: string | null;
  resultsListId: string | null;
  activateSurface: (
    id: string,
    options?: SmartSearchOpenOptions,
  ) => boolean;
  dismissInline: () => void;
  submitSearch: () => void;
  startAsk: () => void;
  focusFirstResult: () => void;
}

interface InlineResultsGeometry {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

const Ctx = React.createContext<CommandPaletteContextValue | null>(null);
const SessionCtx = React.createContext<SmartSearchSessionValue | null>(null);

function blurActiveSmartSearch() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.closest("[data-smart-search-surface]")
  ) {
    active.blur();
  }
}

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

export function useSmartSearchSession() {
  const value = React.useContext(SessionCtx);
  if (!value) {
    throw new Error(
      "useSmartSearchSession must be used inside CommandPaletteProvider",
    );
  }
  return value;
}

interface ProviderProps {
  children: React.ReactNode;
  /** Set server-side from `aiSearchEnabled`. When false the AI toggle is hidden. */
  aiEnabled?: boolean;
}

export function CommandPaletteProvider({ children, aiEnabled = false }: ProviderProps) {
  const [open, setOpen] = React.useState(false);
  const [activeSurfaceId, setActiveSurfaceId] = React.useState<string | null>(
    null,
  );
  const [inlineListId, setInlineListId] = React.useState<string | null>(null);
  const [inlineGeometry, setInlineGeometry] =
    React.useState<InlineResultsGeometry | null>(null);
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
  const inlineResultsRef = React.useRef<HTMLDivElement>(null);
  const surfacesRef = React.useRef<Map<string, SmartSearchSurfaceHandle>>(
    new Map(),
  );
  const standardSearchRequestRef = React.useRef(0);
  const skipAutoFocusRef = React.useRef(false);
  const librarySelectionRef = React.useRef<
    ((selection: LibrarySelection) => void) | null
  >(null);
  const router = useRouter();

  const openPalette = React.useCallback(() => {
    librarySelectionRef.current = null;
    skipAutoFocusRef.current = false;
    blurActiveSmartSearch();
    setActiveSurfaceId(null);
    setAiMode(false);
    setAskReturnQuery("");
    setSubmitTick(0);
    setOpen(true);
  }, []);

  const openWith = React.useCallback((options: SmartSearchOpenOptions) => {
    const initialQuery = options.initialQuery?.trim() ?? "";
    const shouldSubmit = Boolean(
      options.mode === "ask" && options.submit && initialQuery,
    );
    librarySelectionRef.current = options.onLibrarySelect ?? null;
    skipAutoFocusRef.current = shouldSubmit;
    blurActiveSmartSearch();
    setActiveSurfaceId(null);
    setQuery(initialQuery);
    setAskReturnQuery(options.mode === "ask" ? initialQuery : "");
    setAiMode(options.mode === "ask");
    setOpen(true);
    if (shouldSubmit) {
      setSubmitTick((tick) => tick + 1);
    } else {
      // AiChatPanel remounts whenever Ask opens. Resetting the edge token keeps
      // an older submission from being mistaken for a fresh request.
      setSubmitTick(0);
    }
  }, []);

  const closeInline = React.useCallback((blurInput: boolean) => {
    if (blurInput) blurActiveSmartSearch();
    setActiveSurfaceId(null);
  }, []);

  const dismissInline = React.useCallback(() => {
    closeInline(true);
  }, [closeInline]);

  const isVisibleSurface = React.useCallback(
    (surface: SmartSearchSurfaceHandle) => {
      const anchor = surface.getAnchor();
      return Boolean(anchor?.isConnected && anchor.getClientRects().length);
    },
    [],
  );

  const canUseInlineSurface = React.useCallback(
    (surface: SmartSearchSurfaceHandle) => {
      if (
        typeof window === "undefined" ||
        !window.matchMedia("(min-width: 768px)").matches ||
        !surface.supportsInline()
      ) {
        return false;
      }

      return isVisibleSurface(surface);
    },
    [isVisibleSurface],
  );

  const activateSurface = React.useCallback(
    (id: string, options: SmartSearchOpenOptions = {}) => {
      const surface = surfacesRef.current.get(id);
      if (!surface) {
        openWith(options);
        return false;
      }
      if (!canUseInlineSurface(surface)) {
        openWith({
          ...options,
          onLibrarySelect:
            options.onLibrarySelect ?? surface.onLibrarySelect,
        });
        return false;
      }

      librarySelectionRef.current =
        options.onLibrarySelect ?? surface.onLibrarySelect ?? null;
      skipAutoFocusRef.current = false;
      if (options.initialQuery !== undefined) {
        setQuery(options.initialQuery.trim());
      }
      setAskReturnQuery("");
      setAiMode(false);
      setOpen(false);
      setActiveSurfaceId(id);

      // The input is already mounted. Keeping this call in the originating
      // click stack preserves the trusted user gesture iOS needs to show its
      // software keyboard.
      surface.focus();
      return true;
    },
    [canUseInlineSurface, openWith],
  );

  const registerSurface = React.useCallback(
    (surface: SmartSearchSurfaceHandle) => {
      surfacesRef.current.set(surface.id, surface);

      return () => {
        if (surfacesRef.current.get(surface.id) !== surface) return;
        surfacesRef.current.delete(surface.id);
        setActiveSurfaceId((current) =>
          current === surface.id ? null : current,
        );
      };
    },
    [],
  );

  const activate = React.useCallback(
    (options: SmartSearchOpenOptions = {}) => {
      if (options.mode === "ask") {
        openWith(options);
        return;
      }

      const surfaces = Array.from(surfacesRef.current.values()).reverse();
      const inlineSurface = surfaces.find(canUseInlineSurface);
      if (inlineSurface) {
        activateSurface(inlineSurface.id, options);
        return;
      }

      const visibleSurface = surfaces.find(isVisibleSurface);
      openWith({
        ...options,
        onLibrarySelect:
          options.onLibrarySelect ?? visibleSurface?.onLibrarySelect,
      });
    },
    [activateSurface, canUseInlineSurface, isVisibleSurface, openWith],
  );

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
    dismissInline();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }, [dismissInline, query, router]);

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
          openWith({ initialQuery: query, mode: "ask" });
        } else if (open) {
          setOpen(false);
        } else if (activeSurfaceId) {
          dismissInline();
        } else {
          activate();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activate, activeSurfaceId, aiEnabled, dismissInline, open, openWith, query]);

  // Reset transient *search* state when the palette closes — fresh open feels
  // fresh. The AI conversation deliberately persists (it lives in the shared
  // provider) so it survives close and the modal → /discover page hop.
  React.useEffect(() => {
    if (!open && !activeSurfaceId) {
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
      setSubmitTick(0);
      librarySelectionRef.current = null;
    }
  }, [activeSurfaceId, open]);

  // Keep the desktop result surface visually attached to the active search
  // field without coupling the provider to any one toolbar implementation.
  // ResizeObserver catches the compact-to-expanded width change; capture-phase
  // scroll tracking also covers nested app scrollers.
  React.useEffect(() => {
    if (!activeSurfaceId) {
      setInlineGeometry(null);
      return;
    }

    const surface = surfacesRef.current.get(activeSurfaceId);
    if (!surface || !canUseInlineSurface(surface)) {
      dismissInline();
      return;
    }

    const anchor = surface.getAnchor();
    if (!anchor) {
      dismissInline();
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const currentAnchor = surface.getAnchor();
      if (!currentAnchor?.isConnected || !currentAnchor.getClientRects().length) {
        dismissInline();
        return;
      }

      const rect = currentAnchor.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth =
        visualViewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const gutter = 16;
      const width = Math.min(
        672,
        Math.max(rect.width, Math.min(560, viewportWidth - gutter * 2)),
      );
      const centeredLeft = rect.left + rect.width / 2 - width / 2;
      const left = Math.min(
        Math.max(viewportLeft + gutter, centeredLeft),
        Math.max(viewportLeft + gutter, viewportRight - gutter - width),
      );
      const top = Math.round(rect.bottom + 8);
      const dock = document.getElementById("app-bottom-nav");
      const dockTop =
        dock && dock.getClientRects().length
          ? dock.getBoundingClientRect().top
          : Number.POSITIVE_INFINITY;
      const usableBottom = Math.min(viewportBottom, dockTop) - 12;
      const maxHeight = Math.max(
        160,
        Math.min(620, usableBottom - top),
      );
      const next = {
        left: Math.round(left),
        top,
        width: Math.round(width),
        maxHeight: Math.round(maxHeight),
      };

      setInlineGeometry((current) =>
        current &&
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight
          ? current
          : next,
      );
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(anchor);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [
    activeSurfaceId,
    canUseInlineSurface,
    dismissInline,
  ]);

  React.useEffect(() => {
    if (!activeSurfaceId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!event.isPrimary || event.button !== 0) return;
      const surface = surfacesRef.current.get(activeSurfaceId);
      const anchor = surface?.getAnchor();
      if (
        anchor?.contains(target) ||
        inlineResultsRef.current?.contains(target) ||
        target.closest('[role="menu"]')
      ) {
        return;
      }
      // Match title-inspector dismissal: the first outside press closes this
      // transient surface and cannot also activate a poster, filter, or link
      // underneath it.
      event.preventDefault();
      event.stopPropagation();

      // Pointer Events intentionally still dispatches a click after a
      // cancelled pointerdown. Consume that matching synthetic click once so
      // the press cannot both close search and activate the element beneath.
      const pointerId = event.pointerId;
      const pointerX = event.clientX;
      const pointerY = event.clientY;
      let cleanupTimer = 0;
      let pointerUpTimer = 0;
      const cleanup = () => {
        document.removeEventListener("click", suppressClick, true);
        document.removeEventListener("pointerup", handlePointerUp, true);
        document.removeEventListener("pointercancel", handlePointerCancel, true);
        window.clearTimeout(cleanupTimer);
        window.clearTimeout(pointerUpTimer);
      };
      const suppressClick = (clickEvent: MouseEvent) => {
        const sameTarget =
          clickEvent.target === target ||
          (clickEvent.target instanceof Node && target.contains(clickEvent.target));
        const samePoint =
          Math.abs(clickEvent.clientX - pointerX) <= 4 &&
          Math.abs(clickEvent.clientY - pointerY) <= 4;
        if (!sameTarget && !samePoint) return;
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        cleanup();
      };
      const handlePointerUp = (pointerEvent: PointerEvent) => {
        if (pointerEvent.pointerId !== pointerId) return;
        // `click` follows `pointerup` synchronously. A zero-delay cleanup
        // keeps the capture listener through that click, but removes it when
        // the gesture ends without one.
        pointerUpTimer = window.setTimeout(cleanup, 0);
      };
      const handlePointerCancel = (pointerEvent: PointerEvent) => {
        if (pointerEvent.pointerId === pointerId) cleanup();
      };
      document.addEventListener("click", suppressClick, true);
      document.addEventListener("pointerup", handlePointerUp, true);
      document.addEventListener("pointercancel", handlePointerCancel, true);
      cleanupTimer = window.setTimeout(cleanup, 700);
      dismissInline();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (
        document.activeElement instanceof Element &&
        inlineResultsRef.current?.contains(document.activeElement)
      ) {
        surfacesRef.current.get(activeSurfaceId)?.focus();
        // Keep focus on the search field while closing the result layer. The
        // public dismiss action deliberately blurs for outside press/Cmd+K,
        // but keyboard Escape should return focus to its owning combobox.
        closeInline(false);
        return;
      }
      dismissInline();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeSurfaceId, closeInline, dismissInline]);

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
      dismissInline();
      router.push(`/discover/${item.media_type}/${item.id}`);
    },
    [dismissInline, router]
  );

  const handleLibrarySelect = React.useCallback(
    (hit: LibraryHit) => {
      setOpen(false);
      dismissInline();
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
    [dismissInline, router]
  );

  const handleSavedTitleSelect = React.useCallback(
    (hit: SavedTitleHit) => {
      setOpen(false);
      dismissInline();
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
    [dismissInline, router],
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
    if (!aiEnabled) return;
    const prompt = query.trim();
    setAskReturnQuery(prompt);
    dismissInline();
    setAiMode(true);
    setOpen(true);
    if (prompt) setSubmitTick((tick) => tick + 1);
    else setSubmitTick(0);
    inputRef.current?.blur();
  }, [aiEnabled, dismissInline, query]);

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

  const focusFirstResult = React.useCallback(() => {
    const focus = () => {
      const list = inlineResultsRef.current?.querySelector<HTMLElement>(
        "[cmdk-list]",
      );
      if (!list) return false;
      list.focus({ preventScroll: true });
      inlineResultsRef.current
        ?.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
      return true;
    };

    if (!focus()) window.requestAnimationFrame(focus);
  }, []);

  const captureInlineList = React.useCallback((node: HTMLDivElement | null) => {
    setInlineListId(node?.id ?? null);
  }, []);

  const contextValue = React.useMemo<CommandPaletteContextValue>(
    () => ({
      open: openPalette,
      openWith,
      activate,
      registerSurface,
      activateSurface,
      dismissInline,
      aiEnabled,
    }),
    [
      activate,
      activateSurface,
      aiEnabled,
      dismissInline,
      openPalette,
      openWith,
      registerSurface,
    ],
  );

  const sessionValue = React.useMemo<SmartSearchSessionValue>(
    () => ({
      query,
      setQuery,
      inlineOpen: Boolean(activeSurfaceId) && !open,
      activeSurfaceId,
      resultsListId: inlineListId,
      activateSurface,
      dismissInline,
      submitSearch: handleSearchAll,
      startAsk,
      focusFirstResult,
    }),
    [
      activeSurfaceId,
      activateSurface,
      dismissInline,
      focusFirstResult,
      handleSearchAll,
      inlineListId,
      open,
      query,
      startAsk,
    ],
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

  const renderStandardResults = (inline = false) => (
    <CommandList
      ref={inline ? captureInlineList : undefined}
      aria-label={inline ? "Suggestions" : undefined}
      style={
        inline && inlineGeometry
          ? { maxHeight: inlineGeometry.maxHeight }
          : undefined
      }
      className={cn(
        "max-h-none flex-1",
        query.trim().length >= 2 && "min-h-[220px]",
        inline && "min-h-0 overscroll-contain",
      )}
    >
      {/* Exact search stays the default Enter action. Ask lives in the same
          surface as a contextual command, not a separate mode the user has to
          turn on before typing. */}
      {query.trim().length >= 2 && (
        <CommandGroup>
          <CommandItem
            value="search-all"
            onSelect={handleSearchAll}
            onMouseDown={(event) => {
              event.preventDefault();
              handleSearchAll();
            }}
            className="gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Search className="h-4 w-4" />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              Search all results for{" "}
              <span className="font-medium">
                &ldquo;{query.trim()}&rdquo;
              </span>
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
              (hit.metacritic_score != null &&
                Number(hit.metacritic_score) > 0);
            return (
              <CommandItem
                key={`lib-${hit.id}`}
                value={`lib-${hit.id}`}
                onSelect={() => handleLibrarySelect(hit)}
                onMouseDown={(event) => {
                  event.preventDefault();
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
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase text-muted-foreground">
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
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
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
  );

  return (
    <Ctx.Provider value={contextValue}>
      <SessionCtx.Provider value={sessionValue}>
        {children}
        {activeSurfaceId && inlineGeometry && !open ? (
          <div
            ref={inlineResultsRef}
            className="fixed z-[85] overflow-hidden rounded-2xl border border-border bg-popover/96 text-popover-foreground shadow-[0_24px_70px_-24px_rgba(0,0,0,0.58)] ring-1 ring-foreground/[0.04] backdrop-blur-2xl"
            style={{
              left: inlineGeometry.left,
              top: inlineGeometry.top,
              width: inlineGeometry.width,
              maxHeight: inlineGeometry.maxHeight,
            }}
          >
            <Command
              shouldFilter={false}
              className="h-auto max-h-full rounded-2xl bg-transparent [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
            >
              {renderStandardResults(true)}
            </Command>
          </div>
        ) : null}
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
          renderStandardResults()
        )}
        </CommandDialog>
      </SessionCtx.Provider>
    </Ctx.Provider>
  );
}
