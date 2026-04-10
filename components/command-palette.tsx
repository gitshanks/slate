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
import { Loader2, Film, Tv, Star } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { addTitle } from "@/lib/actions";
import { toast } from "sonner";

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
  const [approximate, setApproximate] = React.useState(false);
  const [approxQuery, setApproxQuery] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const adding = React.useRef(false);
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

  const handleSelect = React.useCallback(
    (item: SearchResult) => {
      if (adding.current) return;
      adding.current = true;
      const name = item.title || item.name || "Untitled";
      // Optimistic close — feels instant
      setOpen(false);
      setQuery("");
      const t = toast.loading(`Adding "${name}"…`);
      startTransition(async () => {
        try {
          await addTitle({ tmdbId: item.id, mediaType: item.media_type });
          toast.success(`Added "${name}"`, { id: t });
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to add", { id: t });
        } finally {
          adding.current = false;
        }
      });
    },
    [router]
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
          {!loading && query && results.length === 0 && (
            <CommandEmpty>No results.</CommandEmpty>
          )}
          {!loading && !query && (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              Type a title to search TMDB.
              <br />
              Press <kbd className="font-mono">↵</kbd> or click to add.
            </div>
          )}
          {results.length > 0 && (
            <CommandGroup
              heading={
                approximate
                  ? `Approximate results${approxQuery ? ` for "${approxQuery}"` : ""}`
                  : "Results"
              }
            >
              {results.map((r) => {
                const name = r.title || r.name || "Untitled";
                const date = r.release_date || r.first_air_date || "";
                const year = date ? date.slice(0, 4) : "";
                const poster = posterUrl(r.poster_path, "w92");
                const vote = r.vote_average && r.vote_average > 0 ? r.vote_average : null;
                return (
                  <CommandItem
                    key={`${r.media_type}-${r.id}`}
                    value={`${r.media_type}-${r.id}`}
                    onSelect={() => handleSelect(r)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(r);
                    }}
                    disabled={pending}
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
