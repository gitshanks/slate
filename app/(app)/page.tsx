import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { RecommendationsSection } from "@/components/recommendations-section";
import { FilteredGrid } from "@/components/filtered-grid";
import { Film, ArrowRight } from "lucide-react";
import { OpenPaletteHint } from "@/components/open-palette-hint";
import { fetchTitlesByStatus } from "@/lib/title-filters";

export const metadata: Metadata = {
  title: "slate — Watchlist",
};

export default async function WatchlistPage() {
  const [libResult, savedRowsRes] = await Promise.all([
    fetchTitlesByStatus("want"),
    supabase
      .from("titles")
      .select("tmdb_id")
      .then(({ data }) => (data ?? []) as { tmdb_id: number }[]),
  ]);

  if (libResult.error) {
    return (
      <EmptyState
        icon={<Film className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={libResult.error.message}
      />
    );
  }

  const { titles: allTitles, allGenres } = libResult;
  const savedTmdbIds = new Set<number>(savedRowsRes.map((r) => r.tmdb_id));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Your watchlist
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            Up next
          </h1>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {allTitles.length} {allTitles.length === 1 ? "title" : "titles"}
        </p>
      </div>

      <FilterBar genres={allGenres} />

      {allTitles.length === 0 ? (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="Your watchlist is empty"
          description="Press ⌘K to search TMDB and add the first title you want to watch."
          action={<OpenPaletteHint />}
        />
      ) : (
        <Suspense fallback={null}>
          <FilteredGrid allTitles={allTitles} status="want" />
        </Suspense>
      )}

      {/* The library ends here. A single teaser rail nudges toward Discover
          without turning the watchlist into a full TMDB browser. */}
      <div className="relative mt-20 border-t border-border/60 pt-12 sm:mt-24 sm:pt-16">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Discover
          </p>
          <Link
            href="/discover"
            prefetch
            className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono transition-colors hover:text-foreground"
          >
            See all in Discover
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <RecommendationsSection
          title="You might like"
          subtitle="Based on the titles you've watched"
          savedTmdbIds={savedTmdbIds}
          preview
        />
      </div>
    </div>
  );
}
