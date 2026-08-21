"use client";

import * as React from "react";
import { Search, Sparkles, X } from "lucide-react";
import {
  useCommandPalette,
  useSmartSearchSession,
  type LibrarySelection,
  type SmartSearchOpenOptions,
  type SmartSearchSurfaceHandle,
} from "@/components/command-palette";
import { cn } from "@/lib/utils";

export interface SmartSearchBarProps {
  /** Unique id used to register and focus this mounted toolbar surface. */
  surfaceId: string;
  className?: string;
  /** Resting width. The phone layout remains full-width regardless. */
  widthClassName?: string;
  /** Width while focused, non-empty, or showing inline results. */
  expandedClassName?: string;
  /** Enables the compact-to-expanded tablet and desktop treatment. */
  responsive?: boolean;
  /** Whether catalogue results can render beneath this field. */
  supportsInline?: boolean;
  /** Preserves Library's in-place Shelf/Space selection behavior. */
  onLibrarySelect?: (selection: LibrarySelection) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const DEFAULT_RESTING_WIDTH =
  "md:max-[1399px]:w-28 min-[1400px]:w-56";
const DEFAULT_EXPANDED_WIDTH =
  "md:max-[1399px]:w-72 min-[1400px]:w-[clamp(18rem,22vw,24rem)]";

/**
 * The single mounted input used by Search, Ask, and the bottom-dock Add
 * shortcut. Search state and result rendering live in CommandPaletteProvider;
 * this component only owns the resilient input surface and its controls.
 */
export function SmartSearchBar({
  surfaceId,
  className,
  widthClassName = DEFAULT_RESTING_WIDTH,
  expandedClassName = DEFAULT_EXPANDED_WIDTH,
  responsive = true,
  supportsInline = true,
  onLibrarySelect,
  placeholder = "Search titles, people, or ask",
  ariaLabel = "Search titles and people, or ask Slate",
}: SmartSearchBarProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { aiEnabled, activateSurface, openWith, registerSurface } =
    useCommandPalette();
  const {
    query,
    setQuery,
    inlineOpen,
    activeSurfaceId,
    morphingSurfaceId,
    resultsListId,
    dismissInline,
    submitSearch,
    startAsk,
    focusFirstResult,
  } = useSmartSearchSession();
  const onLibrarySelectRef = React.useRef(onLibrarySelect);

  const isActive = activeSurfaceId === surfaceId;
  const isMobileMorphing = morphingSurfaceId === surfaceId;
  const isInlineExpanded = supportsInline && isActive && inlineOpen;
  const hasQuery = Boolean(query.trim());
  const isExpanded = isActive || hasQuery || isInlineExpanded;
  const hasLibrarySelection = Boolean(onLibrarySelect);

  React.useLayoutEffect(() => {
    onLibrarySelectRef.current = onLibrarySelect;
  }, [onLibrarySelect]);

  // This callback is deliberately synchronous. iOS only presents its keyboard
  // when focus happens inside the original tap, so the bottom Add shortcut can
  // call the registered handle without waiting for an effect or animation.
  const focusInput = React.useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }

    try {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    } catch {
      // Some input implementations do not expose a selectable text range.
    }
  }, []);

  React.useLayoutEffect(() => {
    const handle: SmartSearchSurfaceHandle = {
      id: surfaceId,
      getAnchor: () => rootRef.current,
      focus: focusInput,
      supportsInline: () => supportsInline,
      onLibrarySelect: hasLibrarySelection
        ? (selection) => onLibrarySelectRef.current?.(selection)
        : undefined,
    };

    return registerSurface(handle);
  }, [focusInput, hasLibrarySelection, registerSurface, surfaceId, supportsInline]);

  const activationOptions = React.useMemo<SmartSearchOpenOptions>(
    () => (onLibrarySelect ? { onLibrarySelect } : {}),
    [onLibrarySelect],
  );

  const activateThisSurface = React.useCallback(() => {
    activateSurface(surfaceId, activationOptions);
  }, [activateSurface, activationOptions, surfaceId]);

  const handleClear = React.useCallback(() => {
    activateThisSurface();
    setQuery("");
    focusInput();
  }, [activateThisSurface, focusInput, setQuery]);

  const handleSearch = React.useCallback(() => {
    activateThisSurface();
    if (hasQuery) {
      submitSearch();
      return;
    }
    focusInput();
  }, [activateThisSurface, focusInput, hasQuery, submitSearch]);

  const handleAsk = React.useCallback(() => {
    if (!hasQuery) {
      openWith({ ...activationOptions, mode: "ask" });
      return;
    }
    activateThisSurface();
    startAsk();
  }, [activateThisSurface, activationOptions, hasQuery, openWith, startAsk]);

  return (
    <div
      ref={rootRef}
      data-smart-search-surface={surfaceId}
      data-engaged={isExpanded ? "true" : "false"}
      data-inline-open={isInlineExpanded ? "true" : "false"}
      className={cn(
        "relative h-10 w-full min-w-0 shrink-0 rounded-full transition-[width,max-width,flex-basis] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0",
        isMobileMorphing && "smart-search-mobile-target-enter",
        responsive
          ? isExpanded
            ? expandedClassName
            : widthClassName
          : widthClassName,
        className,
      )}
    >
      <div className="relative flex h-full min-w-0 items-center overflow-hidden rounded-full border border-border bg-foreground/[0.065] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.055)] backdrop-blur-xl transition-[border-color,background-color,box-shadow] duration-150 focus-within:border-primary/55 focus-within:bg-foreground/[0.09] focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.1),inset_0_1px_0_hsl(var(--foreground)/0.08)]">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 h-4 w-4 shrink-0 text-muted-foreground"
        />

        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={
            isInlineExpanded ? resultsListId ?? undefined : undefined
          }
          aria-expanded={isInlineExpanded}
          aria-haspopup={
            isInlineExpanded && resultsListId ? "listbox" : undefined
          }
          value={query}
          placeholder={placeholder}
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onFocus={activateThisSurface}
          onChange={(event) => {
            if (!isActive) activateThisSurface();
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;

            if (event.key === "ArrowDown" && isInlineExpanded) {
              event.preventDefault();
              focusFirstResult();
              return;
            }

            if (event.key === "Enter" && hasQuery) {
              event.preventDefault();
              submitSearch();
              return;
            }

            if (event.key === "Escape" && (isActive || inlineOpen)) {
              event.preventDefault();
              dismissInline();
              event.currentTarget.blur();
            }
          }}
          className={cn(
            "h-full w-full min-w-0 appearance-none bg-transparent pl-10 text-base text-foreground outline-none placeholder:truncate placeholder:text-muted-foreground sm:text-sm [&::-webkit-search-cancel-button]:hidden",
            !isExpanded
              ? "pr-4"
              : hasQuery && aiEnabled
              ? "pr-[7.25rem]"
              : hasQuery || (aiEnabled && isExpanded)
                ? "pr-[5.25rem]"
                : "pr-12",
          )}
        />

        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {hasQuery ? (
            <button
              type="button"
              aria-label="Clear search"
              onPointerDown={(event) => event.preventDefault()}
              onClick={handleClear}
              className="grid h-8 w-8 touch-manipulation place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-[0.96] motion-reduce:active:scale-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}

          {aiEnabled && isExpanded ? (
            <button
              type="button"
              aria-label={hasQuery ? `Ask about ${query.trim()}` : "Ask Slate"}
              onPointerDown={(event) => event.preventDefault()}
              onClick={handleAsk}
              className="grid h-8 w-8 touch-manipulation place-items-center rounded-full border border-border bg-foreground/[0.075] text-muted-foreground outline-none transition-[border-color,background-color,color,transform] duration-150 hover:border-primary/45 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-[0.96] motion-reduce:active:scale-100"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}

          {isExpanded ? (
            <button
              type="button"
              aria-label={hasQuery ? "Search all results" : "Start search"}
              onPointerDown={(event) => event.preventDefault()}
              onClick={handleSearch}
              className={cn(
                "grid h-8 w-8 touch-manipulation place-items-center rounded-full outline-none transition-[background-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-[0.96] motion-reduce:active:scale-100",
                hasQuery
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-foreground/10 text-foreground hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <Search className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
