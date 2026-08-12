"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Box, Film, LayoutGrid } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { FilteredGrid } from "@/components/filtered-grid";
import { cn } from "@/lib/utils";
import type { TitleRow, TitleStatus } from "@/lib/types";

const SpatialPosterGrid = dynamic(
  () =>
    import("@/components/spatial-poster-grid").then(
      (module) => module.SpatialPosterGrid,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[#080a09]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(173,235,179,0.08),transparent_46%)]" />
        <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Opening the gallery
        </div>
      </div>
    ),
  },
);

type ViewMode = "grid" | "spatial";

interface PublicProfileCollectionViewProps {
  eyebrow: string;
  label: string;
  titles: TitleRow[];
  spatialTitles: TitleRow[];
  genres: { id: number; name: string }[];
  status: Exclude<TitleStatus, "dropped">;
  username: string;
}

export function PublicProfileCollectionView({
  eyebrow,
  label,
  titles,
  spatialTitles,
  genres,
  status,
  username,
}: PublicProfileCollectionViewProps) {
  const [mode, setMode] = React.useState<ViewMode>("grid");
  const reducedMotion = useReducedMotion();
  const exitSpatial = React.useCallback(() => setMode("grid"), []);

  React.useEffect(() => {
    if (mode !== "spatial") return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [mode]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {mode === "spatial" ? "All shelves" : eyebrow}
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {mode === "spatial" ? "All titles" : label}
          </h2>
        </div>

        <div
          className="inline-flex rounded-full border border-border bg-card/75 p-1 shadow-sm backdrop-blur-xl"
          role="group"
          aria-label="Collection view"
        >
          <button
            type="button"
            onClick={() => setMode("grid")}
            aria-pressed={mode === "grid"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === "grid"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            2D
          </button>
          <button
            type="button"
            onClick={() => setMode("spatial")}
            aria-pressed={mode === "spatial"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === "spatial"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Box className="h-3.5 w-3.5" />
            3D
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mode === "grid" ? (
          <motion.div
            key="grid"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {titles.length ? (
              <>
                <FilterBar
                  genres={genres}
                  showSentiment={status === "watched"}
                  recentSortLabel={status === "watched" ? "Recently watched" : undefined}
                />
                <React.Suspense fallback={null}>
                  <FilteredGrid
                    allTitles={titles}
                    status={status}
                    readOnly
                    titleHrefBase={`/u/${username}/title`}
                  />
                </React.Suspense>
              </>
            ) : (
              <EmptyState
                icon={<Film className="h-6 w-6" />}
                title={`Nothing in ${label.toLowerCase()} yet`}
                description="This shelf is waiting for its first title."
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="spatial"
            role="dialog"
            aria-modal="true"
            aria-label="3D library"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-40 bg-[#080a09]"
          >
            <SpatialPosterGrid
              titles={spatialTitles}
              username={username}
              onExit={exitSpatial}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
