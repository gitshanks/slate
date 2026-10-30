"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { backdropUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";
import type { TitleRow } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;
// Beyond this many, dots stop being readable; show "3 / 12" instead.
const MAX_DOTS = 8;

/** The featured card's id: the title overlay anchors itself beside it. */
export const WATCHING_FEATURED_ID = "watching-featured-card";

function art(title: TitleRow) {
  return title.backdrop_path ?? title.poster_path;
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
 * The Watching shelf, as on slate for TV: a featured card beside a "Now
 * watching" list. Tapping a row features that title (tap it again to open
 * it); the card swipes or steps between titles, and the card or its arrow
 * button opens the title overlay. [onFeature] lets the page tint its ambient
 * backdrop to match.
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
  const reducedMotion = useReducedMotion() ?? false;
  const [featuredId, setFeaturedId] = React.useState(titles[0]?.id);
  // +1 when moving forward, -1 back: the slide enters from that side.
  const [direction, setDirection] = React.useState(1);
  const dragged = React.useRef(false);
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = React.useState(0);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const index = Math.max(0, titles.findIndex((t) => t.id === featuredId));
  const featured = titles[index];
  const many = titles.length > 1;

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

  // A row tap features the title; on a phone the card may be scrolled away,
  // so bring it back into view. Tapping the featured row again opens it.
  const selectRow = (title: TitleRow) => {
    if (title.id === featured.id) {
      onOpen(title);
      return;
    }
    feature(titles.indexOf(title));
    // After the card re-renders, so the new slide doesn't cancel the scroll.
    window.setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;
      const viewTop = document.getElementById("app-scroll-area")?.getBoundingClientRect().top ?? 0;
      if (card.getBoundingClientRect().top < viewTop) {
        card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
      }
    }, 0);
  };

  const src = backdropUrl(art(featured), "w1280");
  const year = featured.release_date?.slice(0, 4);

  return (
    <section
      aria-label="Now watching"
      className="mb-8 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div
        ref={cardRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Featured, ${index + 1} of ${titles.length}`}
        className="group/hero relative scroll-mt-28"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") feature(index + 1);
          else if (event.key === "ArrowLeft") feature(index - 1);
          else return;
          event.preventDefault();
        }}
      >
        <div
          id={WATCHING_FEATURED_ID}
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

          {/* The whole card opens the title overlay; a swipe that moved it doesn't. */}
          <button
            type="button"
            aria-label={`Open ${featured.title}`}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              onOpen(featured);
            }}
            data-analytics-action="open_featured_watching"
            className="group/open absolute inset-0 flex items-end justify-between gap-4 rounded-[22px] p-5 text-left text-white outline-none ring-primary/80 focus-visible:ring-2 md:p-7"
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
            {/* The explicit way in: opens the title card beside the hero. */}
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-[background-color,color,transform] duration-200 group-hover/open:scale-105 group-hover/open:bg-white group-hover/open:text-black group-focus-visible/open:bg-white group-focus-visible/open:text-black md:h-12 md:w-12"
            >
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </button>

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

      {/* Beside the card (desktop) the list matches its height and scrolls
          within it; stacked (phone) it is part of the page. */}
      <div className="flex min-w-0 flex-col md:h-[clamp(20rem,34vw,26rem)]">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-base font-medium tracking-tight">Now watching</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {titles.length}
          </span>
        </div>
        <ul className="scrollbar-hide -mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-1 pb-1 md:[scrollbar-gutter:stable]">
          {titles.map((title) => {
            const thumb = backdropUrl(art(title), "w300");
            const isFeatured = title.id === featured.id;
            return (
              <li key={title.id}>
                <button
                  type="button"
                  aria-pressed={isFeatured}
                  aria-label={isFeatured ? `Open ${title.title}` : `Show ${title.title}`}
                  onClick={() => selectRow(title)}
                  className={cn(
                    "group/row relative flex w-full items-center gap-3 rounded-xl p-1.5 pr-3 text-left outline-none transition-colors duration-200",
                    isFeatured ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.04]",
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
                  {isFeatured ? (
                    <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
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
