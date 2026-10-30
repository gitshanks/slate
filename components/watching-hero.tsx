"use client";

import * as React from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { backdropUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";
import type { TitleRow } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

function art(title: TitleRow) {
  return title.backdrop_path ?? title.poster_path;
}

function Chips({ title, className }: { title: TitleRow; className?: string }) {
  const chips =
    title.current_season != null && title.current_episode != null
      ? [`Season ${title.current_season}`, `Episode ${title.current_episode}`]
      : [
          title.media_type === "tv" ? "Series" : "Movie",
          title.release_date?.slice(0, 4),
        ].filter(Boolean);
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-current/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

/**
 * The top of Home: a large card for the featured title beside a "Now
 * watching" list, as on slate for TV. Hovering or focusing a row features
 * that title; [onFeature] lets the page tint its ambient backdrop to match.
 */
export function WatchingHero({
  titles,
  onOpen,
  onFeature,
}: {
  titles: TitleRow[];
  onOpen: (title: TitleRow) => void;
  onFeature?: (artPath: string | null) => void;
}) {
  // Every title in progress lives here (there's no separate Watching page).
  const shown = titles;
  const reducedMotion = useReducedMotion() ?? false;
  const [featuredId, setFeaturedId] = React.useState(shown[0]?.id);
  const featured = shown.find((t) => t.id === featuredId) ?? shown[0];
  const index = shown.indexOf(featured);

  React.useEffect(() => {
    onFeature?.(featured ? art(featured) : null);
  }, [featured, onFeature]);

  if (!featured) return null;
  const year = featured.release_date?.slice(0, 4);
  const src = backdropUrl(art(featured), "w1280");

  return (
    <section
      aria-label="Now watching"
      className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_19rem] md:gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <button
        type="button"
        onClick={() => onOpen(featured)}
        data-analytics-action="open_featured_watching"
        className="group relative aspect-video overflow-hidden rounded-[22px] border border-border bg-card text-left text-white outline-none transition-[border-color,box-shadow] duration-200 hover:border-primary/60 focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_hsl(var(--primary)),0_18px_60px_-18px_hsl(var(--primary)/0.55)] md:aspect-auto md:min-h-[20rem] lg:min-h-[23rem]"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={featured.id}
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, ease: EASE }}
            className="absolute inset-0"
          >
            {src ? (
              <Image
                src={src}
                alt=""
                fill
                priority
                sizes="(min-width: 768px) 70vw, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.78)_0%,rgb(0_0_0/0.35)_45%,transparent_65%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.75)_0%,transparent_55%)]" />

        {shown.length > 1 && shown.length <= 8 ? (
          <div className="absolute left-5 top-5 flex gap-1.5 md:left-7 md:top-7">
            {shown.map((t, i) => (
              <span
                key={t.id}
                className={cn(
                  "h-1.5 rounded-full bg-white transition-all duration-300",
                  i === index ? "w-5" : "w-1.5 opacity-40",
                )}
              />
            ))}
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-7">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/75">
              {[year, featured.media_type === "tv" ? "Series" : "Movie"].filter(Boolean).join(" · ")}
            </p>
            <h2 className="mt-1 line-clamp-2 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-5xl">
              {featured.title}
            </h2>
            <Chips title={featured} className="mt-3 text-white/85" />
          </div>
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-colors duration-200 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-focus-visible:border-primary group-focus-visible:bg-primary group-focus-visible:text-primary-foreground md:h-16 md:w-16"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current md:h-7 md:w-7" />
          </span>
        </div>
      </button>

      <div className="flex min-h-0 min-w-0 flex-col md:max-h-[20rem] lg:max-h-[23rem]">
        <h2 className="mb-2 flex items-baseline justify-between px-1 text-base font-medium tracking-tight">
          Now watching
          {shown.length > 3 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {shown.length}
            </span>
          ) : null}
        </h2>
        {/* Scrolls within the section once there are more than fit beside the card. */}
        <ul className="scrollbar-hide -mx-1 flex max-h-[17rem] min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain px-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)] md:max-h-none md:flex-1">
          {shown.map((title) => {
            const thumb = backdropUrl(art(title), "w300");
            const isFeatured = title.id === featured.id;
            return (
              <li key={title.id}>
                <button
                  type="button"
                  onClick={() => onOpen(title)}
                  onMouseEnter={() => setFeaturedId(title.id)}
                  onFocus={() => setFeaturedId(title.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-1.5 text-left outline-none transition-colors duration-200",
                    isFeatured
                      ? "border-border bg-foreground/[0.06]"
                      : "border-transparent hover:bg-foreground/[0.04]",
                    "focus-visible:border-foreground/60",
                  )}
                >
                  <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-card lg:w-28">
                    {thumb ? (
                      <Image src={thumb} alt="" fill sizes="112px" className="object-cover" />
                    ) : null}
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white">
                        <Play className="ml-px h-3 w-3 fill-current" />
                      </span>
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-medium",
                        isFeatured ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {title.title}
                    </span>
                    <Chips title={title} className="mt-1.5 text-muted-foreground" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * A soft, page-wide wash of the featured title's art behind the page: a tiny
 * image blurred and faded into the background, crossfading as it changes.
 */
export function AmbientBackdrop({ path }: { path: string | null }) {
  const reducedMotion = useReducedMotion() ?? false;
  const src = backdropUrl(path, "w300");
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(110vh,64rem)] overflow-hidden">
      <AnimatePresence initial={false}>
        {src ? (
          <motion.div
            key={src}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.9, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="300px"
              className="scale-110 object-cover opacity-40 blur-3xl saturate-150 dark:opacity-70"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,hsl(var(--background)/0.1)_0%,hsl(var(--background)/0.5)_55%,hsl(var(--background))_100%)]" />
    </div>
  );
}
