"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { backdropUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";
import type { TitleRow } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;
// Show this many in the list before "Show all"; the rest stay one tap away.
const LIST_PREVIEW = 5;
// Beyond this many, dots stop being readable; show "3 / 12" instead.
const MAX_DOTS = 8;

function art(title: TitleRow) {
  return title.backdrop_path ?? title.poster_path;
}

function href(title: TitleRow) {
  return `/title/${title.id}`;
}

function progressLabel(title: TitleRow) {
  if (title.current_season != null && title.current_episode != null) {
    return `Season ${title.current_season} · Episode ${title.current_episode}`;
  }
  return [title.media_type === "tv" ? "Series" : "Movie", title.release_date?.slice(0, 4)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The Watching shelf, as on slate for TV: a featured card you can swipe or
 * step through, beside a "Now watching" list. Every card opens the title.
 * Hovering or focusing a list row features it; [onFeature] lets the page tint
 * its ambient backdrop to match.
 */
export function WatchingHero({
  titles,
  onFeature,
}: {
  titles: TitleRow[];
  onFeature?: (artPath: string | null) => void;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [featuredId, setFeaturedId] = React.useState(titles[0]?.id);
  // +1 when moving forward, -1 back: the slide enters from that side.
  const [direction, setDirection] = React.useState(1);
  const [expanded, setExpanded] = React.useState(false);
  const dragged = React.useRef(false);
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = React.useState(0);

  const index = Math.max(0, titles.findIndex((t) => t.id === featuredId));
  const featured = titles[index];

  React.useEffect(() => {
    onFeature?.(featured ? art(featured) : null);
  }, [featured, onFeature]);

  const feature = React.useCallback(
    (next: number) => {
      if (!titles.length) return;
      const wrapped = (next + titles.length) % titles.length;
      setDirection(next > index ? 1 : -1);
      setFeaturedId(titles[wrapped].id);
    },
    [index, titles],
  );

  if (!featured) return null;

  // Swipe (touch or mouse): a mostly-horizontal move past 60px steps the card.
  // The card follows the finger a little while dragging.
  const onPointerDown = (event: React.PointerEvent) => {
    if (!many || (event.pointerType === "mouse" && event.button !== 0)) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
    dragged.current = false;
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const start = swipeStart.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!dragged.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) dragged.current = true;
    if (dragged.current) setDragX(dx * 0.3);
  };
  const onPointerEnd = (event: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    setDragX(0);
    if (!start || !dragged.current) return;
    const dx = event.clientX - start.x;
    if (dx < -60) feature(index + 1);
    else if (dx > 60) feature(index - 1);
  };

  const listed = expanded ? titles : titles.slice(0, LIST_PREVIEW);
  const src = backdropUrl(art(featured), "w1280");
  const year = featured.release_date?.slice(0, 4);
  const many = titles.length > 1;

  return (
    <section
      aria-label="Now watching"
      className="mb-8 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={`Featured, ${index + 1} of ${titles.length}`}
        className="group/hero relative"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") feature(index + 1);
          else if (event.key === "ArrowLeft") feature(index - 1);
          else return;
          event.preventDefault();
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={(event) => {
            if (swipeStart.current) onPointerEnd(event);
          }}
          className="relative aspect-[16/10] touch-pan-y select-none overflow-hidden rounded-[22px] border border-border bg-card sm:aspect-video md:aspect-auto md:h-[clamp(20rem,34vw,26rem)]"
        >
          <motion.div
            className="absolute inset-0"
            animate={{ x: dragX }}
            transition={dragX === 0 ? { type: "spring", stiffness: 420, damping: 38 } : { duration: 0 }}
          >
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={featured.id}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: reducedMotion ? 0 : d * 48 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: reducedMotion ? 0 : d * -48 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reducedMotion ? 0 : 0.42, ease: EASE }}
              className="absolute inset-0"
            >
              {src ? (
                <Image
                  src={src}
                  alt=""
                  fill
                  priority
                  draggable={false}
                  sizes="(min-width: 768px) 70vw, 100vw"
                  className="pointer-events-none select-none object-cover"
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
          </motion.div>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.8)_0%,rgb(0_0_0/0.35)_48%,transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.78)_0%,transparent_58%)]" />

          {/* The whole card opens the title; a swipe that moved it doesn't. */}
          <Link
            href={href(featured)}
            prefetch
            draggable={false}
            onClickCapture={(event) => {
              if (dragged.current) {
                event.preventDefault();
                dragged.current = false;
              }
            }}
            data-analytics-action="open_featured_watching"
            className="group/link absolute inset-0 flex items-end justify-between gap-4 rounded-[22px] p-5 text-white outline-none ring-primary/80 focus-visible:ring-2 md:p-7"
          >
            {/* Remounts per title and fades in; no exit, so fast stepping never stalls. */}
            <motion.div
                key={featured.id}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.32, ease: EASE }}
                className="min-w-0 max-w-[36rem]"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
                  {[year, featured.media_type === "tv" ? "Series" : "Movie"].filter(Boolean).join(" · ")}
                </p>
                <h2 className="mt-1.5 line-clamp-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[2.75rem] lg:leading-[1.05]">
                  {featured.title}
                </h2>
                <p className="mt-3 text-xs font-medium text-white/85 sm:text-sm">
                  {progressLabel(featured)}
                </p>
                {featured.overview ? (
                  <p className="mt-2 hidden max-w-[30rem] text-sm leading-relaxed text-white/65 line-clamp-2 lg:block">
                    {featured.overview}
                  </p>
                ) : null}
            </motion.div>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium backdrop-blur-md transition-colors duration-200 group-hover/link:bg-white group-hover/link:text-black group-focus-visible/link:bg-white group-focus-visible/link:text-black sm:inline-flex">
              Open
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          {many ? (
            <>
              <StepButton side="left" label="Previous title" onClick={() => feature(index - 1)} />
              <StepButton side="right" label="Next title" onClick={() => feature(index + 1)} />
            </>
          ) : null}

          {many ? (
            titles.length <= MAX_DOTS ? (
              <div className="absolute left-3 top-3 flex md:left-5 md:top-5">
                {titles.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={`Show ${t.title}`}
                    aria-current={i === index}
                    onClick={() => feature(i)}
                    className="grid h-6 place-items-center px-1 outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-white"
                  >
                    <span
                      className={cn(
                        "block h-1.5 rounded-full bg-white transition-all duration-300",
                        i === index ? "w-5" : "w-1.5 opacity-45 hover:opacity-80",
                      )}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="pointer-events-none absolute left-5 top-5 font-mono text-[10px] tracking-[0.16em] text-white/75">
                {index + 1} / {titles.length}
              </p>
            )
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-base font-medium tracking-tight">Now watching</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {titles.length}
          </span>
        </div>
        <ul className="flex flex-col gap-1">
          {listed.map((title) => {
            const thumb = backdropUrl(art(title), "w300");
            const isFeatured = title.id === featured.id;
            return (
              <li key={title.id}>
                <Link
                  href={href(title)}
                  prefetch={false}
                  onMouseEnter={() => feature(titles.indexOf(title))}
                  onFocus={() => feature(titles.indexOf(title))}
                  className={cn(
                    "group/row relative flex items-center gap-3 rounded-xl p-1.5 pr-3 outline-none transition-colors duration-200",
                    isFeatured ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.04]",
                    "focus-visible:ring-2 focus-visible:ring-primary/70",
                  )}
                >
                  {/* Marks the row shown in the large card. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-opacity duration-200",
                      isFeatured ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-card lg:w-[6.5rem]">
                    {thumb ? (
                      <Image src={thumb} alt="" fill sizes="104px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-medium transition-colors",
                        isFeatured ? "text-foreground" : "text-muted-foreground group-hover/row:text-foreground",
                      )}
                    >
                      {title.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {progressLabel(title)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {titles.length > LIST_PREVIEW ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="mt-2 w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {expanded ? "Show less" : `Show all ${titles.length}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function StepButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/35 text-white opacity-0 backdrop-blur-md outline-none transition-[opacity,background-color] duration-200 hover:bg-black/55 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white group-hover/hero:opacity-100 md:grid",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

/**
 * A soft, page-wide wash of the featured title's art. A tiny image is blurred
 * at 1/8 size and scaled up on the compositor, so it costs almost nothing to
 * scroll over (a full-size CSS blur repainted on every frame).
 */
export function AmbientBackdrop({ path }: { path: string | null }) {
  const reducedMotion = useReducedMotion() ?? false;
  const src = backdropUrl(path, "w92");
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
            <div className="absolute left-0 top-0 h-[12.5%] w-[12.5%] origin-top-left scale-[8] will-change-transform">
              <Image
                src={src}
                alt=""
                fill
                sizes="92px"
                className="object-cover opacity-40 blur-[3px] saturate-150 dark:opacity-70"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,hsl(var(--background)/0.1)_0%,hsl(var(--background)/0.5)_55%,hsl(var(--background))_100%)]" />
    </div>
  );
}
