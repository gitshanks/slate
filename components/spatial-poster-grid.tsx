"use client";

import * as React from "react";
import Image from "next/image";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import {
  Check,
  Clock,
  Eye,
  Heart,
  ThumbsDown,
  ThumbsUp,
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
  onExit: () => void;
  searchTarget: { titleId: string; request: number } | null;
  initialCamera?: SpatialCameraState;
  onCameraChange?: (camera: SpatialCameraState) => void;
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
    label: "Watchlist",
    icon: Clock,
    borderClass: "border-white/12",
    hoverBorderClass: "group-hover:border-white/35",
    metaClass: "text-white/42",
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
  onSelect: (title: TitleRow) => void;
  onClose: () => void;
}) {
  const isPresent = useIsPresent();
  const point = cell.point;
  const src = posterUrl(title.poster_path, "w500");
  const selected = title.id === selectedId;
  const shelf = shelfPresentation(title);
  const PosterShelfIcon = shelf.icon;
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
      className={cn("absolute", !isPresent && "pointer-events-none")}
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
          if (!isPresent || draggedRef.current) return;
          if (selectedId === title.id) {
            onClose();
            return;
          }
          onSelect(title);
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
        tabIndex={cell.canonical && isPresent ? 0 : -1}
        aria-hidden={cell.canonical && isPresent ? undefined : true}
        aria-label={`Open ${title.title} details. ${shelf.label}.`}
      >
        <span
          className={cn(
            "relative block aspect-[2/3] overflow-hidden rounded-[1rem] border bg-white/[0.035] shadow-[0_28px_65px_-28px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-300",
            selected
              ? "border-primary/80 shadow-[0_0_0_4px_rgba(173,235,179,0.1),0_34px_90px_-28px_rgba(173,235,179,0.45)]"
              : [shelf.borderClass, shelf.hoverBorderClass],
          )}
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
            <span className="grid h-full place-items-center p-4 text-center text-xs text-white/45">
              {title.title}
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </span>
        <span className="mt-2.5 block truncate text-[12px] font-medium text-white/82">
          {title.title}
        </span>
        <span
          className={cn(
            "mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em]",
            shelf.metaClass,
          )}
        >
          <PosterShelfIcon className="h-2.5 w-2.5" aria-hidden />
          <span>{shelf.label}</span>
          {formatYear(title.release_date) ? (
            <span className="ml-auto text-white/28">
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
  onSelect: (title: TitleRow) => void;
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
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        transition: {
          duration: reducedMotion ? 0.1 : 0.24,
          ease: [0.23, 1, 0.32, 1],
        },
      }}
      exit={{
        opacity: 0,
        transition: {
          duration: reducedMotion ? 0.08 : 0.18,
          ease: [0.23, 1, 0.32, 1],
        },
      }}
      style={{
        x: wrappedCameraX,
        y: wrappedCameraY,
        scale: cameraScale,
        transformStyle: "preserve-3d",
        willChange: "transform, opacity",
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
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/10" />
      <div className="space-y-2">
        <div className="h-2.5 w-full animate-pulse rounded-full bg-white/8" />
        <div className="h-2.5 w-[92%] animate-pulse rounded-full bg-white/8" />
        <div className="h-2.5 w-[68%] animate-pulse rounded-full bg-white/8" />
      </div>
      <div className="flex gap-3 pt-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-white/8" />
            <div className="h-2 w-12 animate-pulse rounded-full bg-white/8" />
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
}: {
  title: TitleRow;
  detail: PublicSpatialTitleDetail | null;
  loading: boolean;
  error: string | null;
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
      className="dark pointer-events-auto isolate w-[min(84vw,27rem)] overflow-hidden rounded-[1.65rem] border border-white/15 bg-[#070807]/95 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_40px_110px_-34px_rgba(0,0,0,0.98)] backdrop-blur-2xl"
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        data-spatial-control
        className="scrollbar-hide max-h-[min(69dvh,43rem)] overflow-y-auto overscroll-contain p-5 sm:p-6"
        style={{ touchAction: "pan-y" }}
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/75">
            {title.media_type === "movie" ? "Film" : "Series"}
          </p>
          <h3 className="mt-2 text-balance text-2xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-[2rem]">
            {title.title}
          </h3>
        </div>

        {detail?.tagline ? (
          <p className="mt-3 text-sm italic leading-relaxed text-white/58">
            {detail.tagline}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[10px] uppercase tracking-[0.08em] text-white/55">
          {runtime ? <span className="text-white/82">{runtime}</span> : null}
          {year ? <span>{year}</span> : null}
          {title.genres?.slice(0, 2).map((genre) => (
            <span key={genre.id}>{genre.name}</span>
          ))}
        </div>

        {(imdb || rt || metacritic) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {imdb ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 text-[11px] text-white/85">
                <ImdbBadge className="h-3 w-auto" />
                <span className="font-mono">{imdb}</span>
              </span>
            ) : null}
            {rt ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 text-[11px] text-white/85">
                <RottenTomatoesBadge score={title.rt_score} className="h-3 w-auto" />
                <span className="font-mono">{rt}</span>
              </span>
            ) : null}
            {metacritic ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 text-[11px] text-white/85">
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
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 text-[11px] font-medium text-white/85">
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
          <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.045] p-3 text-sm text-white/65">
            {error}
          </p>
        ) : null}

        {!loading && !error && summary ? (
          <div className="mt-6 space-y-3 text-[13px] leading-relaxed text-white/74">
            {summary.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {!loading && detail?.directedBy.length ? (
          <p className="mt-5 text-xs text-white/55">
            <span className="text-white/85">
              {title.media_type === "movie" ? "Directed by" : "Created by"}
            </span>{" "}
            {detail.directedBy.join(", ")}
          </p>
        ) : null}

        {!loading && detail?.cast.length ? (
          <section className="mt-7">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
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
                        <span className="grid h-full place-items-center font-mono text-[10px] text-white/35">
                          {person.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[10px] leading-tight text-white/75">
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
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
              Note
            </h4>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">
              {title.review}
            </p>
          </section>
        ) : null}
      </div>
    </motion.div>
  );
}

export function SpatialPosterGrid({
  titles,
  username,
  onExit,
  searchTarget,
  initialCamera,
  onCameraChange,
}: SpatialPosterGridProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [viewportSize, setViewportSize] = React.useState({
    width: 1280,
    height: 800,
  });
  const layout = React.useMemo(
    () => spatialLayout(titles.length, viewportSize.width, viewportSize.height),
    [titles.length, viewportSize.height, viewportSize.width],
  );
  const collectionKey = React.useMemo(
    () => titles.map((title) => title.id).join("|"),
    [titles],
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
  const gestureRef = React.useRef<GestureState | null>(null);
  const draggedRef = React.useRef(false);
  const animationRef = React.useRef<AnimationPlaybackControls[]>([]);
  const detailCacheRef = React.useRef(new Map<string, PublicSpatialTitleDetail>());
  const detailRequestRef = React.useRef(0);
  const handledSearchRequestRef = React.useRef(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PublicSpatialTitleDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const selectedIndex = selectedId
    ? titles.findIndex((title) => title.id === selectedId)
    : -1;
  const selectedTitle = selectedIndex >= 0 ? titles[selectedIndex] : null;

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
      const slabMidpointOffset = narrow ? 180 : 205;
      const scale = narrow ? 0.67 : 0.83;
      const targetX = -(point.x + slabMidpointOffset) * scale;
      const targetY = -point.y * scale;
      moveCamera(
        nearestRepeatedTarget(targetX, cameraX.get(), periodX * scale),
        nearestRepeatedTarget(targetY, cameraY.get(), periodY * scale),
        scale,
        true,
      );
    },
    [cameraX, cameraY, moveCamera, periodX, periodY, points],
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
    (title: TitleRow, shouldFrame = false) => {
      const index = titles.findIndex((candidate) => candidate.id === title.id);
      if (index < 0) return;
      setSelectedId(title.id);
      if (shouldFrame) frameTitle(index);
      void loadDetail(title);
    },
    [frameTitle, loadDetail, titles],
  );

  const closeDetail = React.useCallback(() => {
    detailRequestRef.current += 1;
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
    if (title) selectTitle(title, true);
  }, [searchTarget, selectTitle, titles]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedId) {
        closeDetail();
      } else {
        onExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDetail, onExit, selectedId]);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

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
      viewportWidth.set(bounds.width);
      viewportHeight.set(bounds.height);
      const width = Math.round(bounds.width);
      const height = Math.round(bounds.height);
      setViewportSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewportHeight, viewportWidth]);

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
        className="relative h-full w-full cursor-grab overflow-hidden bg-[#080a09] text-white active:cursor-grabbing"
        style={{ touchAction: "none", perspective: "1150px" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        aria-label="Poster space. Drag to explore."
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

      <p
        className="pointer-events-none absolute left-4 z-40 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 sm:left-6 sm:text-[10px]"
        style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        Drag to explore · Search to travel
      </p>

      <AnimatePresence initial={false}>
        {titles.length === 0 ? (
          <motion.div
            key="empty-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.1 : 0.2 }}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-6 text-center"
          >
            <div>
              <p className="text-sm font-medium text-white/72">
                No titles match
              </p>
              <p className="mt-1 text-xs text-white/38">Try another filter.</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="sync">
        {titles.length > 0 ? (
          <SpatialPosterWorld
            key={collectionKey}
            cells={cells}
            titles={titles}
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
      </AnimatePresence>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_120px_45px_#080a09] sm:shadow-[inset_0_0_190px_58px_#080a09]"
        />
      </section>

      {selectedTitle ? (
        <>
          <div
            data-spatial-dismiss-layer
            aria-hidden
            className="fixed inset-0 z-[55] cursor-default"
            onClick={closeDetail}
          />
          <div
            data-spatial-slab
            className="fixed left-1/2 top-1/2 z-[60] origin-center -translate-x-1/2 -translate-y-1/2 scale-[0.86] sm:-translate-x-[20%] sm:scale-100"
          >
            <TitleDetailSlab
              key={selectedTitle.id}
              title={selectedTitle}
              detail={detail}
              loading={detailLoading}
              error={detailError}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
