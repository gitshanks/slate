"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import {
  ArrowLeft,
  Check,
  Clock,
  Eye,
  Heart,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { ImdbBadge, MetacriticBadge, RottenTomatoesBadge } from "@/components/rating-icons";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersButton } from "@/components/watch-providers-button";
import type {
  PublicSpatialPerson,
  PublicSpatialRecommendation,
  PublicSpatialTitleDetail,
} from "@/lib/public-spatial-detail-types";
import {
  getCachedPersonDetail,
  loadPersonDetail,
} from "@/lib/person-detail-cache";
import type {
  PersonKnownForTitle,
  PersonProfileDetail,
} from "@/lib/person-detail-types";
import {
  getCachedPublicTitleDetail,
  loadPublicTitleDetail,
} from "@/lib/public-title-detail-cache";
import { backdropUrl, posterUrl, profileUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/types";
import {
  cn,
  formatImdbRating,
  formatMetacriticScore,
  formatRtScore,
  formatRuntime,
  formatYear,
} from "@/lib/utils";

export interface TitleDetailSource {
  getCached: (title: TitleRow) => PublicSpatialTitleDetail | null;
  load: (title: TitleRow) => Promise<PublicSpatialTitleDetail>;
}

export type TitleDetailActionsRenderer = (
  title: TitleRow,
  detail: PublicSpatialTitleDetail | null,
) => React.ReactNode;

interface SpatialPosterGridProps {
  titles: TitleRow[];
  /**
   * Changes when filters change, but stays stable for background collection
   * updates. This keeps a single added title from fading the whole canvas.
   */
  resultsTransitionKey?: string;
  /**
   * Kept for public-profile callers. Generic collection surfaces should pass
   * a detailSource instead so their ownership/authentication stays outside
   * the spatial renderer.
   */
  username?: string;
  detailSource?: TitleDetailSource;
  renderActions?: TitleDetailActionsRenderer;
  onExit: () => void;
  searchTarget: { titleId: string; request: number } | null;
  initialCamera?: SpatialCameraState;
  onCameraChange?: (camera: SpatialCameraState) => void;
  /** Keeps the Space inspector below persistent collection controls. */
  centerAfterId?: string;
}

export interface SpatialCameraState {
  x: number;
  y: number;
  scale: number;
}

interface SpatialPoint {
  x: number;
  y: number;
}

interface SpatialCell {
  key: string;
  titleIndex: number;
  point: SpatialPoint;
  canonical: boolean;
}

interface SpatialLayout {
  points: SpatialPoint[];
  cells: SpatialCell[];
  periodX: number;
  periodY: number;
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

type ResultsTransitionPhase = "idle" | "fading-out" | "fading-in";

const POSTER_WIDTH = 142;
const POSTER_HEIGHT = 213;
const COLUMN_GAP = 206;
const ROW_GAP = 286;
const MIN_HORIZONTAL_OVERSCAN = 4;
const MIN_VERTICAL_OVERSCAN = 3;
const MOBILE_RENDER_SCALE_FLOOR = 0.64;
const DESKTOP_RENDER_SCALE_FLOOR = 0.8;
const LENS_MIN_SCALE = 0.5;
const LENS_SCALE_RANGE = 0.76;
const LENS_DEPTH = 190;
const DESKTOP_CAMERA_SCALE = 0.88;
const MOBILE_CAMERA_SCALE = 0.7;
const TITLE_FRAME_DURATION_SECONDS = 0.24;
const TITLE_FRAME_REVEAL_DELAY_MS = 260;
const TITLE_FRAME_EASE = [0.77, 0, 0.175, 1] as const;

export function animateTitleFrameScroll(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
) {
  return animate(from, to, {
    duration: TITLE_FRAME_DURATION_SECONDS,
    ease: TITLE_FRAME_EASE,
    onUpdate,
    onComplete,
  });
}

const unavailableTitleDetailSource: TitleDetailSource = {
  getCached: () => null,
  load: async () => {
    throw new Error("Title details are unavailable right now.");
  },
};

function publicTitleDetailSource(username: string): TitleDetailSource {
  return {
    getCached: (title) => getCachedPublicTitleDetail(username, title.id),
    load: (title) => loadPublicTitleDetail(username, title.id),
  };
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function spatialPoint(
  row: number,
  column: number,
  rows: number,
  columns: number,
): SpatialPoint {
  const centeredColumn = column - (columns - 1) / 2;
  const centeredRow = row - (rows - 1) / 2;

  return {
    x: centeredColumn * COLUMN_GAP,
    y: centeredRow * ROW_GAP,
  };
}

function spatialLayout(
  count: number,
  viewportWidth: number,
  viewportHeight: number,
): SpatialLayout {
  if (count <= 0) {
    return { points: [], cells: [], periodX: 0, periodY: 0 };
  }

  const columns = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(count * 1.35))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const renderScaleFloor =
    viewportWidth <= 639
      ? MOBILE_RENDER_SCALE_FLOOR
      : DESKTOP_RENDER_SCALE_FLOOR;
  // A wrapped camera can sit half a grid period from the canonical cells.
  // Size the repeated window from the real viewport so wide screens never
  // expose an edge while the camera crosses that seam.
  const horizontalOverscan = Math.max(
    MIN_HORIZONTAL_OVERSCAN,
    Math.ceil(viewportWidth / (2 * COLUMN_GAP * renderScaleFloor) + 1.5),
  );
  const verticalOverscan = Math.max(
    MIN_VERTICAL_OVERSCAN,
    Math.ceil(viewportHeight / (2 * ROW_GAP * renderScaleFloor) + 1.5),
  );
  const points = Array.from({ length: count }, (_, index) =>
    spatialPoint(
      Math.floor(index / columns),
      index % columns,
      rows,
      columns,
    ),
  );
  const cells: SpatialCell[] = [];

  for (
    let row = -verticalOverscan;
    row < rows + verticalOverscan;
    row += 1
  ) {
    for (
      let column = -horizontalOverscan;
      column < columns + horizontalOverscan;
      column += 1
    ) {
      const canonicalCell =
        modulo(row, rows) * columns + modulo(column, columns);
      cells.push({
        key: `${row}:${column}`,
        titleIndex: canonicalCell % count,
        point: spatialPoint(row, column, rows, columns),
        canonical:
          row >= 0 &&
          row < rows &&
          column >= 0 &&
          column < columns &&
          canonicalCell < count,
      });
    }
  }

  return {
    points,
    cells,
    periodX: columns * COLUMN_GAP,
    periodY: rows * ROW_GAP,
  };
}

function wrapCamera(value: number, period: number) {
  if (period <= 0) return value;
  return modulo(value + period / 2, period) - period / 2;
}

function nearestRepeatedTarget(target: number, current: number, period: number) {
  if (period <= 0) return target;
  return target + Math.round((current - target) / period) * period;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shelfPresentation(title: TitleRow) {
  if (title.status === "watching") {
    return {
      label: "Watching",
      icon: Eye,
      borderClass: "border-primary/80",
      hoverBorderClass: "group-hover:border-primary",
      metaClass: "text-primary",
    };
  }
  if (title.status === "watched") {
    return {
      label: "Watched",
      icon: Check,
      borderClass: "border-primary/35",
      hoverBorderClass: "group-hover:border-primary/65",
      metaClass: "text-primary/65",
    };
  }
  return {
    label: "Up Next",
    icon: Clock,
    borderClass: "border-border",
    hoverBorderClass: "group-hover:border-foreground/35",
    metaClass: "text-muted-foreground",
  };
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

function FisheyePosterCell({
  cell,
  title,
  selectedId,
  reducedMotion,
  cameraScale,
  wrappedCameraX,
  wrappedCameraY,
  viewportWidth,
  viewportHeight,
  draggedRef,
  onSelect,
  onClose,
}: {
  cell: SpatialCell;
  title: TitleRow;
  selectedId: string | null;
  reducedMotion: boolean;
  cameraScale: MotionValue<number>;
  wrappedCameraX: MotionValue<number>;
  wrappedCameraY: MotionValue<number>;
  viewportWidth: MotionValue<number>;
  viewportHeight: MotionValue<number>;
  draggedRef: React.RefObject<boolean>;
  onSelect: (title: TitleRow, point: SpatialPoint) => void;
  onClose: () => void;
}) {
  const point = cell.point;
  const src = posterUrl(title.poster_path, "w500");
  const selected = title.id === selectedId;
  const shelf = shelfPresentation(title);
  const lensTransform = useTransform(() => {
    const worldScale = cameraScale.get();
    const screenX = point.x * worldScale + wrappedCameraX.get();
    const screenY = point.y * worldScale + wrappedCameraY.get();
    const radiusX = Math.max(300, viewportWidth.get() * 0.56);
    const radiusY = Math.max(360, viewportHeight.get() * 0.62);
    const normalizedX = screenX / radiusX;
    const normalizedY = screenY / radiusY;
    const distance = Math.sqrt(
      normalizedX * normalizedX + normalizedY * normalizedY,
    );
    const focus = Math.exp(-distance * distance * 1.38);
    const lensScale = LENS_MIN_SCALE + LENS_SCALE_RANGE * focus;
    const inverseWorldScale = 1 / Math.max(worldScale, 0.5);
    const lensX = point.x + screenX * focus * 0.16 * inverseWorldScale;
    const lensY = point.y + screenY * focus * 0.34 * inverseWorldScale;
    const depth = reducedMotion
      ? 0
      : LENS_DEPTH * focus - Math.min(distance, 1.8) * 42;
    const rotateY = reducedMotion
      ? 0
      : clamp(normalizedX, -1.3, 1.3) * -8.5;
    const rotateX = reducedMotion
      ? 0
      : clamp(normalizedY, -1.3, 1.3) * 5.5;

    return `translate3d(${lensX - POSTER_WIDTH / 2}px, ${lensY - POSTER_HEIGHT / 2}px, ${depth}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${lensScale})`;
  });

  return (
    <motion.div
      className="absolute"
      style={{
        width: POSTER_WIDTH,
        transform: lensTransform,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      <motion.button
        type="button"
        data-spatial-title-id={title.id}
        onClick={() => {
          if (draggedRef.current) return;
          if (selectedId === title.id) {
            onClose();
            return;
          }
          onSelect(title, point);
        }}
        animate={{
          scale: selected ? 1.055 : 1,
          opacity: selectedId && !selected ? 0.62 : 1,
        }}
        whileHover={
          reducedMotion
            ? undefined
            : { y: -8, scale: selected ? 1.055 : 1.035 }
        }
        whileTap={reducedMotion ? undefined : { scale: 0.985 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="group block w-full cursor-pointer text-left focus-visible:outline-none"
        tabIndex={cell.canonical ? 0 : -1}
        aria-hidden={cell.canonical ? undefined : true}
        aria-label={`Open ${title.title} details. ${shelf.label}.`}
      >
        <span
          className={cn(
            "relative block aspect-[2/3] overflow-hidden rounded-[1rem] border bg-card/60 shadow-[0_24px_54px_-28px_rgba(15,23,42,0.32)] transition-[border-color,box-shadow] duration-300 dark:shadow-[0_28px_65px_-28px_rgba(0,0,0,0.9)]",
            selected
              ? "border-primary/80"
              : [shelf.borderClass, shelf.hoverBorderClass],
          )}
          style={
            selected
              ? {
                  boxShadow:
                    "0 0 0 4px hsl(var(--primary) / 0.1), 0 34px 90px -28px hsl(var(--primary) / 0.45)",
                }
              : undefined
          }
        >
          {src ? (
            <Image
              src={src}
              alt={cell.canonical ? title.title : ""}
              fill
              draggable={false}
              sizes="142px"
              className="select-none object-cover"
            />
          ) : (
            <span className="grid h-full place-items-center p-4 text-center text-xs text-muted-foreground">
              {title.title}
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </span>
        <span className="mt-2.5 block truncate text-[12px] font-medium text-foreground/85">
          {title.title}
        </span>
        <span
          className={cn(
            "mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em]",
            shelf.metaClass,
          )}
        >
          <span>{shelf.label}</span>
          {formatYear(title.release_date) ? (
            <span className="ml-auto text-muted-foreground/70">
              {formatYear(title.release_date)}
            </span>
          ) : null}
        </span>
      </motion.button>
    </motion.div>
  );
}

function SpatialPosterWorld({
  cells,
  titles,
  periodX,
  periodY,
  selectedId,
  reducedMotion,
  cameraX,
  cameraY,
  cameraScale,
  viewportWidth,
  viewportHeight,
  draggedRef,
  onSelect,
  onClose,
}: {
  cells: SpatialCell[];
  titles: TitleRow[];
  periodX: number;
  periodY: number;
  selectedId: string | null;
  reducedMotion: boolean;
  cameraX: MotionValue<number>;
  cameraY: MotionValue<number>;
  cameraScale: MotionValue<number>;
  viewportWidth: MotionValue<number>;
  viewportHeight: MotionValue<number>;
  draggedRef: React.RefObject<boolean>;
  onSelect: (title: TitleRow, point: SpatialPoint) => void;
  onClose: () => void;
}) {
  const wrappedCameraX = useTransform(() =>
    wrapCamera(cameraX.get(), periodX * cameraScale.get()),
  );
  const wrappedCameraY = useTransform(() =>
    wrapCamera(cameraY.get(), periodY * cameraScale.get()),
  );

  return (
    <motion.div
      data-spatial-world
      className="absolute left-1/2 top-1/2"
      style={{
        x: wrappedCameraX,
        y: wrappedCameraY,
        scale: cameraScale,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {cells.map((cell) => {
        const title = titles[cell.titleIndex];
        return (
          <FisheyePosterCell
            key={cell.key}
            cell={cell}
            title={title}
            selectedId={selectedId}
            reducedMotion={reducedMotion}
            cameraScale={cameraScale}
            wrappedCameraX={wrappedCameraX}
            wrappedCameraY={wrappedCameraY}
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
            draggedRef={draggedRef}
            onSelect={onSelect}
            onClose={onClose}
          />
        );
      })}
    </motion.div>
  );
}

function DetailLoading() {
  return (
    <div className="mt-7 space-y-5" aria-label="Loading title details">
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
      <div className="space-y-2">
        <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-[92%] animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-[68%] animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex gap-3 pt-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
            <div className="h-2 w-12 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPeopleRail({
  label,
  people,
  onSelect,
}: {
  label: "Cast" | "Crew";
  people: PublicSpatialPerson[];
  onSelect: (
    person: PublicSpatialPerson,
    source: "Cast" | "Crew",
    trigger: HTMLButtonElement,
  ) => void;
}) {
  if (people.length === 0) return null;

  return (
    <section className="-mx-5 mt-7 sm:-mx-6">
      <h4 className="px-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:px-6">
        {label}
      </h4>
      <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto overscroll-x-contain px-5 pb-1 sm:px-6">
        {people.map((person) => {
          const image = profileUrl(person.profilePath, "w185");
          return (
            <button
              key={`${person.id}-${person.subtitle}`}
              type="button"
              data-spatial-control
              onClick={(event) =>
                onSelect(person, label, event.currentTarget)
              }
              onPointerEnter={() => {
                void loadPersonDetail(person.id).catch(() => undefined);
              }}
              onFocus={() => {
                void loadPersonDetail(person.id).catch(() => undefined);
              }}
              onTouchStart={() => {
                void loadPersonDetail(person.id).catch(() => undefined);
              }}
              aria-label={`Open ${person.name} profile`}
              className="group w-16 shrink-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-border bg-muted/50 transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-[0_12px_28px_-16px_hsl(var(--primary)/0.55)] group-active:scale-[0.98]">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground/75">
                    {person.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                )}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-tight text-foreground/80 transition-colors group-hover:text-foreground">
                {person.name}
              </p>
              {person.subtitle ? (
                <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-muted-foreground">
                  {person.subtitle}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatPersonBirthday(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : value;
}

function PersonDetailLoading() {
  return (
    <div className="mt-7 space-y-5" aria-label="Loading person details">
      <div className="flex flex-wrap gap-2">
        <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-[94%] animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-[82%] animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-[58%] animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex gap-3 pt-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="w-20 shrink-0 space-y-2">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
            <div className="h-2 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonKnownForRail({ items }: { items: PersonKnownForTitle[] }) {
  if (items.length === 0) return null;

  return (
    <section className="-mx-5 mt-8 sm:-mx-6" aria-label="Known for">
      <h4 className="px-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:px-6">
        Known for
      </h4>
      <div
        role="list"
        className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2 sm:px-6"
      >
        {items.map((item) => {
          const image = posterUrl(item.posterPath, "w342");
          const year = formatYear(item.releaseDate);
          return (
            <div
              key={`${item.mediaType}-${item.tmdbId}`}
              role="listitem"
              className="w-[5.25rem] shrink-0"
              title={item.title}
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted/50">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="84px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center px-2 text-center text-[9px] text-muted-foreground">
                    {item.title}
                  </span>
                )}
              </div>
              <p className="mt-1.5 truncate text-[10px] font-medium text-foreground/80">
                {item.title}
              </p>
              {year ? (
                <p className="mt-0.5 font-mono text-[8px] text-muted-foreground">
                  {year}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PersonDetailPanel({
  person,
  source,
  titleName,
  onBack,
}: {
  person: PublicSpatialPerson;
  source: "Cast" | "Crew";
  titleName: string;
  onBack: () => void;
}) {
  const [retryCount, setRetryCount] = React.useState(0);
  const [detail, setDetail] = React.useState<PersonProfileDetail | null>(() =>
    getCachedPersonDetail(person.id),
  );
  const [loading, setLoading] = React.useState(
    () => getCachedPersonDetail(person.id) === null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  React.useEffect(() => {
    let current = true;
    const cached = getCachedPersonDetail(person.id);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      setError(null);
      return () => {
        current = false;
      };
    }

    setLoading(true);
    setError(null);
    void loadPersonDetail(person.id)
      .then((nextDetail) => {
        if (current) setDetail(nextDetail);
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "This person’s details are unavailable right now.",
        );
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [person.id, retryCount]);

  const name = detail?.name || person.name;
  const photo = profileUrl(
    detail?.profilePath ?? person.profilePath,
    "w342",
  );
  const birthday = formatPersonBirthday(detail?.birthday ?? null);

  return (
    <div className="relative min-h-full p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[18rem] overflow-hidden"
      >
        {photo ? (
          <Image
            src={photo}
            alt=""
            fill
            sizes="(max-width: 639px) 84vw, 27rem"
            loading="eager"
            className="scale-110 object-cover object-top opacity-30 blur-[2px] saturate-[0.9]"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--card)/0.96)_0%,hsl(var(--card)/0.72)_52%,hsl(var(--card)/0.34)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,hsl(var(--card))_4%,hsl(var(--card)/0.82)_43%,transparent_100%)]" />
      </div>

      <div className="relative z-10">
        <button
          ref={backRef}
          type="button"
          data-spatial-control
          onClick={onBack}
          className="inline-flex h-8 max-w-[calc(100%-3rem)] items-center gap-1.5 rounded-full border border-border bg-background/55 px-2.5 text-[11px] font-medium text-foreground/75 backdrop-blur-md transition-[border-color,background-color,color,transform] hover:border-foreground/20 hover:bg-background/75 hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">Back to {titleName}</span>
        </button>

        <div className="mt-5 flex items-end gap-4">
          <div className="relative aspect-[2/3] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/60 shadow-[0_18px_38px_-22px_rgba(0,0,0,0.85)]">
            {photo ? (
              <Image
                src={photo}
                alt=""
                fill
                sizes="84px"
                loading="eager"
                className="object-cover object-top"
              />
            ) : (
              <span className="grid h-full place-items-center font-mono text-sm text-muted-foreground">
                {name
                  .split(" ")
                  .map((part) => part[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")}
              </span>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary/75">
              {source}
              {person.subtitle ? ` · ${person.subtitle}` : ""}
            </p>
            <h3 className="mt-2 text-balance text-[1.65rem] font-semibold leading-[0.98] tracking-[-0.04em] text-foreground">
              {name}
            </h3>
            {detail?.knownForDepartment ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {detail.knownForDepartment}
              </p>
            ) : null}
          </div>
        </div>

        {loading ? <PersonDetailLoading /> : null}

        {error ? (
          <div className="mt-7 rounded-2xl border border-border bg-background/45 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-3 inline-flex h-8 items-center rounded-full bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-transform active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && detail ? (
          <>
            {(birthday || detail.placeOfBirth) && (
              <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {birthday ? <span>{birthday}</span> : null}
                {birthday && detail.placeOfBirth ? <span>·</span> : null}
                {detail.placeOfBirth ? <span>{detail.placeOfBirth}</span> : null}
              </div>
            )}

            {detail.biography ? (
              <div className="mt-5 space-y-3 text-[13px] leading-relaxed text-foreground/75">
                {detail.biography.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
                No biography is available yet.
              </p>
            )}

            <PersonKnownForRail items={detail.knownFor} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function DetailRecommendations({
  title,
  items,
}: {
  title: string;
  items: PublicSpatialRecommendation[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="-mx-5 mt-8 sm:-mx-6">
      <h4 className="text-balance px-5 text-sm font-semibold leading-snug tracking-[-0.02em] text-foreground/90 sm:px-6">
        If you liked {title}&hellip;
      </h4>
      <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2 sm:px-6">
        {items.map((item) => {
          const image = posterUrl(item.posterPath, "w342");
          const year = formatYear(item.releaseDate);
          return (
            <Link
              key={`${item.mediaType}-${item.tmdbId}`}
              href={`/discover/${item.mediaType}/${item.tmdbId}`}
              prefetch={false}
              className="group w-[5.75rem] shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <span className="relative block aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted/50 transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/45 group-hover:shadow-[0_16px_36px_-20px_hsl(var(--primary)/0.6)]">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="92px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                  />
                ) : (
                  <span className="grid h-full place-items-center px-2 text-center text-[9px] text-muted-foreground">
                    {item.title}
                  </span>
                )}
              </span>
              <span className="mt-1.5 block truncate text-[10px] font-medium text-foreground/80">
                {item.title}
              </span>
              {year ? (
                <span className="mt-0.5 block font-mono text-[8px] text-muted-foreground">
                  {year}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TitleDetailDismissLayer({
  onDismiss,
  style,
}: {
  onDismiss: () => void;
  style?: React.CSSProperties;
}) {
  const consumeGesture = React.useCallback(
    (event: React.SyntheticEvent<HTMLDivElement>) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <div
      data-spatial-dismiss-layer
      aria-hidden
      className="fixed inset-0 z-[55] cursor-default touch-none select-none"
      style={style}
      onPointerDown={consumeGesture}
      onPointerUp={consumeGesture}
      onPointerCancel={(event) => {
        event.stopPropagation();
        onDismiss();
      }}
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    />
  );
}

function TitleDetailSlab({
  title,
  detail,
  loading,
  error,
  renderActions,
  onClose,
  className,
  contentClassName,
  entryOffsetX = 28,
  maxContentHeight,
}: {
  title: TitleRow;
  detail: PublicSpatialTitleDetail | null;
  loading: boolean;
  error: string | null;
  renderActions?: TitleDetailActionsRenderer;
  onClose?: () => void;
  className?: string;
  contentClassName?: string;
  entryOffsetX?: number;
  maxContentHeight?: number;
}) {
  const resolvedTitle = detail?.resolvedTitle
    ? { ...title, ...detail.resolvedTitle }
    : title;
  const year = formatYear(resolvedTitle.release_date);
  const runtime = formatRuntime(resolvedTitle.runtime);
  const imdb = formatImdbRating(resolvedTitle.imdb_rating);
  const rt = formatRtScore(resolvedTitle.rt_score);
  const metacritic = formatMetacriticScore(resolvedTitle.metacritic_score);
  const shelf = shelfPresentation(resolvedTitle);
  const ShelfIcon = shelf.icon;
  const sentiment = sentimentPresentation(resolvedTitle);
  const SentimentIcon = sentiment?.icon;
  const summary =
    detail?.summary || resolvedTitle.omdb_plot || resolvedTitle.overview;
  const backdrop =
    backdropUrl(resolvedTitle.backdrop_path, "w780") ??
    posterUrl(resolvedTitle.poster_path, "w500");
  const [selectedPerson, setSelectedPerson] = React.useState<{
    person: PublicSpatialPerson;
    source: "Cast" | "Crew";
  } | null>(null);
  const returnFocusRef = React.useRef<HTMLButtonElement | null>(null);

  const openPerson = React.useCallback(
    (
      person: PublicSpatialPerson,
      source: "Cast" | "Crew",
      trigger: HTMLButtonElement,
    ) => {
      returnFocusRef.current = trigger;
      setSelectedPerson({ person, source });
    },
    [],
  );

  const returnToTitle = React.useCallback(() => {
    setSelectedPerson(null);
    window.setTimeout(() => {
      const trigger = returnFocusRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }, 210);
  }, []);

  React.useEffect(() => {
    if (!selectedPerson) return;
    const handlePersonEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      returnToTitle();
    };
    window.addEventListener("keydown", handlePersonEscape, { capture: true });
    return () => {
      window.removeEventListener("keydown", handlePersonEscape, {
        capture: true,
      });
    };
  }, [returnToTitle, selectedPerson]);

  return (
    <motion.div
      data-spatial-control
      initial={{ opacity: 0, x: entryOffsetX, rotateY: -5 }}
      animate={{ opacity: 1, x: 0, rotateY: -1.5 }}
      exit={{ opacity: 0, x: entryOffsetX * 0.7 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
      className={cn(
        "pointer-events-auto relative isolate w-[min(84vw,27rem)] overflow-hidden rounded-[1.65rem] border border-border bg-card text-left text-card-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06),0_40px_110px_-34px_rgba(15,23,42,0.34)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_40px_110px_-34px_rgba(0,0,0,0.98)]",
        className,
      )}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        data-title-detail-backdrop
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[21rem] overflow-hidden"
      >
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="(max-width: 639px) 84vw, 27rem"
            loading="eager"
            className="scale-[1.015] object-cover object-center opacity-60 saturate-[1.08]"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--card) / 0.96) 0%, hsl(var(--card) / 0.79) 38%, hsl(var(--card) / 0.38) 68%, hsl(var(--card) / 0.22) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, hsl(var(--card)) 0%, hsl(var(--card) / 0.92) 18%, hsl(var(--card) / 0.42) 52%, transparent 88%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top right, hsl(var(--primary) / 0.13), transparent 62%)",
          }}
        />
      </div>
      {onClose ? (
        <button
          type="button"
          data-spatial-control
          aria-label={
            selectedPerson ? "Close person details" : "Close title details"
          }
          onClick={onClose}
          className="absolute right-3 top-3 z-30 grid h-11 w-11 place-items-center rounded-full border border-border bg-background/70 text-foreground/75 shadow-[0_12px_32px_-14px_rgba(0,0,0,0.35)] backdrop-blur-md transition-[border-color,background-color,color,transform] duration-150 hover:border-foreground/25 hover:bg-background/90 hover:text-foreground active:scale-[0.96] md:hidden"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <motion.div
        data-spatial-control
        aria-hidden={selectedPerson ? true : undefined}
        inert={selectedPerson ? true : undefined}
        animate={
          selectedPerson
            ? { x: -18, opacity: 0.42, scale: 0.985 }
            : { x: 0, opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "scrollbar-hide relative z-10 overflow-y-auto overscroll-contain p-5 sm:p-6",
          selectedPerson && "pointer-events-none",
          contentClassName,
        )}
        style={{
          touchAction: "pan-x pan-y",
          transformOrigin: "left center",
          maxHeight: maxContentHeight
            ? `${maxContentHeight}px`
            : "min(69dvh, 43rem)",
        }}
      >
        <div className="min-w-0 pr-14 md:pr-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/75">
            {resolvedTitle.media_type === "movie" ? "Film" : "Series"}
          </p>
          <h3 className="mt-2 text-balance text-2xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-[2rem]">
            {resolvedTitle.title}
          </h3>
        </div>

        {detail?.tagline ? (
          <p className="mt-3 text-sm italic leading-relaxed text-muted-foreground">
            {detail.tagline}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {runtime ? <span className="text-foreground/85">{runtime}</span> : null}
          {year ? <span>{year}</span> : null}
          {resolvedTitle.genres?.slice(0, 2).map((genre) => (
            <span key={genre.id}>{genre.name}</span>
          ))}
        </div>

        {(imdb || rt || metacritic) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {imdb ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background/55 px-2.5 text-[11px] text-foreground/85">
                <ImdbBadge className="h-3 w-auto" />
                <span className="font-mono">{imdb}</span>
              </span>
            ) : null}
            {rt ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background/55 px-2.5 text-[11px] text-foreground/85">
                <RottenTomatoesBadge score={resolvedTitle.rt_score} className="h-3 w-auto" />
                <span className="font-mono">{rt}</span>
              </span>
            ) : null}
            {metacritic ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background/55 px-2.5 text-[11px] text-foreground/85">
                <MetacriticBadge score={resolvedTitle.metacritic_score} className="h-3 w-auto" />
                <span className="font-mono">{metacritic}</span>
              </span>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {renderActions ? (
            renderActions(resolvedTitle, detail)
          ) : (
            <>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-medium text-primary-foreground">
                <ShelfIcon className="h-3.5 w-3.5" />
                {shelf.label}
              </span>
              {sentiment && SentimentIcon ? (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background/55 px-3 text-[11px] font-medium text-foreground/85">
                  <SentimentIcon
                    className={cn("h-3.5 w-3.5", sentiment.className)}
                  />
                  {sentiment.label}
                </span>
              ) : null}
            </>
          )}
          {detail?.trailerKey ? (
            <TrailerButton
              trailerKey={detail.trailerKey}
              titleName={resolvedTitle.title}
            />
          ) : null}
          {detail?.watchProviders?.providers.length ? (
            <WatchProvidersButton
              providers={detail.watchProviders.providers.map((provider) => ({
                provider_id: provider.id,
                provider_name: provider.name,
                logo_path: provider.logoPath,
              }))}
              link={detail.watchProviders.link}
              titleName={resolvedTitle.title}
              presentation="inline"
            />
          ) : null}
        </div>

        {loading ? <DetailLoading /> : null}
        {error ? (
          <p className="mt-6 rounded-xl border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
            {error}
          </p>
        ) : null}

        {!loading && !error && summary ? (
          <div className="mt-6 space-y-3 text-[13px] leading-relaxed text-foreground/75">
            {summary.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {!loading && detail?.directedBy.length ? (
          <p className="mt-5 text-xs text-muted-foreground">
            <span className="text-foreground/85">
              {resolvedTitle.media_type === "movie"
                ? "Directed by"
                : "Created by"}
            </span>{" "}
            {detail.directedBy.join(", ")}
          </p>
        ) : null}

        {!loading && detail?.cast.length ? (
          <DetailPeopleRail
            label="Cast"
            people={detail.cast}
            onSelect={openPerson}
          />
        ) : null}

        {!loading && detail?.crew.length ? (
          <DetailPeopleRail
            label="Crew"
            people={detail.crew}
            onSelect={openPerson}
          />
        ) : null}

        {resolvedTitle.review ? (
          <section className="mt-7 rounded-2xl border border-border bg-muted/40 p-4">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Note
            </h4>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/75">
              {resolvedTitle.review}
            </p>
          </section>
        ) : null}

        {!loading && detail?.recommendations?.length ? (
          <DetailRecommendations
            title={resolvedTitle.title}
            items={detail.recommendations}
          />
        ) : null}
      </motion.div>

      <AnimatePresence initial={false}>
        {selectedPerson ? (
          <motion.div
            key={selectedPerson.person.id}
            data-spatial-control
            role="region"
            aria-label={`${selectedPerson.person.name} profile`}
            initial={{ x: "100%", opacity: 0.65 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.65 }}
            transition={{ duration: 0.21, ease: [0.22, 1, 0.36, 1] }}
            className="scrollbar-hide absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-card"
            style={{
              touchAction: "pan-x pan-y",
              maxHeight: maxContentHeight
                ? `${maxContentHeight}px`
                : "min(69dvh, 43rem)",
            }}
          >
            <PersonDetailPanel
              person={selectedPerson.person}
              source={selectedPerson.source}
              titleName={resolvedTitle.title}
              onBack={returnToTitle}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function resolveScrollableElement(id?: string) {
  if (!id) return null;
  const element = document.getElementById(id);
  if (!element) return null;
  const lockedByInspector =
    element.dataset.spatialInspectorScrollLock === "true";
  const lockedOverflow = element.style.overflow;
  if (lockedByInspector) element.style.overflow = "";
  const overflowY = window.getComputedStyle(element).overflowY;
  if (lockedByInspector) element.style.overflow = lockedOverflow;
  // Mobile AppScrollArea is the visual frame even when its current contents
  // are too short to scroll. Desktop Discover switches that same element to
  // overflow-visible, so it correctly falls back to the window there. While
  // the inspector owns the scroll lock, briefly read through its inline
  // overflow:hidden so breakpoint changes still resolve the right frame.
  return overflowY === "auto" || overflowY === "scroll" ? element : null;
}

const TITLE_SLAB_FRAME_INSET = 12;
const TITLE_SLAB_MAX_HEIGHT = 43 * 16;

function resolveVisibleAppDockTop() {
  const dock = document.getElementById("app-bottom-nav");
  if (!dock) return null;
  const rect = dock.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect.top : null;
}

function resolveTitleOverlaySafeAreaInsets() {
  const marker = document.querySelector<HTMLElement>(
    "[data-title-overlay-safe-area]",
  );
  if (!marker) return { left: 0, right: 0, bottom: 0 };
  const style = window.getComputedStyle(marker);
  const number = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    left: number(style.paddingLeft),
    right: number(style.paddingRight),
    bottom: number(style.paddingBottom),
  };
}

function useInertTitleOverlayBackground(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const elements = Array.from(
      new Set(
        [
          document.getElementById("app-top-nav"),
          document.getElementById("app-scroll-area"),
          document.getElementById("app-bottom-nav"),
          document.getElementById("public-collection-controls"),
          ...document.querySelectorAll<HTMLElement>("main"),
        ].filter((element): element is HTMLElement => element !== null),
      ),
    );
    const previous = elements.map((element) => element.inert);
    elements.forEach((element) => {
      element.inert = true;
    });
    return () => {
      elements.forEach((element, index) => {
        element.inert = previous[index];
      });
    };
  }, [active]);
}

const TITLE_DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function titleDialogFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(TITLE_DIALOG_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[inert]"),
  );
}

function trapTitleDialogFocus(
  event: React.KeyboardEvent<HTMLDivElement>,
) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const focusable = titleDialogFocusableElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }

  const active = document.activeElement;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && (active === last || active === dialog)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function useTitleDialogFocus(
  active: boolean,
  dialogRef: React.RefObject<HTMLDivElement | null>,
) {
  React.useLayoutEffect(() => {
    if (!active) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const firstFocusable = dialog
      ? titleDialogFocusableElements(dialog)[0]
      : null;
    (firstFocusable ?? dialog)?.focus({ preventScroll: true });

    return () => {
      window.requestAnimationFrame(() => {
        if (
          previouslyFocused?.isConnected &&
          !previouslyFocused.inert &&
          !previouslyFocused.closest("[inert]")
        ) {
          previouslyFocused.focus({ preventScroll: true });
        }
      });
    };
  }, [active, dialogRef]);
}

function resolveTitleSlabFrame({
  top,
  bottom,
  narrow,
}: {
  top: number;
  bottom: number;
  narrow: boolean;
}) {
  const visualViewport = window.visualViewport;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const viewportBottom = viewportTop + viewportHeight;
  const dockTop = resolveVisibleAppDockTop();
  const hasAppDock = dockTop !== null;
  const safeArea = resolveTitleOverlaySafeAreaInsets();
  const safeBottomTop =
    safeArea.bottom > 0 ? viewportBottom - safeArea.bottom : null;
  const frameInset = narrow || hasAppDock ? TITLE_SLAB_FRAME_INSET : 0;
  const boundedTop = Math.max(top, viewportTop);
  const boundedBottom = Math.min(bottom, viewportBottom);
  const usableTop = boundedTop + frameInset;
  const bottomBoundary = dockTop ?? safeBottomTop;
  const usableBottom =
    bottomBoundary === null
      ? boundedBottom - frameInset
      : Math.min(boundedBottom, bottomBoundary) - TITLE_SLAB_FRAME_INSET;
  const availableVisualHeight = Math.max(0, usableBottom - usableTop);
  const maxContentHeight = Math.max(
    1,
    Math.min(
      viewportHeight * 0.69,
      TITLE_SLAB_MAX_HEIGHT,
      availableVisualHeight,
    ),
  );

  return {
    top: usableTop,
    bottom: usableBottom,
    center: usableTop + availableVisualHeight / 2,
    maxContentHeight,
    hasAppDock,
  };
}

export function CollectionTitleDetailOverlay({
  title,
  detailSource,
  onClose,
  anchorTitleId,
  anchorElementId,
  renderActions,
  scrollContainerId,
  centerAfterId,
}: {
  title: TitleRow;
  detailSource: TitleDetailSource;
  onClose: () => void;
  /** The Shelf source card this slab should sit alongside. */
  anchorTitleId?: string;
  /** Exact source element for repeated catalogue titles in Discover rails. */
  anchorElementId?: string;
  renderActions?: TitleDetailActionsRenderer;
  /** Mobile app content scrolls in a persistent middle region, not the body. */
  scrollContainerId?: string;
  /** Match Space's usable canvas below the collection controls. */
  centerAfterId?: string;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [detail, setDetail] = React.useState<PublicSpatialTitleDetail | null>(
    () => detailSource.getCached(title),
  );
  const [loading, setLoading] = React.useState(
    () => detailSource.getCached(title) === null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [revealReady, setRevealReady] = React.useState(false);
  const [position, setPosition] = React.useState<
    | {
        placement: "center";
        top: number;
        maxContentHeight: number;
        hasAppDock: boolean;
      }
    | {
        left: number;
        top: number;
        width: number;
        placement: "left" | "right";
        maxContentHeight: number;
        hasAppDock: boolean;
      }
    | null
  >(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const dialogVisible = Boolean(
    position && (reducedMotion || revealReady),
  );
  useInertTitleOverlayBackground(dialogVisible);
  useTitleDialogFocus(dialogVisible, dialogRef);
  const frameAnimationRef = React.useRef<
    ReturnType<typeof animateTitleFrameScroll> | null
  >(null);
  const resolveScrollFrame = React.useCallback(
    () => resolveScrollableElement(scrollContainerId),
    [scrollContainerId],
  );

  const resolveAnchorElement = React.useCallback(() => {
    if (anchorElementId) return document.getElementById(anchorElementId);
    if (anchorTitleId) {
      return document.getElementById(`shelf-title-${anchorTitleId}`);
    }
    return null;
  }, [anchorElementId, anchorTitleId]);

  const updatePosition = React.useCallback(() => {
    if (!anchorTitleId && !anchorElementId) {
      setPosition(null);
      return;
    }

    const viewportWidth = window.innerWidth;
    const narrow = viewportWidth < 768;
    const slabWidth = Math.min(viewportWidth * 0.84, 432);
    const scrollContainer = resolveScrollFrame();
    const containerRect = scrollContainer?.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const safeArea = resolveTitleOverlaySafeAreaInsets();
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportRight =
      viewportLeft + (visualViewport?.width ?? window.innerWidth);
    const topAnchor = centerAfterId
      ? document.getElementById(centerAfterId)
      : null;
    const topAnchorRect = topAnchor?.getBoundingClientRect();
    const rawBounds = {
      left: Math.max(
        containerRect?.left ?? 0,
        viewportLeft + safeArea.left,
      ),
      top: Math.max(containerRect?.top ?? 0, topAnchorRect?.bottom ?? 0),
      right: Math.min(
        containerRect?.right ?? window.innerWidth,
        viewportRight - safeArea.right,
      ),
      bottom: containerRect?.bottom ?? window.innerHeight,
    };
    const frame = resolveTitleSlabFrame({
      top: rawBounds.top,
      bottom: rawBounds.bottom,
      narrow,
    });
    const bounds = {
      ...rawBounds,
      top: frame.top,
      bottom: frame.bottom,
    };

    // Space is centered in the collection canvas between the controls and app
    // navigation. Shelf uses that same explicit frame instead of inheriting a
    // different fixed-position containing block.
    if (narrow) {
      setPosition({
        placement: "center",
        top: frame.center,
        maxContentHeight: frame.maxContentHeight,
        hasAppDock: frame.hasAppDock,
      });
      return;
    }

    const source = resolveAnchorElement();
    if (!source) return;

    const rect = source.getBoundingClientRect();
    const edge = 24;
    const gap = 20;
    // A first-row card cannot scroll any higher to vertically frame itself.
    // Keep its inspector inside the usable canvas instead of allowing the
    // upper half of the slab to escape above the viewport.
    const verticalInset = 12;
    const usableHeight = Math.max(
      0,
      bounds.bottom - bounds.top - verticalInset * 2,
    );
    const maxSlabHeight = frame.maxContentHeight;
    const halfSlabHeight = Math.min(maxSlabHeight / 2, usableHeight / 2);
    const minimumCenter = bounds.top + verticalInset + halfSlabHeight;
    const maximumCenter = bounds.bottom - verticalInset - halfSlabHeight;
    const preferredCenter = rect.top + rect.height / 2;
    const verticalCenter =
      minimumCenter <= maximumCenter
        ? Math.min(maximumCenter, Math.max(minimumCenter, preferredCenter))
        : bounds.top + (bounds.bottom - bounds.top) / 2;

    const sideRoom = {
      left: rect.left - bounds.left - gap - edge,
      right: bounds.right - rect.right - gap - edge,
    };

    // Desktop always anchors beside the selected poster. The scroll listener
    // aligns their vertical centers whenever the page can frame the source;
    // first-row inspectors stay safely within the usable canvas instead.
    const placement = sideRoom.right >= sideRoom.left ? "right" : "left";
    const width = Math.min(slabWidth, sideRoom[placement]);
    setPosition({
      left:
        placement === "right"
          ? rect.right + gap
          : rect.left - gap - width,
      top: verticalCenter,
      width,
      placement,
      maxContentHeight: frame.maxContentHeight,
      hasAppDock: frame.hasAppDock,
    });
  }, [
    anchorElementId,
    anchorTitleId,
    centerAfterId,
    resolveAnchorElement,
    resolveScrollFrame,
  ]);

  React.useLayoutEffect(() => {
    updatePosition();
    const scrollTarget = resolveScrollFrame() ?? window;
    const visualViewport = window.visualViewport;
    window.addEventListener("resize", updatePosition);
    scrollTarget?.addEventListener("scroll", updatePosition, { passive: true });
    visualViewport?.addEventListener("resize", updatePosition);
    visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      scrollTarget?.removeEventListener("scroll", updatePosition);
      visualViewport?.removeEventListener("resize", updatePosition);
      visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [resolveScrollFrame, updatePosition]);

  React.useLayoutEffect(() => {
    let cancelled = false;
    let retryFrame: number | null = null;
    let attempts = 0;
    setRevealReady(false);

    const finish = () => {
      if (cancelled) return;
      frameAnimationRef.current = null;
      updatePosition();
      setRevealReady(true);
    };

    const frameSelection = () => {
      if (!anchorTitleId && !anchorElementId) return;
      const source = resolveAnchorElement();
      if (!source) {
        attempts += 1;
        if (attempts < 24) {
          retryFrame = window.requestAnimationFrame(frameSelection);
        }
        return;
      }

      updatePosition();
      const scrollContainer = resolveScrollFrame();
      const containerRect = scrollContainer?.getBoundingClientRect();
      const topAnchorRect = centerAfterId
        ? document.getElementById(centerAfterId)?.getBoundingClientRect()
        : null;
      const rawFrameTop = Math.max(
        containerRect?.top ?? 0,
        topAnchorRect?.bottom ?? 0,
      );
      const rawFrameBottom = containerRect?.bottom ?? window.innerHeight;
      const frame = resolveTitleSlabFrame({
        top: rawFrameTop,
        bottom: rawFrameBottom,
        narrow: window.innerWidth < 768,
      });
      const targetCenter = frame.center;
      const sourceRect = source.getBoundingClientRect();
      const delta = sourceRect.top + sourceRect.height / 2 - targetCenter;
      const current = scrollContainer?.scrollTop ?? window.scrollY;
      const maxScroll = scrollContainer
        ? Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
        : Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight,
          );
      const target = Math.max(0, Math.min(current + delta, maxScroll));
      const applyScroll = (value: number) => {
        if (scrollContainer) scrollContainer.scrollTop = value;
        else window.scrollTo(0, value);
      };

      if (reducedMotion || Math.abs(target - current) <= 2) {
        applyScroll(target);
        finish();
        return;
      }

      frameAnimationRef.current = animateTitleFrameScroll(
        current,
        target,
        applyScroll,
        finish,
      );
    };

    retryFrame = window.requestAnimationFrame(frameSelection);
    return () => {
      cancelled = true;
      if (retryFrame !== null) window.cancelAnimationFrame(retryFrame);
      frameAnimationRef.current?.stop();
      frameAnimationRef.current = null;
    };
  }, [
    anchorTitleId,
    anchorElementId,
    centerAfterId,
    reducedMotion,
    resolveAnchorElement,
    resolveScrollFrame,
    updatePosition,
  ]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  React.useEffect(() => {
    if (!reducedMotion && !revealReady) return;
    const scrollContainer = resolveScrollFrame();
    if (scrollContainer) {
      const previousOverflow = scrollContainer.style.overflow;
      const previousLockOwner =
        scrollContainer.dataset.spatialInspectorScrollLock;
      scrollContainer.dataset.spatialInspectorScrollLock = "true";
      scrollContainer.style.overflow = "hidden";
      return () => {
        scrollContainer.style.overflow = previousOverflow;
        if (previousLockOwner === undefined) {
          delete scrollContainer.dataset.spatialInspectorScrollLock;
        } else {
          scrollContainer.dataset.spatialInspectorScrollLock =
            previousLockOwner;
        }
      };
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [reducedMotion, revealReady, resolveScrollFrame]);

  React.useEffect(() => {
    let current = true;
    const cached = detailSource.getCached(title);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      setError(null);
      return () => {
        current = false;
      };
    }

    setDetail(null);
    setLoading(true);
    setError(null);

    void detailSource
      .load(title)
      .then((nextDetail) => {
        if (current) setDetail(nextDetail);
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Title details are unavailable right now.",
        );
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [detailSource, title]);

  const overlay = (
    <>
      {position ? (
        <TitleDetailDismissLayer onDismiss={onClose} />
      ) : null}
      {position && dialogVisible ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${title.title} details`}
          tabIndex={-1}
          onKeyDown={trapTitleDialogFocus}
          data-spatial-slab
          className={cn(
            "fixed z-[60] origin-center",
            position.placement === "center"
              ? "left-1/2 w-[min(84vw,27rem)] -translate-x-1/2 -translate-y-1/2"
              : "-translate-y-1/2",
          )}
          style={
            position.placement === "center"
              ? { top: position.top }
              : {
                  left: position.left,
                  top: position.top,
                  width: position.width,
                }
          }
        >
          <TitleDetailSlab
            key={title.id}
            title={title}
            detail={detail}
            loading={loading}
            error={error}
            renderActions={renderActions}
            onClose={onClose}
            className="w-full"
            entryOffsetX={28}
            maxContentHeight={position.maxContentHeight}
          />
        </div>
      ) : null}
    </>
  );

  // Keep Shelf inspectors outside internal scroll containers. Mobile Safari
  // otherwise treats the fixed layer as part of deeply scrolled content and
  // can leave only the selected-poster highlight visible.
  return typeof document === "undefined"
    ? null
    : createPortal(overlay, document.body);
}

export function PublicTitleDetailOverlay({
  title,
  username,
  onClose,
  anchorTitleId,
  centerAfterId,
}: {
  title: TitleRow;
  username: string;
  onClose: () => void;
  /** The Shelf source card this slab should sit alongside. */
  anchorTitleId?: string;
  /** Keeps a first-row inspector clear of fixed collection controls. */
  centerAfterId?: string;
}) {
  const detailSource = React.useMemo(
    () => publicTitleDetailSource(username),
    [username],
  );

  return (
    <CollectionTitleDetailOverlay
      title={title}
      detailSource={detailSource}
      onClose={onClose}
      anchorTitleId={anchorTitleId}
      centerAfterId={centerAfterId}
    />
  );
}

export function SpatialPosterGrid({
  titles,
  resultsTransitionKey,
  username,
  detailSource,
  renderActions,
  onExit,
  searchTarget,
  initialCamera,
  onCameraChange,
  centerAfterId,
}: SpatialPosterGridProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const resolvedTitleDetailSource = React.useMemo(
    () =>
      detailSource ??
      (username
        ? publicTitleDetailSource(username)
        : unavailableTitleDetailSource),
    [detailSource, username],
  );
  const [renderedTitles, setRenderedTitles] = React.useState(titles);
  const [resultsTransitionPhase, setResultsTransitionPhase] =
    React.useState<ResultsTransitionPhase>("idle");
  const pendingTitlesRef = React.useRef(titles);
  const incomingCollectionKey = React.useMemo(
    () => titles.map((title) => title.id).join("|"),
    [titles],
  );
  const renderedCollectionKey = React.useMemo(
    () => renderedTitles.map((title) => title.id).join("|"),
    [renderedTitles],
  );
  const incomingResultsTransitionKey =
    resultsTransitionKey ?? incomingCollectionKey;
  const [renderedResultsTransitionKey, setRenderedResultsTransitionKey] =
    React.useState(incomingResultsTransitionKey);
  const pendingResultsTransitionKeyRef = React.useRef(
    incomingResultsTransitionKey,
  );
  const [viewportSize, setViewportSize] = React.useState({
    width: 1280,
    height: 800,
  });
  const [slabFrame, setSlabFrame] = React.useState({
    center: 400,
    maxContentHeight: Math.min(800 * 0.69, TITLE_SLAB_MAX_HEIGHT),
    hasAppDock: false,
    cameraOffsetY: 0,
  });
  const layout = React.useMemo(
    () =>
      spatialLayout(
        renderedTitles.length,
        viewportSize.width,
        viewportSize.height,
      ),
    [renderedTitles.length, viewportSize.height, viewportSize.width],
  );
  const { cells, periodX, periodY, points } = layout;
  const cameraX = useMotionValue(initialCamera?.x ?? 0);
  const cameraY = useMotionValue(initialCamera?.y ?? 0);
  const cameraScale = useMotionValue(
    initialCamera?.scale ?? DESKTOP_CAMERA_SCALE,
  );
  const viewportWidth = useMotionValue(1280);
  const viewportHeight = useMotionValue(800);

  React.useEffect(() => {
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    cameraScale.set(Math.min(cameraScale.get(), MOBILE_CAMERA_SCALE));
  }, [cameraScale]);

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const spatialDialogRef = React.useRef<HTMLDivElement>(null);
  const gestureRef = React.useRef<GestureState | null>(null);
  const draggedRef = React.useRef(false);
  const animationRef = React.useRef<AnimationPlaybackControls[]>([]);
  const detailCacheRef = React.useRef(new Map<string, PublicSpatialTitleDetail>());
  const detailRequestRef = React.useRef(0);
  const handledSearchRequestRef = React.useRef(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [slabOpen, setSlabOpen] = React.useState(false);
  const slabRevealTimerRef = React.useRef<number | null>(null);
  const [detail, setDetail] = React.useState<PublicSpatialTitleDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  React.useEffect(() => {
    pendingTitlesRef.current = titles;
    pendingResultsTransitionKeyRef.current = incomingResultsTransitionKey;
  }, [incomingResultsTransitionKey, titles]);

  React.useEffect(() => {
    if (reducedMotion) {
      setRenderedTitles(pendingTitlesRef.current);
      setRenderedResultsTransitionKey(incomingResultsTransitionKey);
      setResultsTransitionPhase("idle");
      return;
    }

    // Collection mutations keep the filter key stable. Reconcile those into
    // the one mounted poster world without dimming every existing title.
    if (incomingResultsTransitionKey === renderedResultsTransitionKey) {
      if (renderedTitles !== titles) setRenderedTitles(titles);
      if (resultsTransitionPhase !== "idle") {
        setResultsTransitionPhase("idle");
      }
      return;
    }

    // A filter can change without changing membership. Update metadata and
    // record the new filter state without playing an empty transition.
    if (incomingCollectionKey === renderedCollectionKey) {
      if (renderedTitles !== titles) setRenderedTitles(titles);
      setRenderedResultsTransitionKey(incomingResultsTransitionKey);
      setResultsTransitionPhase("idle");
      return;
    }

    setResultsTransitionPhase("fading-out");
  }, [
    incomingCollectionKey,
    incomingResultsTransitionKey,
    reducedMotion,
    renderedCollectionKey,
    renderedResultsTransitionKey,
    renderedTitles,
    resultsTransitionPhase,
    titles,
  ]);

  const handleResultsTransitionComplete = React.useCallback(() => {
    if (resultsTransitionPhase === "fading-out") {
      setRenderedTitles(pendingTitlesRef.current);
      setRenderedResultsTransitionKey(
        pendingResultsTransitionKeyRef.current,
      );
      setResultsTransitionPhase("fading-in");
      return;
    }
    if (resultsTransitionPhase === "fading-in") {
      setResultsTransitionPhase("idle");
    }
  }, [resultsTransitionPhase]);

  const selectedIndex = selectedId
    ? titles.findIndex((title) => title.id === selectedId)
    : -1;
  const selectedTitle = selectedIndex >= 0 ? titles[selectedIndex] : null;
  const spatialDialogVisible = selectedTitle !== null && slabOpen;
  useInertTitleOverlayBackground(spatialDialogVisible);
  useTitleDialogFocus(spatialDialogVisible, spatialDialogRef);

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
        ? {
            duration: TITLE_FRAME_DURATION_SECONDS,
            ease: TITLE_FRAME_EASE,
          }
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
    (index: number, selectedPoint?: SpatialPoint) => {
      const point = selectedPoint ?? points[index];
      if (!point) return;
      const viewport = viewportWidth.get();
      const compact = viewport < 768;
      const scale = compact ? 0.67 : 0.83;
      const slabWidth = Math.min(viewport * 0.84, 432);
      const slabLeft = compact ? -slabWidth / 2 : -slabWidth * 0.2;
      const slabRight = compact ? slabWidth / 2 : slabWidth * 0.8;
      const currentScale = cameraScale.get();
      const currentScreenX =
        point.x * currentScale +
        wrapCamera(cameraX.get(), periodX * currentScale);
      const placeOnLeft = currentScreenX < (slabLeft + slabRight) / 2;
      const posterRadius = compact ? 46 : 70;
      const overlayGap = compact ? 14 : 24;
      const targetScreenX = placeOnLeft
        ? slabLeft - posterRadius - overlayGap
        : slabRight + posterRadius + overlayGap;
      const targetX = targetScreenX - point.x * scale;
      const targetY = slabFrame.cameraOffsetY - point.y * scale;
      moveCamera(
        nearestRepeatedTarget(targetX, cameraX.get(), periodX * scale),
        nearestRepeatedTarget(targetY, cameraY.get(), periodY * scale),
        scale,
        true,
      );
    },
    [
      cameraScale,
      cameraX,
      cameraY,
      moveCamera,
      periodX,
      periodY,
      points,
      slabFrame.cameraOffsetY,
      viewportWidth,
    ],
  );

  const loadDetail = React.useCallback(
    async (title: TitleRow) => {
      const request = ++detailRequestRef.current;
      const cached =
        detailCacheRef.current.get(title.id) ??
        resolvedTitleDetailSource.getCached(title);
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
        const nextDetail = await resolvedTitleDetailSource.load(title);
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
    [resolvedTitleDetailSource],
  );

  const selectTitle = React.useCallback(
    (title: TitleRow, selectedPoint?: SpatialPoint) => {
      const index = titles.findIndex((candidate) => candidate.id === title.id);
      if (index < 0) return;
      if (slabRevealTimerRef.current !== null) {
        window.clearTimeout(slabRevealTimerRef.current);
        slabRevealTimerRef.current = null;
      }
      setSlabOpen(false);
      setSelectedId(title.id);
      frameTitle(index, selectedPoint);
      if (reducedMotion) {
        setSlabOpen(true);
      } else {
        slabRevealTimerRef.current = window.setTimeout(() => {
          setSlabOpen(true);
          slabRevealTimerRef.current = null;
        }, TITLE_FRAME_REVEAL_DELAY_MS);
      }
      void loadDetail(title);
    },
    [frameTitle, loadDetail, reducedMotion, titles],
  );

  const closeDetail = React.useCallback(() => {
    if (slabRevealTimerRef.current !== null) {
      window.clearTimeout(slabRevealTimerRef.current);
      slabRevealTimerRef.current = null;
    }
    detailRequestRef.current += 1;
    setSlabOpen(false);
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  React.useEffect(() => {
    if (selectedId && selectedIndex < 0) closeDetail();
  }, [closeDetail, selectedId, selectedIndex]);

  React.useEffect(() => {
    if (
      !searchTarget ||
      searchTarget.request === handledSearchRequestRef.current
    ) {
      return;
    }

    handledSearchRequestRef.current = searchTarget.request;
    const title = titles.find((candidate) => candidate.id === searchTarget.titleId);
    if (title) selectTitle(title);
  }, [searchTarget, selectTitle, titles]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (selectedId) {
        closeDetail();
      } else {
        onExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDetail, onExit, selectedId]);

  React.useEffect(
    () => () => {
      stopCamera();
      if (slabRevealTimerRef.current !== null) {
        window.clearTimeout(slabRevealTimerRef.current);
      }
    },
    [stopCamera],
  );

  React.useEffect(
    () => () => {
      onCameraChange?.({
        x: cameraX.get(),
        y: cameraY.get(),
        scale: cameraScale.get(),
      });
    },
    [cameraScale, cameraX, cameraY, onCameraChange],
  );

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const bounds = viewport.getBoundingClientRect();
      const topBoundaryRect = centerAfterId
        ? document.getElementById(centerAfterId)?.getBoundingClientRect()
        : null;
      const frameTop = Math.max(
        bounds.top,
        topBoundaryRect?.bottom ?? bounds.top,
      );
      viewportWidth.set(bounds.width);
      viewportHeight.set(bounds.height);
      const width = Math.round(bounds.width);
      const height = Math.round(bounds.height);
      const nextSlabFrame = resolveTitleSlabFrame({
        top: frameTop,
        bottom: bounds.bottom,
        narrow: bounds.width < 768,
      });
      setViewportSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
      setSlabFrame((current) => {
        const center = Math.round(nextSlabFrame.center);
        const maxContentHeight = Math.round(nextSlabFrame.maxContentHeight);
        const cameraOffsetY = Math.round(
          nextSlabFrame.center - (bounds.top + bounds.height / 2),
        );
        return current.center === center &&
          current.maxContentHeight === maxContentHeight &&
          current.hasAppDock === nextSlabFrame.hasAppDock &&
          current.cameraOffsetY === cameraOffsetY
          ? current
          : {
              center,
              maxContentHeight,
              hasAppDock: nextSlabFrame.hasAppDock,
              cameraOffsetY,
            };
      });
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    const visualViewport = window.visualViewport;
    window.addEventListener("resize", measure);
    visualViewport?.addEventListener("resize", measure);
    visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      visualViewport?.removeEventListener("resize", measure);
      visualViewport?.removeEventListener("scroll", measure);
    };
  }, [centerAfterId, viewportHeight, viewportWidth]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      if (target.closest("[data-spatial-control]")) return;
      stopCamera();
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
        if (!draggedRef.current) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        draggedRef.current = true;
      }
      if (!draggedRef.current) return;
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

  return (
    <>
      <section
        ref={viewportRef}
        className="relative h-full w-full cursor-grab overflow-hidden bg-background text-foreground active:cursor-grabbing"
        style={{ touchAction: "none", perspective: "1150px" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        aria-label="Poster space."
      >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary) / 0.055) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.055) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(circle at center, black 5%, transparent 76%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, hsl(var(--primary) / 0.08), transparent 42%), linear-gradient(to bottom, hsl(var(--background) / 0.18), hsl(var(--background) / 0.72))",
        }}
      />

      <motion.div
        data-spatial-results-layer
        className="absolute inset-0"
        initial={false}
        animate={{
          opacity: resultsTransitionPhase === "fading-out" ? 0.32 : 1,
        }}
        transition={{
          duration:
            resultsTransitionPhase === "fading-out"
              ? reducedMotion
                ? 0
                : 0.14
              : reducedMotion
                ? 0
                : 0.22,
          ease:
            resultsTransitionPhase === "fading-out"
              ? [0.4, 0, 1, 1]
              : [0.16, 1, 0.3, 1],
        }}
        onAnimationComplete={handleResultsTransitionComplete}
        style={{
          pointerEvents:
            resultsTransitionPhase === "idle" ? "auto" : "none",
          willChange: "opacity",
        }}
      >
        {renderedTitles.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground/75">
                No titles match
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Try another filter.</p>
            </div>
          </div>
        ) : null}

        {renderedTitles.length > 0 ? (
          <SpatialPosterWorld
            cells={cells}
            titles={renderedTitles}
            periodX={periodX}
            periodY={periodY}
            selectedId={selectedId}
            reducedMotion={reducedMotion}
            cameraX={cameraX}
            cameraY={cameraY}
            cameraScale={cameraScale}
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
            draggedRef={draggedRef}
            onSelect={selectTitle}
            onClose={closeDetail}
          />
        ) : null}
      </motion.div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            boxShadow:
              "inset 0 0 clamp(120px, 13vw, 190px) clamp(45px, 4vw, 58px) hsl(var(--background))",
          }}
        />
      </section>

      {selectedTitle && typeof document !== "undefined"
        ? createPortal(
            <>
              <TitleDetailDismissLayer onDismiss={closeDetail} />
              {slabOpen ? (
                <div
                  ref={spatialDialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${selectedTitle.title} details`}
                  tabIndex={-1}
                  onKeyDown={trapTitleDialogFocus}
                  data-spatial-slab
                  className="fixed left-1/2 z-[60] origin-center -translate-x-1/2 -translate-y-1/2 md:-translate-x-[20%]"
                  style={{ top: slabFrame.center }}
                >
                  <TitleDetailSlab
                    key={selectedTitle.id}
                    title={selectedTitle}
                    detail={detail}
                    loading={detailLoading}
                    error={detailError}
                    renderActions={renderActions}
                    onClose={closeDetail}
                    maxContentHeight={slabFrame.maxContentHeight}
                  />
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
