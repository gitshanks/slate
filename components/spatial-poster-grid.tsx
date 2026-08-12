"use client";

import * as React from "react";
import Image from "next/image";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import {
  Check,
  Clock,
  Eye,
  Heart,
  LocateFixed,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { ImdbBadge, MetacriticBadge, RottenTomatoesBadge } from "@/components/rating-icons";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersButton } from "@/components/watch-providers-button";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import { posterUrl, profileUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/types";
import {
  cn,
  formatImdbRating,
  formatMetacriticScore,
  formatRtScore,
  formatRuntime,
  formatYear,
} from "@/lib/utils";

interface SpatialPosterGridProps {
  titles: TitleRow[];
  username: string;
}

interface SpatialPoint {
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
}

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
}

const POSTER_WIDTH = 142;
const POSTER_HEIGHT = 213;
const COLUMN_GAP = 206;
const ROW_GAP = 286;
const SEARCH_DELAY = 320;

function spatialPoints(count: number, reducedMotion: boolean): SpatialPoint[] {
  const columns = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(count * 1.35))));
  const rows = Math.ceil(count / columns);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowLength = Math.min(columns, count - row * columns);
    const centeredColumn = column - (rowLength - 1) / 2;
    const centeredRow = row - (rows - 1) / 2;
    const wave = Math.sin(column * 1.31 + row * 0.77);
    const alternate = ((column + row * 2) % 5) - 2;

    return {
      x: centeredColumn * COLUMN_GAP,
      y: centeredRow * ROW_GAP,
      z: reducedMotion ? 0 : wave * 54 + alternate * 11,
      rotateX: reducedMotion ? 0 : wave * -1.3,
      rotateY: reducedMotion ? 0 : centeredColumn * -1.05 + alternate * 0.45,
    };
  });
}

function shelfPresentation(title: TitleRow) {
  if (title.status === "watching") {
    return { label: "Watching", icon: Eye };
  }
  if (title.status === "watched") {
    return { label: "Watched", icon: Check };
  }
  return { label: "Watchlist", icon: Clock };
}

function sentimentPresentation(title: TitleRow) {
  if (title.rating === 3) {
    return { label: "Loved", icon: Heart, className: "text-rose-400" };
  }
  if (title.rating === 2) {
    return { label: "Liked", icon: ThumbsUp, className: "text-emerald-400" };
  }
  if (title.rating === 1) {
    return { label: "Disliked", icon: ThumbsDown, className: "text-amber-400" };
  }
  return null;
}

function DetailLoading() {
  return (
    <div className="mt-7 space-y-5" aria-label="Loading title details">
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-foreground/10" />
      <div className="space-y-2">
        <div className="h-2.5 w-full animate-pulse rounded-full bg-foreground/8" />
        <div className="h-2.5 w-[92%] animate-pulse rounded-full bg-foreground/8" />
        <div className="h-2.5 w-[68%] animate-pulse rounded-full bg-foreground/8" />
      </div>
      <div className="flex gap-3 pt-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-foreground/8" />
            <div className="h-2 w-12 animate-pulse rounded-full bg-foreground/8" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TitleDetailSlab({
  title,
  detail,
  loading,
  error,
  onClose,
}: {
  title: TitleRow;
  detail: PublicSpatialTitleDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const year = formatYear(title.release_date);
  const runtime = formatRuntime(title.runtime);
  const imdb = formatImdbRating(title.imdb_rating);
  const rt = formatRtScore(title.rt_score);
  const metacritic = formatMetacriticScore(title.metacritic_score);
  const shelf = shelfPresentation(title);
  const ShelfIcon = shelf.icon;
  const sentiment = sentimentPresentation(title);
  const SentimentIcon = sentiment?.icon;
  const summary = detail?.summary || title.omdb_plot || title.overview;

  return (
    <motion.div
      data-spatial-control
      initial={{ opacity: 0, x: 28, rotateY: -5 }}
      animate={{ opacity: 1, x: 0, rotateY: -1.5 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
      className="pointer-events-auto w-[min(84vw,27rem)] overflow-hidden rounded-[1.65rem] border border-white/12 bg-[hsl(var(--background)/0.88)] text-left shadow-[0_40px_110px_-34px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        data-spatial-control
        className="scrollbar-hide max-h-[min(69dvh,43rem)] overflow-y-auto overscroll-contain p-5 sm:p-6"
        style={{ touchAction: "pan-y" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/75">
              {title.media_type === "movie" ? "Film" : "Series"}
            </p>
            <h3 className="mt-2 text-balance text-2xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[2rem]">
              {title.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.055] text-foreground/65 transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close title details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {detail?.tagline ? (
          <p className="mt-3 text-sm italic leading-relaxed text-foreground/55">
            {detail.tagline}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/55">
          {runtime ? <span className="text-foreground/80">{runtime}</span> : null}
          {year ? <span>{year}</span> : null}
          {title.genres?.slice(0, 2).map((genre) => (
            <span key={genre.id}>{genre.name}</span>
          ))}
        </div>

        {(imdb || rt || metacritic) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {imdb ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 text-[11px]">
                <ImdbBadge className="h-3 w-auto" />
                <span className="font-mono">{imdb}</span>
              </span>
            ) : null}
            {rt ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 text-[11px]">
                <RottenTomatoesBadge score={title.rt_score} className="h-3 w-auto" />
                <span className="font-mono">{rt}</span>
              </span>
            ) : null}
            {metacritic ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 text-[11px]">
                <MetacriticBadge score={title.metacritic_score} className="h-3 w-auto" />
                <span className="font-mono">{metacritic}</span>
              </span>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-medium text-primary-foreground">
            <ShelfIcon className="h-3.5 w-3.5" />
            {shelf.label}
          </span>
          {sentiment && SentimentIcon ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 text-[11px] font-medium">
              <SentimentIcon className={cn("h-3.5 w-3.5", sentiment.className)} />
              {sentiment.label}
            </span>
          ) : null}
          {detail?.trailerKey ? (
            <TrailerButton trailerKey={detail.trailerKey} titleName={title.title} />
          ) : null}
          {detail?.watchProviders?.providers.length ? (
            <WatchProvidersButton
              providers={detail.watchProviders.providers.map((provider) => ({
                provider_id: provider.id,
                provider_name: provider.name,
                logo_path: provider.logoPath,
              }))}
              link={detail.watchProviders.link}
              titleName={title.title}
            />
          ) : null}
        </div>

        {loading ? <DetailLoading /> : null}
        {error ? (
          <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-foreground/60">
            {error}
          </p>
        ) : null}

        {!loading && !error && summary ? (
          <div className="mt-6 space-y-3 text-[13px] leading-relaxed text-foreground/72">
            {summary.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {!loading && detail?.directedBy.length ? (
          <p className="mt-5 text-xs text-foreground/55">
            <span className="text-foreground/85">
              {title.media_type === "movie" ? "Directed by" : "Created by"}
            </span>{" "}
            {detail.directedBy.join(", ")}
          </p>
        ) : null}

        {!loading && detail?.cast.length ? (
          <section className="mt-7">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">
              Cast
            </h4>
            <div className="scrollbar-hide -mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
              {detail.cast.map((person) => {
                const image = profileUrl(person.profilePath, "w185");
                return (
                  <div key={`${person.id}-${person.subtitle}`} className="w-14 shrink-0">
                    <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-white/[0.045]">
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="grid h-full place-items-center font-mono text-[10px] text-foreground/35">
                          {person.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[10px] leading-tight text-foreground/75">
                      {person.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {title.review ? (
          <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">
              Note
            </h4>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/75">
              {title.review}
            </p>
          </section>
        ) : null}
      </div>
    </motion.div>
  );
}

export function SpatialPosterGrid({ titles, username }: SpatialPosterGridProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const points = React.useMemo(
    () => spatialPoints(titles.length, reducedMotion),
    [reducedMotion, titles.length],
  );
  const cameraX = useMotionValue(0);
  const cameraY = useMotionValue(0);
  const cameraScale = useMotionValue(0.88);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const gestureRef = React.useRef<GestureState | null>(null);
  const draggedRef = React.useRef(false);
  const animationRef = React.useRef<AnimationPlaybackControls[]>([]);
  const detailCacheRef = React.useRef(new Map<string, PublicSpatialTitleDetail>());
  const detailRequestRef = React.useRef(0);
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PublicSpatialTitleDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = React.useMemo(() => {
    if (!normalizedQuery) return [];
    return titles
      .filter((title) =>
        `${title.title} ${title.original_title ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 5);
  }, [normalizedQuery, titles]);
  const selectedIndex = selectedId
    ? titles.findIndex((title) => title.id === selectedId)
    : -1;
  const selectedTitle = selectedIndex >= 0 ? titles[selectedIndex] : null;
  const selectedPoint = selectedIndex >= 0 ? points[selectedIndex] : null;

  const stopCamera = React.useCallback(() => {
    animationRef.current.forEach((control) => control.stop());
    animationRef.current = [];
  }, []);

  const moveCamera = React.useCallback(
    (x: number, y: number, scale: number, gentle = false) => {
      stopCamera();
      if (reducedMotion) {
        cameraX.set(x);
        cameraY.set(y);
        cameraScale.set(scale);
        return;
      }

      const transition = gentle
        ? { type: "spring" as const, stiffness: 72, damping: 18, mass: 1.05 }
        : { type: "spring" as const, stiffness: 105, damping: 22, mass: 0.9 };
      animationRef.current = [
        animate(cameraX, x, transition),
        animate(cameraY, y, transition),
        animate(cameraScale, scale, transition),
      ];
    },
    [cameraScale, cameraX, cameraY, reducedMotion, stopCamera],
  );

  const frameTitle = React.useCallback(
    (index: number) => {
      const point = points[index];
      if (!point) return;
      const narrow = window.matchMedia("(max-width: 639px)").matches;
      const slabMidpointOffset = narrow ? 168 : 205;
      const scale = narrow ? 0.67 : 0.83;
      moveCamera(
        -(point.x + slabMidpointOffset) * scale,
        -point.y * scale,
        scale,
        true,
      );
    },
    [moveCamera, points],
  );

  const loadDetail = React.useCallback(
    async (title: TitleRow) => {
      const request = ++detailRequestRef.current;
      const cached = detailCacheRef.current.get(title.id);
      if (cached) {
        setDetail(cached);
        setDetailLoading(false);
        setDetailError(null);
        return;
      }

      setDetail(null);
      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await fetch(
          `/api/public/${encodeURIComponent(username)}/titles/${encodeURIComponent(title.id)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Title details are unavailable right now.");
        const nextDetail = (await response.json()) as PublicSpatialTitleDetail;
        detailCacheRef.current.set(title.id, nextDetail);
        if (request !== detailRequestRef.current) return;
        setDetail(nextDetail);
      } catch (error) {
        if (request !== detailRequestRef.current) return;
        setDetailError(
          error instanceof Error
            ? error.message
            : "Title details are unavailable right now.",
        );
      } finally {
        if (request === detailRequestRef.current) setDetailLoading(false);
      }
    },
    [username],
  );

  const selectTitle = React.useCallback(
    (title: TitleRow) => {
      const index = titles.findIndex((candidate) => candidate.id === title.id);
      if (index < 0) return;
      setSelectedId(title.id);
      frameTitle(index);
      void loadDetail(title);
    },
    [frameTitle, loadDetail, titles],
  );

  React.useEffect(() => {
    if (normalizedQuery.length < 2 || matches.length === 0) return;
    if (matches.some((title) => title.id === selectedId)) return;
    const timer = window.setTimeout(() => {
      setSearchOpen(false);
      selectTitle(matches[0]);
    }, SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [matches, normalizedQuery, selectTitle, selectedId]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedId) {
        detailRequestRef.current += 1;
        setSelectedId(null);
        setDetail(null);
        setDetailError(null);
        setQuery("");
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as Element).closest("[data-spatial-control]")) return;
      stopCamera();
      viewportRef.current?.setPointerCapture(event.pointerId);
      gestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocityX: 0,
        velocityY: 0,
      };
      draggedRef.current = false;
    },
    [stopCamera],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const now = performance.now();
      const dx = event.clientX - gesture.lastX;
      const dy = event.clientY - gesture.lastY;
      const elapsed = Math.max(8, now - gesture.lastTime);
      if (
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 5
      ) {
        draggedRef.current = true;
      }
      cameraX.set(cameraX.get() + dx);
      cameraY.set(cameraY.get() + dy);
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      gesture.lastTime = now;
      gesture.velocityX = dx / elapsed;
      gesture.velocityY = dy / elapsed;
    },
    [cameraX, cameraY],
  );

  const handlePointerEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gestureRef.current = null;
      if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
        viewportRef.current.releasePointerCapture(event.pointerId);
      }

      if (!reducedMotion && draggedRef.current) {
        const distanceX = Math.max(-190, Math.min(190, gesture.velocityX * 170));
        const distanceY = Math.max(-190, Math.min(190, gesture.velocityY * 170));
        moveCamera(
          cameraX.get() + distanceX,
          cameraY.get() + distanceY,
          cameraScale.get(),
        );
      }
      window.requestAnimationFrame(() => {
        draggedRef.current = false;
      });
    },
    [cameraScale, cameraX, cameraY, moveCamera, reducedMotion],
  );

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if ((event.target as Element).closest("[data-spatial-control]")) return;
      event.preventDefault();
      stopCamera();
      cameraX.set(cameraX.get() - event.deltaX - event.deltaY * 0.18);
      cameraY.set(cameraY.get() - event.deltaY * 0.72);
    },
    [cameraX, cameraY, stopCamera],
  );

  const closeDetail = React.useCallback(() => {
    detailRequestRef.current += 1;
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setQuery("");
    setSearchOpen(false);
  }, []);

  return (
    <section
      ref={viewportRef}
      className="relative left-1/2 h-[min(76dvh,56rem)] min-h-[34rem] w-screen -translate-x-1/2 cursor-grab overflow-hidden border-y border-white/8 bg-[#080a09] text-white active:cursor-grabbing"
      style={{ touchAction: "none", perspective: "1150px" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
      aria-label="Three dimensional poster gallery. Drag to explore."
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(173,235,179,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(173,235,179,0.055) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(circle at center, black 5%, transparent 76%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(173,235,179,0.08),transparent_42%),linear-gradient(to_bottom,rgba(8,10,9,0.18),rgba(8,10,9,0.72))]"
      />

      <div
        data-spatial-control
        className="absolute left-1/2 top-4 z-50 w-[min(calc(100%-2rem),25rem)] -translate-x-1/2 sm:top-5"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => {
              if (normalizedQuery) setSearchOpen(true);
            }}
            placeholder="Find a title"
            aria-label="Find a title in this gallery"
            className="h-11 w-full rounded-full border border-white/12 bg-black/48 pl-10 pr-10 text-sm text-white shadow-[0_16px_48px_-18px_rgba(0,0,0,0.9)] outline-none backdrop-blur-xl transition-colors placeholder:text-white/35 focus:border-primary/45"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSearchOpen(false);
              }}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {normalizedQuery && searchOpen && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/65 p-1.5 shadow-2xl backdrop-blur-2xl">
            {matches.length ? (
              matches.map((title) => (
                <button
                  key={title.id}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    selectTitle(title);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/8",
                    selectedId === title.id && "bg-white/8 text-primary",
                  )}
                >
                  <span className="truncate">{title.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-white/38">
                    {formatYear(title.release_date)}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-white/45">No match</p>
            )}
          </div>
        )}
      </div>

      <button
        data-spatial-control
        type="button"
        onClick={() => {
          closeDetail();
          moveCamera(0, 0, 0.88);
        }}
        className="absolute bottom-5 right-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/45 text-white/60 shadow-xl backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:right-6"
        aria-label="Reset gallery view"
        title="Reset view"
      >
        <LocateFixed className="h-4 w-4" />
      </button>

      <p className="pointer-events-none absolute bottom-6 left-4 z-40 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 sm:left-6 sm:text-[10px]">
        Drag to explore · Search to travel
      </p>

      <motion.div
        data-spatial-world
        className="absolute left-1/2 top-1/2"
        style={{
          x: cameraX,
          y: cameraY,
          scale: cameraScale,
          rotateX: reducedMotion ? 0 : 3.5,
          rotateY: reducedMotion ? 0 : -2.5,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {titles.map((title, index) => {
          const point = points[index];
          const src = posterUrl(title.poster_path, "w500");
          const selected = title.id === selectedId;
          return (
            <div
              key={title.id}
              className="absolute"
              style={{
                width: POSTER_WIDTH,
                transform: `translate3d(${point.x - POSTER_WIDTH / 2}px, ${point.y - POSTER_HEIGHT / 2}px, ${point.z}px) rotateX(${point.rotateX}deg) rotateY(${point.rotateY}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <motion.button
                type="button"
                onClick={() => {
                  if (draggedRef.current) return;
                  selectTitle(title);
                }}
                animate={{
                  scale: selected ? 1.055 : 1,
                  opacity: selectedId && !selected ? 0.62 : 1,
                }}
                whileHover={reducedMotion ? undefined : { y: -8, scale: selected ? 1.055 : 1.035 }}
                whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="group block w-full cursor-pointer text-left focus-visible:outline-none"
                aria-label={`Open ${title.title} details`}
              >
                <span
                  className={cn(
                    "relative block aspect-[2/3] overflow-hidden rounded-[1rem] border bg-white/[0.035] shadow-[0_28px_65px_-28px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-300",
                    selected
                      ? "border-primary/80 shadow-[0_0_0_4px_rgba(173,235,179,0.1),0_34px_90px_-28px_rgba(173,235,179,0.45)]"
                      : "border-white/12 group-hover:border-white/30",
                  )}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt={title.title}
                      fill
                      draggable={false}
                      sizes="142px"
                      className="select-none object-cover"
                    />
                  ) : (
                    <span className="grid h-full place-items-center p-4 text-center text-xs text-white/45">
                      {title.title}
                    </span>
                  )}
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </span>
                <span className="mt-2.5 block truncate text-[12px] font-medium text-white/82">
                  {title.title}
                </span>
                <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                  {formatYear(title.release_date) || title.media_type}
                </span>
              </motion.button>
            </div>
          );
        })}

        {selectedTitle && selectedPoint ? (
          <div
            data-spatial-slab
            className="absolute"
            style={{
              transform: `translate3d(${selectedPoint.x + 116}px, ${selectedPoint.y - 292}px, ${selectedPoint.z + 24}px)`,
              transformStyle: "preserve-3d",
            }}
          >
            <TitleDetailSlab
              key={selectedTitle.id}
              title={selectedTitle}
              detail={detail}
              loading={detailLoading}
              error={detailError}
              onClose={closeDetail}
            />
          </div>
        ) : null}
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_120px_45px_#080a09] sm:shadow-[inset_0_0_190px_58px_#080a09]"
      />
    </section>
  );
}
