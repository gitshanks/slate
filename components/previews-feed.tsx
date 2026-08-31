"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  LoaderCircle,
  Mouse,
  Pause,
  Play,
  Plus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { AddTitleToListButton } from "@/components/add-title-to-list-button";
import { useDiscoverTitleOverlay } from "@/components/discover-title-overlay-context";
import { StatusPill } from "@/components/status-pill";
import { addTitle, loadMorePreviews } from "@/lib/actions";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import type { TmdbPreviewItem, TmdbPreviewSource } from "@/lib/tmdb";
import type { TitleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PreviewsFeedProps {
  items: TmdbPreviewItem[];
  attemptedKeys: string[];
  lists: { id: string; name: string }[];
  playerOrigin?: string;
}

interface SavedRecord {
  id: string;
  status: TitleStatus;
}

interface YouTubePlayerInstance {
  cueVideoById(videoId: string, startSeconds?: number): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
  getVideoData(): { video_id?: string };
  loadVideoById(videoId: string, startSeconds?: number): void;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  unMute(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayerInstance;
}

interface YouTubePlayerStateEvent extends YouTubePlayerEvent {
  data: number;
}

interface YouTubePlayerOptions {
  events: {
    onAutoplayBlocked?: () => void;
    onError?: () => void;
    onReady: (event: YouTubePlayerEvent) => void;
    onStateChange?: (event: YouTubePlayerStateEvent) => void;
  };
  host?: string;
  height?: number | string;
  playerVars: Record<string, number | string>;
  videoId: string;
  width?: number | string;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
}

interface YouTubePlayerHandle {
  mute(): void;
  pause(): void;
  play(): void;
  unmuteAndPlay(): void;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SOURCE_LABELS: Record<TmdbPreviewSource, string> = {
  library: "Based on your library",
  trending: "Trending this week",
  now_playing: "Now playing",
};

const SOURCE_TONES: Record<TmdbPreviewSource, string> = {
  library: "border-primary/25 bg-primary/12 text-primary",
  trending:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  now_playing:
    "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200",
};

const PREVIEW_LOAD_AHEAD = 6;
const PREVIEW_MAX_RENDERED = 48;
const PREVIEW_KEEP_BEHIND = 12;
const PREVIEW_HISTORY_LIMIT = 240;
const PREVIEW_REPLAY_GAP = 36;
const PREVIEW_LOAD_RETRY_MS = 1_800;
const PREVIEW_MAX_AUTOMATIC_RETRIES = 3;
const PREVIEW_DESKTOP_HINT_KEY = "slate:previews-desktop-scroll-hint";

interface KeyHistory {
  order: string[];
  keys: Set<string>;
}

function rememberHistoryKeys(history: KeyHistory, keys: readonly string[]) {
  for (const key of keys) {
    if (history.keys.has(key)) {
      const previousIndex = history.order.indexOf(key);
      if (previousIndex >= 0) history.order.splice(previousIndex, 1);
    } else {
      history.keys.add(key);
    }
    history.order.push(key);
  }
  while (history.order.length > PREVIEW_HISTORY_LIMIT) {
    const expired = history.order.shift();
    if (expired) history.keys.delete(expired);
  }
}

function createKeyHistory(keys: readonly string[]): KeyHistory {
  const history: KeyHistory = { order: [], keys: new Set() };
  rememberHistoryKeys(history, keys);
  return history;
}

function rememberArchiveItems(
  archive: Map<string, TmdbPreviewItem>,
  items: readonly TmdbPreviewItem[],
) {
  for (const item of items) {
    const key = itemKey(item);
    archive.delete(key);
    archive.set(key, item);
  }
  while (archive.size > PREVIEW_HISTORY_LIMIT) {
    const oldestKey = archive.keys().next().value;
    if (typeof oldestKey !== "string") break;
    archive.delete(oldestKey);
  }
}

// TMDB's stable genre IDs. Kept client-local so the feed never imports the
// server-only AI search module simply to render one concise genre label.
const MOVIE_GENRE_NAMES = new Map<number, string>([
  [28, "Action"],
  [12, "Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [14, "Fantasy"],
  [36, "History"],
  [27, "Horror"],
  [10402, "Music"],
  [9648, "Mystery"],
  [10749, "Romance"],
  [878, "Science Fiction"],
  [53, "Thriller"],
  [10752, "War"],
  [37, "Western"],
]);
const TV_GENRE_NAMES = new Map<number, string>([
  [10759, "Action & Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [10762, "Kids"],
  [9648, "Mystery"],
  [10764, "Reality"],
  [10765, "Sci-Fi & Fantasy"],
  [10766, "Soap"],
  [10767, "Talk"],
  [10768, "War & Politics"],
  [37, "Western"],
]);

function itemKey(item: Pick<TmdbPreviewItem, "id" | "media_type">) {
  return `${item.media_type}:${item.id}`;
}

function titleFor(item: TmdbPreviewItem) {
  return item.title || item.name || "Untitled";
}

function yearFor(item: TmdbPreviewItem) {
  const date = item.release_date || item.first_air_date || "";
  return date.slice(0, 4);
}

function primaryGenre(item: TmdbPreviewItem) {
  const genreId = item.genre_ids?.[0];
  if (!genreId) return null;
  const table = item.media_type === "movie" ? MOVIE_GENRE_NAMES : TV_GENRE_NAMES;
  const name = table.get(genreId);
  if (!name) return null;
  return name;
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useDesktopScrollHint() {
  const [visible, setVisible] = React.useState(false);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    try {
      window.sessionStorage.setItem(PREVIEW_DESKTOP_HINT_KEY, "seen");
    } catch {
      // Private browsing can make sessionStorage unavailable. The hint still
      // works for the current render and simply returns next time.
    }
  }, []);

  React.useEffect(() => {
    const finePointer = window.matchMedia(
      "(min-width: 64rem) and (hover: hover) and (pointer: fine)",
    );
    let alreadySeen = false;
    try {
      alreadySeen =
        window.sessionStorage.getItem(PREVIEW_DESKTOP_HINT_KEY) === "seen";
    } catch {
      // See the storage note in dismiss().
    }
    if (!finePointer.matches || alreadySeen) return;

    const frame = window.requestAnimationFrame(() => setVisible(true));
    const timer = window.setTimeout(dismiss, 6_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [dismiss]);

  return { dismiss, visible };
}

function useBlockingOverlayOpen() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const selector = [
      ".smart-search-inline-results",
      '[role="dialog"][data-state="open"]',
      '[role="menu"][data-state="open"]',
    ].join(",");
    const update = () => setOpen(Boolean(document.querySelector(selector)));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => observer.disconnect();
  }, []);

  return open;
}

function useAvailableFeedHeight(hostRef: React.RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = React.useState<number | null>(null);
  const [usableHeight, setUsableHeight] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportBottom = viewport
          ? viewport.offsetTop + viewport.height
          : window.innerHeight;
        const dock = document.getElementById("app-bottom-nav");
        const dockRect = dock?.getBoundingClientRect();
        const dockIsVisible = Boolean(
          dockRect && dockRect.height > 0 && dockRect.top > rect.top,
        );
        const dockClearance = dockIsVisible
          ? Math.max(8, viewportBottom - dockRect!.top + 8)
          : 12;
        // The preview artwork is the page background, so let it continue all
        // the way behind the floating dock. Each slide reserves its own
        // interactive clearance; clipping the host at dock.top created the
        // full-width black shelf visible beneath the feed.
        host.style.setProperty(
          "--preview-dock-clearance",
          `${Math.ceil(dockClearance)}px`,
        );
        const nextHeight = Math.max(0, Math.floor(viewportBottom - rect.top));
        setHeight(nextHeight);
        setUsableHeight(
          Math.max(0, nextHeight - Math.ceil(dockClearance)),
        );
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    const dock = document.getElementById("app-bottom-nav");
    if (dock) observer.observe(dock);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [hostRef]);

  return { height, usableHeight };
}

function useFloatingPlayerGeometry({
  hostRef,
  scrollerRef,
  playerShellRef,
  desktopNavigationRef,
  activeIndex,
  navigationIndex,
  visible,
  frameHeight,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  playerShellRef: React.RefObject<HTMLDivElement | null>;
  desktopNavigationRef: React.RefObject<HTMLDivElement | null>;
  activeIndex: number | null;
  navigationIndex: number;
  visible: boolean;
  frameHeight: number | null;
}) {
  React.useLayoutEffect(() => {
    const host = hostRef.current;
    const scroller = scrollerRef.current;
    const shell = playerShellRef.current;
    const desktopNavigation = desktopNavigationRef.current;
    if (!host || !scroller || !shell) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const target =
        activeIndex == null
          ? null
          : scroller.querySelector<HTMLElement>(
              `[data-preview-player-index="${activeIndex}"]`,
            );
      const navigationTarget = scroller.querySelector<HTMLElement>(
        `[data-preview-player-index="${navigationIndex}"]`,
      );

      if (desktopNavigation) {
        if (!navigationTarget) {
          desktopNavigation.style.visibility = "hidden";
        } else {
          const hostRect = host.getBoundingClientRect();
          const targetRect = navigationTarget.getBoundingClientRect();
          const navigationWidth = desktopNavigation.offsetWidth;
          const navigationHeight = desktopNavigation.offsetHeight;
          const navigationGap = 8;
          const rightRoom = hostRect.right - targetRect.right;
          const leftRoom = targetRect.left - hostRect.left;
          let navigationLeft: number | null = null;

          if (rightRoom >= navigationWidth + navigationGap) {
            navigationLeft =
              targetRect.right - hostRect.left + navigationGap;
          } else if (leftRoom >= navigationWidth + navigationGap) {
            navigationLeft =
              targetRect.left - hostRect.left - navigationWidth - navigationGap;
          }

          if (navigationLeft == null) {
            desktopNavigation.style.visibility = "hidden";
          } else {
            // Keep the desktop controls still while the snap surface moves
            // beneath them. Following the outgoing slide during wheel travel
            // makes the controls drift, then jump when the next slide wins.
            const navigationTop = Math.max(
              12,
              Math.min(
                hostRect.height - navigationHeight - 12,
                hostRect.height * 0.4 - navigationHeight / 2,
              ),
            );
            desktopNavigation.style.transform = `translate3d(${navigationLeft}px, ${navigationTop}px, 0)`;
            desktopNavigation.style.visibility = "visible";
          }
        }
      }

      if (!visible || !target) {
        shell.style.opacity = "0";
        shell.style.pointerEvents = "none";
        shell.style.visibility = "hidden";
        return;
      }
      const hostRect = host.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      shell.style.width = `${targetRect.width}px`;
      shell.style.height = `${targetRect.height}px`;
      shell.style.transform = `translate3d(${targetRect.left - hostRect.left}px, ${targetRect.top - hostRect.top}px, 0)`;
      shell.style.opacity = "1";
      // Keep the official player interactive. Cross-origin iframe gestures do
      // not bubble to the carousel, so vertical navigation remains available
      // across the much larger ambient and information areas around it.
      shell.style.pointerEvents = "auto";
      shell.style.visibility = "visible";
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    if (desktopNavigation) observer.observe(desktopNavigation);
    if (activeIndex != null) {
      const target = scroller.querySelector<HTMLElement>(
        `[data-preview-player-index="${activeIndex}"]`,
      );
      if (target) observer.observe(target);
    }
    const navigationTarget = scroller.querySelector<HTMLElement>(
      `[data-preview-player-index="${navigationIndex}"]`,
    );
    if (navigationTarget) observer.observe(navigationTarget);
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [
    activeIndex,
    desktopNavigationRef,
    frameHeight,
    hostRef,
    navigationIndex,
    playerShellRef,
    scrollerRef,
    visible,
  ]);
}

const YouTubePreview = React.forwardRef<
  YouTubePlayerHandle,
  {
    videoKey: string;
    title: string;
    soundEnabled: boolean;
    shouldPlay: boolean;
    playerOrigin?: string;
    onAutoplayBlocked: () => void;
    onPlayerReady: () => void;
    onPlaybackError: (videoKey: string) => void;
    onVideoVisible: (videoKey: string) => void;
  }
>(function YouTubePreview(
  {
    videoKey,
    title,
    soundEnabled,
    shouldPlay,
    playerOrigin,
    onAutoplayBlocked,
    onPlayerReady,
    onPlaybackError,
    onVideoVisible,
  },
  forwardedRef,
) {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<YouTubePlayerInstance | null>(null);
  const readyRef = React.useRef(false);
  const loadedVideoRef = React.useRef(videoKey);
  const videoKeyRef = React.useRef(videoKey);
  const soundEnabledRef = React.useRef(soundEnabled);
  const shouldPlayRef = React.useRef(shouldPlay);
  const onAutoplayBlockedRef = React.useRef(onAutoplayBlocked);
  const onPlaybackErrorRef = React.useRef(onPlaybackError);
  const onPlayerReadyRef = React.useRef(onPlayerReady);
  const onVideoVisibleRef = React.useRef(onVideoVisible);
  const titleRef = React.useRef(title);
  const [apiReady, setApiReady] = React.useState(() =>
    Boolean(typeof window !== "undefined" && window.YT?.Player),
  );

  const syncPlayer = React.useCallback(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;

    if (soundEnabledRef.current) player.unMute();
    else player.mute();

    if (loadedVideoRef.current !== videoKeyRef.current) {
      // Cue first without playback. The parent reveals this exact keyed frame
      // after CUED, then a subsequent visible commit is allowed to play it.
      player.cueVideoById(videoKeyRef.current, 0);
      loadedVideoRef.current = videoKeyRef.current;
      return;
    } else if (shouldPlayRef.current) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, []);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      mute() {
        if (readyRef.current) playerRef.current?.mute();
      },
      pause() {
        if (readyRef.current) playerRef.current?.pauseVideo();
      },
      play() {
        if (readyRef.current) playerRef.current?.playVideo();
      },
      unmuteAndPlay() {
        // These calls intentionally happen inside the user's click stack so
        // WebKit can grant audio to this persistent media session.
        if (readyRef.current) {
          playerRef.current?.unMute();
          playerRef.current?.playVideo();
        }
      },
    }),
    [],
  );

  React.useLayoutEffect(() => {
    videoKeyRef.current = videoKey;
    soundEnabledRef.current = soundEnabled;
    shouldPlayRef.current = shouldPlay;
    onAutoplayBlockedRef.current = onAutoplayBlocked;
    onPlayerReadyRef.current = onPlayerReady;
    onPlaybackErrorRef.current = onPlaybackError;
    onVideoVisibleRef.current = onVideoVisible;
    titleRef.current = title;
    syncPlayer();
    const iframe = mountRef.current?.querySelector("iframe");
    iframe?.setAttribute("title", title);
  }, [
    onAutoplayBlocked,
    onPlayerReady,
    onPlaybackError,
    onVideoVisible,
    soundEnabled,
    shouldPlay,
    syncPlayer,
    title,
    videoKey,
  ]);

  React.useEffect(() => {
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    const handleReady = () => {
      previousReady?.();
      setApiReady(Boolean(window.YT?.Player));
    };
    window.onYouTubeIframeAPIReady = handleReady;
    return () => {
      if (window.onYouTubeIframeAPIReady === handleReady) {
        window.onYouTubeIframeAPIReady = previousReady;
      }
    };
  }, []);

  React.useEffect(() => {
    const host = mountRef.current;
    const api = window.YT;
    if (!host || !apiReady || !api?.Player) return;
    const playerMount = document.createElement("div");
    playerMount.style.height = "100%";
    playerMount.style.width = "100%";
    host.replaceChildren(playerMount);

    const playerVars: Record<string, number | string> = {
      autoplay: 0,
      cc_load_policy: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      playsinline: 1,
      rel: 0,
    };
    if (playerOrigin) playerVars.origin = playerOrigin;

    playerRef.current = new api.Player(playerMount, {
      videoId: loadedVideoRef.current,
      host: "https://www.youtube-nocookie.com",
      height: "100%",
      width: "100%",
      playerVars,
      events: {
        onReady(event) {
          playerRef.current = event.target;
          readyRef.current = true;
          syncPlayer();
          onPlayerReadyRef.current();
          onVideoVisibleRef.current(loadedVideoRef.current);
          const iframe = event.target.getIframe();
          iframe.setAttribute("title", titleRef.current);
          iframe.setAttribute("tabindex", "-1");
        },
        onStateChange(event) {
          // 1 = playing, 3 = buffering. At either point the frame belongs to
          // the latest key and can replace its poster without flashing back.
          if (event.data === 1 || event.data === 3 || event.data === 5) {
            const visibleKey =
              event.target.getVideoData().video_id ?? loadedVideoRef.current;
            onVideoVisibleRef.current(visibleKey);
          }
        },
        onAutoplayBlocked() {
          onAutoplayBlockedRef.current();
        },
        onError() {
          onPlaybackErrorRef.current(loadedVideoRef.current);
        },
      },
    });

    return () => {
      const player = playerRef.current;
      readyRef.current = false;
      if (typeof player?.destroy === "function") player.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [apiReady, playerOrigin, syncPlayer]);

  return (
    <>
      <Script
        id="slate-youtube-iframe-api"
        src="https://www.youtube.com/iframe_api"
        strategy="afterInteractive"
        onReady={() => setApiReady(Boolean(window.YT?.Player))}
        onError={() => onAutoplayBlockedRef.current()}
      />
      <div ref={mountRef} className="h-full min-h-[200px] w-full bg-black" />
    </>
  );
});

function PreviewPlayer({
  item,
  index,
  playing,
  failed,
  priority,
  onPlay,
}: {
  item: TmdbPreviewItem;
  index: number;
  playing: boolean;
  failed: boolean;
  priority: boolean;
  onPlay: () => void;
}) {
  const name = titleFor(item);

  return (
    <div
      className="relative z-10 isolate flex h-full min-h-[12.5rem] w-full items-center justify-center overflow-hidden bg-transparent [container-type:size]"
    >
      <div
        data-preview-player-index={index}
        className={cn(
          "preview-player-frame relative z-10 bg-black",
          item.orientationHint === "portrait"
            ? "preview-player-portrait"
            : "preview-player-landscape",
        )}
      >
        {!playing && failed ? (
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.videoKey)}`}
            target="_blank"
            rel="noreferrer"
            className="group relative flex h-full min-h-[200px] w-full items-center justify-center overflow-hidden bg-black/35 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-label={`Watch ${name} trailer on YouTube`}
          >
            {posterUrl(item.poster_path) ? (
              <Image
                src={posterUrl(item.poster_path)!}
                alt=""
                fill
                sizes="(max-width: 767px) 80vw, 28rem"
                className="object-cover opacity-50"
                priority={priority}
              />
            ) : null}
            <span className="relative inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 text-xs font-semibold text-white shadow-xl">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Watch on YouTube
            </span>
          </a>
        ) : !playing ? (
          <button
            type="button"
            onClick={onPlay}
            className="group relative flex h-full min-h-[200px] w-full items-center justify-center overflow-hidden bg-black/35 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-label={`Play ${name} trailer`}
          >
            {posterUrl(item.poster_path) ? (
              <Image
                src={posterUrl(item.poster_path)!}
                alt=""
                fill
                sizes="(max-width: 767px) 80vw, 28rem"
                className="object-cover opacity-55 transition-opacity duration-200 group-hover:opacity-65 motion-reduce:transition-none"
                priority={priority}
              />
            ) : null}
            <span className="relative grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl">
              <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SaveControl({
  item,
  record,
  ensureSaved,
  onStatusChange,
  onMenuOpenChange,
}: {
  item: TmdbPreviewItem;
  record: SavedRecord | undefined;
  ensureSaved: () => Promise<string>;
  onStatusChange: (status: TitleStatus) => void;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = React.useTransition();

  if (record) {
    return (
      <StatusPill
        titleId={record.id}
        status={record.status}
        onStatusChange={onStatusChange}
        onOpenChange={onMenuOpenChange}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await ensureSaved();
            toast.success(`${titleFor(item)} is in your library`);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not add title",
            );
          }
        });
      }}
      className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[0_12px_32px_-18px_hsl(var(--primary))] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 max-[359px]:w-11 max-[359px]:px-0 motion-reduce:active:scale-100"
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      <span className="max-[359px]:sr-only">
        {pending ? "Adding…" : "Up Next"}
      </span>
    </button>
  );
}

function PreviewSlide({
  item,
  index,
  selected,
  playerVisible,
  playbackFailed,
  playerReady,
  playbackEnabled,
  soundEnabled,
  lists,
  savedRecord,
  ensureSaved,
  onStatusChange,
  onEnablePlayback,
  onTogglePlayback,
  onToggleSound,
  onMenuOpenChange,
}: {
  item: TmdbPreviewItem;
  index: number;
  selected: boolean;
  playerVisible: boolean;
  playbackFailed: boolean;
  playerReady: boolean;
  playbackEnabled: boolean;
  soundEnabled: boolean;
  lists: { id: string; name: string }[];
  savedRecord: SavedRecord | undefined;
  ensureSaved: () => Promise<string>;
  onStatusChange: (status: TitleStatus) => void;
  onEnablePlayback: () => void;
  onTogglePlayback: () => void;
  onToggleSound: () => void;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const overlay = useDiscoverTitleOverlay();
  const name = titleFor(item);
  const year = yearFor(item);
  const genre = primaryGenre(item);
  const mediaLabel = item.media_type === "movie" ? "Film" : "Series";
  const anchorId = `preview-title-${item.media_type}-${item.id}`;
  const isSaved = Boolean(savedRecord);
  return (
    <article
      id={`preview-${index + 1}`}
      data-preview-index={index}
      role="group"
      aria-label={`${name} trailer`}
      aria-roledescription="slide"
      inert={selected ? undefined : true}
      className="preview-feed-slide relative isolate grid h-full min-h-full snap-start snap-always grid-rows-[minmax(12.5rem,1fr)_auto] gap-0 overflow-hidden pt-[max(0.5rem,env(safe-area-inset-top))] pb-[var(--preview-dock-clearance,0.5rem)]"
    >
      <PreviewPlayer
        item={item}
        index={index}
        playing={playerVisible}
        failed={playbackFailed}
        priority={index < 2}
        onPlay={onEnablePlayback}
      />

      <div className="preview-feed-info relative z-30 mx-auto h-fit min-h-0 w-full max-w-[64rem] min-w-0 self-end overflow-hidden px-4 pt-7 pb-2 text-white sm:px-6 md:px-8 md:pt-8">
        <div className="preview-feed-kicker flex items-start gap-3">
          <span
            className={cn(
              "inline-flex min-h-6 items-center rounded-full border px-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] md:min-h-7",
              SOURCE_TONES[item.source],
            )}
          >
            {SOURCE_LABELS[item.source]}
          </span>
        </div>

        <h1 className="preview-feed-title mt-2 line-clamp-2 text-[clamp(1.4rem,5vw,2.25rem)] font-semibold leading-[1.02] tracking-[-0.035em] sm:mt-3">
          {name}
        </h1>

        <p className="preview-feed-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 sm:mt-2">
          {year ? <span>{year}</span> : null}
          {year ? <span aria-hidden>·</span> : null}
          <span>{mediaLabel}</span>
          {genre ? <span aria-hidden>·</span> : null}
          {genre ? <span>{genre}</span> : null}
          {item.vote_average ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.vote_average.toFixed(1)}</span>
            </>
          ) : null}
        </p>

        <div className="preview-feed-actions mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide sm:gap-2.5">
          <SaveControl
            item={item}
            record={savedRecord}
            ensureSaved={ensureSaved}
            onStatusChange={onStatusChange}
            onMenuOpenChange={onMenuOpenChange}
          />
          <AddTitleToListButton
            titleId={savedRecord?.id}
            ensureTitleId={ensureSaved}
            lists={lists}
            variant="icon"
            onOpenChange={onMenuOpenChange}
          />
          <button
            id={anchorId}
            type="button"
            onPointerEnter={() => overlay?.prefetch(item)}
            onFocus={() => overlay?.prefetch(item)}
            onClick={() => overlay?.open(item, isSaved, anchorId)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/85 text-foreground shadow-sm transition-[background-color,border-color,transform] duration-150 hover:border-primary/40 hover:bg-card active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:active:scale-100"
            aria-label={`View details for ${name}`}
            title="View details"
          >
            <Info className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!playerReady}
            onClick={onTogglePlayback}
            className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-45"
            aria-label={playbackEnabled ? "Pause previews" : "Play previews"}
            title={playbackEnabled ? "Pause previews" : "Play previews"}
          >
            {playbackEnabled ? (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            disabled={!playerReady}
            onClick={onToggleSound}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-45"
            aria-label={soundEnabled ? "Mute previews" : "Unmute previews"}
            title={soundEnabled ? "Mute previews" : "Unmute previews"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" aria-hidden />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export function PreviewsFeed({
  items: initialItems,
  attemptedKeys: initialAttemptedKeys,
  lists,
  playerOrigin,
}: PreviewsFeedProps) {
  const overlay = useDiscoverTitleOverlay();
  const [items, setItems] = React.useState(initialItems);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const playerShellRef = React.useRef<HTMLDivElement>(null);
  const desktopNavigationRef = React.useRef<HTMLDivElement>(null);
  const youtubePlayerRef = React.useRef<YouTubePlayerHandle>(null);
  const itemsRef = React.useRef(items);
  const activeIndexRef = React.useRef(0);
  const attemptedHistoryRef = React.useRef<KeyHistory | null>(null);
  const playableArchiveRef = React.useRef<Map<string, TmdbPreviewItem> | null>(
    null,
  );
  const archiveCursorRef = React.useRef(0);
  const catalogueExhaustedRef = React.useRef(false);
  const loadingMoreRef = React.useRef(false);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFailureCountRef = React.useRef(0);
  const pendingScrollTopRef = React.useRef<number | null>(null);
  if (!attemptedHistoryRef.current) {
    attemptedHistoryRef.current = createKeyHistory([
      ...initialAttemptedKeys,
      ...initialItems.map(itemKey),
    ]);
  }
  if (!playableArchiveRef.current) {
    playableArchiveRef.current = new Map();
    rememberArchiveItems(playableArchiveRef.current, initialItems);
  }
  const { height: frameHeight, usableHeight: usableFrameHeight } =
    useAvailableFeedHeight(hostRef);
  const reducedMotion = useReducedMotion();
  const {
    dismiss: dismissDesktopScrollHint,
    visible: desktopScrollHintVisible,
  } = useDesktopScrollHint();
  const blockingOverlayOpen = useBlockingOverlayOpen();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [activePlayerIndex, setActivePlayerIndex] = React.useState<
    number | null
  >(null);
  const [pageVisible, setPageVisible] = React.useState(true);
  const [playbackEnabled, setPlaybackEnabled] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(false);
  const [playerReady, setPlayerReady] = React.useState(false);
  const [playerCanPlay, setPlayerCanPlay] = React.useState(false);
  const [visibleVideoKey, setVisibleVideoKey] = React.useState<string | null>(
    null,
  );
  const [failedVideoKeys, setFailedVideoKeys] = React.useState<Set<string>>(
    () => new Set(),
  );
  const failedVideoKeysRef = React.useRef(new Set<string>());
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loadRevision, setLoadRevision] = React.useState(0);
  const [saved, setSaved] = React.useState<Map<string, SavedRecord>>(
    () => new Map(),
  );
  const savedRef = React.useRef(saved);
  const pendingSaves = React.useRef(new Map<string, Promise<string>>());
  const playbackIndex = activePlayerIndex ?? activeIndex;
  const playbackItem = items[playbackIndex] ?? null;
  const playbackFailed = Boolean(
    playbackItem && failedVideoKeys.has(playbackItem.videoKey),
  );
  const playerShellVisible = Boolean(
    playbackItem &&
      !playbackFailed &&
      activePlayerIndex != null &&
      pageVisible &&
      !menuOpen &&
      !blockingOverlayOpen &&
      !overlay?.hasSelection &&
      visibleVideoKey === playbackItem.videoKey,
  );
  const playerShouldPlay = Boolean(
    playerShellVisible && playerCanPlay && playbackEnabled,
  );

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  React.useLayoutEffect(() => {
    const nextScrollTop = pendingScrollTopRef.current;
    const scroller = scrollerRef.current;
    if (nextScrollTop == null || !scroller) return;
    pendingScrollTopRef.current = null;
    const previousBehavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = "auto";
    scroller.scrollTop = nextScrollTop;
    scroller.style.scrollBehavior = previousBehavior;
  }, [items]);

  useFloatingPlayerGeometry({
    hostRef,
    scrollerRef,
    playerShellRef,
    desktopNavigationRef,
    activeIndex: activePlayerIndex,
    navigationIndex: activeIndex,
    visible: playerShellVisible,
    frameHeight,
  });

  // YouTube requires scripted playback to begin only after the real player is
  // visible. Geometry is committed in the layout effect above; wait one paint
  // before allowing playVideo so the iframe is never started as hidden media.
  React.useEffect(() => {
    setPlayerCanPlay(false);
    if (!playerShellVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const shell = playerShellRef.current;
      if (shell?.style.visibility === "visible") setPlayerCanPlay(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [playerShellVisible, playbackItem?.videoKey]);

  React.useEffect(() => {
    if (reducedMotion === null) return;
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData,
    );
    setPlaybackEnabled(reducedMotion === false && !saveData);
  }, [reducedMotion]);

  const handleAutoplayBlocked = React.useCallback(() => {
    setPlaybackEnabled(false);
    toast.message("Tap Play to continue previews");
  }, []);

  const handlePlaybackError = React.useCallback((videoKey: string) => {
    if (failedVideoKeysRef.current.has(videoKey)) return;
    const next = new Set(failedVideoKeysRef.current);
    next.add(videoKey);
    failedVideoKeysRef.current = next;
    setFailedVideoKeys(next);
    toast.error("This trailer cannot play here. You can still open it on YouTube.");
  }, []);

  React.useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    const onPageHide = () => {
      youtubePlayerRef.current?.pause();
      setPageVisible(false);
    };
    const onPageShow = () => onVisibility();
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const players = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-preview-player-index]"),
    );
    const visibility = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(entry.target, entry.intersectionRatio);
        });
        const visible = Array.from(visibility.entries())
          .filter(([, ratio]) => ratio >= 0.6)
          .sort((a, b) => b[1] - a[1])[0];
        if (!visible) {
          setActivePlayerIndex(null);
          return;
        }
        const next = Number(
          (visible[0] as HTMLElement).dataset.previewPlayerIndex ?? "0",
        );
        if (Number.isFinite(next)) {
          activeIndexRef.current = next;
          setActiveIndex(next);
          setActivePlayerIndex(next);
        }
      },
      { root: scroller, threshold: [0, 0.6, 0.75, 0.9, 1] },
    );
    players.forEach((player) => observer.observe(player));
    return () => observer.disconnect();
  }, [items, frameHeight]);

  const commitFeedItems = React.useCallback(
    (nextItems: TmdbPreviewItem[], removeFromStart: number) => {
      if (removeFromStart > 0) {
        const scroller = scrollerRef.current;
        if (scroller) {
          pendingScrollTopRef.current = Math.max(
            0,
            scroller.scrollTop - removeFromStart * scroller.clientHeight,
          );
        }
        const nextActiveIndex = Math.max(
          0,
          activeIndexRef.current - removeFromStart,
        );
        activeIndexRef.current = nextActiveIndex;
        setActiveIndex(nextActiveIndex);
        setActivePlayerIndex((current) =>
          current == null ? null : Math.max(0, current - removeFromStart),
        );
      }
      itemsRef.current = nextItems;
      setItems(nextItems);
    },
    [],
  );

  const appendPreviewItems = React.useCallback(
    (incoming: TmdbPreviewItem[]) => {
      const currentItems = itemsRef.current;
      const existingKeys = new Set(currentItems.map(itemKey));
      const unique = incoming.filter((item) => {
        const key = itemKey(item);
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });
      if (unique.length === 0) return 0;

      const expanded = [...currentItems, ...unique];
      const overflow = Math.max(0, expanded.length - PREVIEW_MAX_RENDERED);
      const safelyRemovable = Math.max(
        0,
        activeIndexRef.current - PREVIEW_KEEP_BEHIND,
      );
      const removeFromStart = Math.min(overflow, safelyRemovable);
      commitFeedItems(expanded.slice(removeFromStart), removeFromStart);
      return unique.length;
    },
    [commitFeedItems],
  );

  const replayArchivedPreviews = React.useCallback(() => {
    const archive = playableArchiveRef.current;
    if (!archive) return 0;
    const savedKeys = new Set(savedRef.current.keys());
    const available = Array.from(archive.entries()).filter(
      ([key, item]) =>
        !savedKeys.has(key) && !failedVideoKeysRef.current.has(item.videoKey),
    );
    const replayCount = Math.min(12, Math.max(0, available.length - 1));
    if (replayCount === 0) return 0;

    // Preserve as much of a 36-title visual gap as the archive permits, then
    // free older DOM entries so a small catalogue can still rotate forever.
    const replayGap = Math.min(
      PREVIEW_REPLAY_GAP,
      Math.max(1, available.length - replayCount),
    );
    const currentItems = itemsRef.current;
    const desiredRemoval = Math.max(0, currentItems.length - replayGap);
    const removeFromStart = Math.min(
      desiredRemoval,
      Math.max(0, activeIndexRef.current),
    );
    if (removeFromStart > 0) {
      commitFeedItems(currentItems.slice(removeFromStart), removeFromStart);
    }

    const currentKeys = new Set(itemsRef.current.map(itemKey));
    const start = archiveCursorRef.current % available.length;
    const replayItems: TmdbPreviewItem[] = [];
    let scanned = 0;
    while (scanned < available.length && replayItems.length < replayCount) {
      const [key, item] = available[(start + scanned) % available.length];
      if (!currentKeys.has(key)) replayItems.push(item);
      scanned += 1;
    }
    archiveCursorRef.current = (start + scanned) % available.length;
    return appendPreviewItems(replayItems);
  }, [appendPreviewItems, commitFeedItems]);

  const schedulePreviewRetry = React.useCallback((delay: number) => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setLoadRevision((revision) => revision + 1);
    }, delay);
  }, []);

  const requestMorePreviews = React.useCallback(async () => {
    const attemptedHistory = attemptedHistoryRef.current;
    if (!attemptedHistory || loadingMoreRef.current) return;
    if (catalogueExhaustedRef.current) {
      replayArchivedPreviews();
      return;
    }
    loadingMoreRef.current = true;

    try {
      const batch = await loadMorePreviews(attemptedHistory.order);
      rememberHistoryKeys(attemptedHistory, batch.attemptedKeys);
      if (playableArchiveRef.current) {
        rememberArchiveItems(playableArchiveRef.current, batch.items);
      }
      const appendedCount = appendPreviewItems(batch.items);
      loadFailureCountRef.current = 0;

      if (appendedCount > 0) {
        return;
      } else if (batch.attemptedKeys.length === 0) {
        catalogueExhaustedRef.current = true;
        replayArchivedPreviews();
      } else {
        schedulePreviewRetry(PREVIEW_LOAD_RETRY_MS);
      }
    } catch {
      loadFailureCountRef.current += 1;
      if (loadFailureCountRef.current <= PREVIEW_MAX_AUTOMATIC_RETRIES) {
        const retryDelay = Math.min(
          15_000,
          PREVIEW_LOAD_RETRY_MS * 2 ** (loadFailureCountRef.current - 1),
        );
        schedulePreviewRetry(retryDelay);
      }
    } finally {
      loadingMoreRef.current = false;
    }
  }, [appendPreviewItems, replayArchivedPreviews, schedulePreviewRetry]);

  React.useEffect(() => {
    if (
      !pageVisible ||
      items.length === 0 ||
      activeIndex < Math.max(0, items.length - PREVIEW_LOAD_AHEAD)
    ) {
      return;
    }
    void requestMorePreviews();
  }, [activeIndex, items, loadRevision, pageVisible, requestMorePreviews]);

  React.useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    [],
  );

  const rememberSaved = React.useCallback(
    (key: string, record: SavedRecord) => {
      const next = new Map(savedRef.current);
      next.set(key, record);
      savedRef.current = next;
      setSaved(next);
    },
    [],
  );

  const ensureSaved = React.useCallback(
    (item: TmdbPreviewItem) => {
      const key = itemKey(item);
      const existing = savedRef.current.get(key);
      if (existing) return Promise.resolve(existing.id);
      const inFlight = pendingSaves.current.get(key);
      if (inFlight) return inFlight;

      const request = addTitle({
        tmdbId: item.id,
        mediaType: item.media_type,
        status: "want",
      })
        .then((row) => {
          if (!row?.id) throw new Error("Title could not be added");
          const record = { id: row.id, status: row.status ?? "want" };
          rememberSaved(key, record);
          overlay?.markSaved(item, record);
          return row.id;
        })
        .finally(() => pendingSaves.current.delete(key));

      pendingSaves.current.set(key, request);
      return request;
    },
    [overlay, rememberSaved],
  );

  const moveTo = React.useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollerRef.current;
      if (!scroller || items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const target = scroller.querySelector<HTMLElement>(
        `[data-preview-index="${clamped}"]`,
      );
      target?.scrollIntoView({
        block: "start",
        behavior:
          behavior === "smooth" && reducedMotion === false ? "smooth" : "auto",
      });
    },
    [items.length, reducedMotion],
  );

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[28rem] items-center justify-center px-5 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-muted-foreground">
            <Play className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            No previews are playable right now
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We could not find an embeddable trailer in this batch. The poster rails are still ready to browse.
          </p>
          <Link
            href="/discover"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Browse Discover
          </Link>
        </div>
      </div>
    );
  }

  if (usableFrameHeight !== null && usableFrameHeight < 364) {
    return (
      <div
        className="flex min-h-0 w-full items-center justify-center bg-background px-6 text-center"
        style={{ height: `${frameHeight}px` }}
      >
        <p className="text-xs leading-5 text-muted-foreground">
          Rotate your device to keep previews and their controls visible.
        </p>
      </div>
    );
  }

  const ambientItem = items[activeIndex] ?? items[0];
  const ambientBackdrop = ambientItem
    ? backdropUrl(ambientItem.backdrop_path, "w300") ??
      posterUrl(ambientItem.poster_path)
    : null;

  return (
    <div
      ref={hostRef}
      data-previews-feed
      className="group/previews relative min-h-0 w-full overflow-hidden bg-background"
      style={frameHeight ? { height: `${frameHeight}px` } : { height: "100%" }}
    >
      {ambientBackdrop ? (
        <Image
          key={ambientBackdrop}
          src={ambientBackdrop}
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none z-0 scale-125 object-cover opacity-45 blur-xl saturate-125"
          priority={activeIndex === 0}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,5,8,0.30),rgba(4,5,8,0.38)_46%,rgba(4,5,8,0.68)_86%,rgba(4,5,8,0.82))]" />
      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Trailer previews"
        aria-describedby="preview-feed-instructions"
        aria-keyshortcuts="ArrowDown ArrowUp PageDown PageUp Home End J K"
        tabIndex={0}
        onWheelCapture={dismissDesktopScrollHint}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          if (target !== event.currentTarget) return;
          const key = event.key.toLowerCase();
          const hasCommandModifier = event.metaKey || event.ctrlKey || event.altKey;
          if (
            event.key === "ArrowDown" ||
            event.key === "PageDown" ||
            (key === "j" && !hasCommandModifier)
          ) {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(activeIndex + 1, "auto");
          } else if (
            event.key === "ArrowUp" ||
            event.key === "PageUp" ||
            (key === "k" && !hasCommandModifier)
          ) {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(activeIndex - 1, "auto");
          } else if (event.key === "Home") {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(0, "auto");
          } else if (event.key === "End") {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(items.length - 1, "auto");
          }
        }}
        className={cn(
          "relative z-10 h-full min-h-0 touch-pan-y snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        )}
      >
        <p id="preview-feed-instructions" className="sr-only">
          Swipe or scroll up and down. On a keyboard, use the Up and Down arrow
          keys, Page Up and Page Down, or J and K. Previous and next preview
          buttons are also available.
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Now showing {titleFor(items[activeIndex])}
        </p>
        <div className="preview-feed-a11y-navigation pointer-events-none fixed right-4 bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] z-[80] flex gap-2 opacity-0 transition-opacity focus-within:opacity-100">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => {
              dismissDesktopScrollHint();
              moveTo(activeIndex - 1);
            }}
            className="pointer-events-none inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-lg focus:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:hidden"
          >
            Previous preview
          </button>
          <button
            type="button"
            disabled={activeIndex === items.length - 1}
            onClick={() => {
              dismissDesktopScrollHint();
              moveTo(activeIndex + 1);
            }}
            className="pointer-events-none inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-lg focus:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:hidden"
          >
            Next preview
          </button>
        </div>
        {items.map((item, index) => {
          const key = itemKey(item);
          const record = overlay?.savedRecord(item) ?? saved.get(key);
          return (
            <PreviewSlide
              key={key}
              item={item}
              index={index}
              selected={index === activeIndex}
              playerVisible={
                index === activePlayerIndex && playerShellVisible
              }
              playbackFailed={failedVideoKeys.has(item.videoKey)}
              playerReady={playerReady && !failedVideoKeys.has(item.videoKey)}
              playbackEnabled={playbackEnabled && pageVisible}
              soundEnabled={soundEnabled}
              lists={lists}
              savedRecord={record}
              ensureSaved={() => ensureSaved(item)}
              onStatusChange={(status) => {
                const current = savedRef.current.get(key);
                const next = current
                  ? { ...current, status }
                  : record
                    ? { ...record, status }
                    : null;
                if (!next) return;
                rememberSaved(key, next);
                overlay?.markSaved(item, next);
              }}
              onEnablePlayback={() => {
                youtubePlayerRef.current?.play();
                setPlaybackEnabled(true);
              }}
              onTogglePlayback={() => {
                if (playbackEnabled) {
                  youtubePlayerRef.current?.pause();
                  setPlaybackEnabled(false);
                } else {
                  youtubePlayerRef.current?.play();
                  setPlaybackEnabled(true);
                }
              }}
              onToggleSound={() => {
                if (soundEnabled) {
                  youtubePlayerRef.current?.mute();
                  setSoundEnabled(false);
                } else {
                  youtubePlayerRef.current?.unmuteAndPlay();
                  setSoundEnabled(true);
                  setPlaybackEnabled(true);
                }
              }}
              onMenuOpenChange={setMenuOpen}
            />
          );
        })}
      </div>
      <div
        ref={desktopNavigationRef}
        className={cn(
          "preview-desktop-navigation pointer-events-none invisible absolute left-0 top-0 z-40 w-12 flex-col items-stretch gap-2 opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [backface-visibility:hidden]",
          desktopScrollHintVisible
            ? "opacity-100"
            : "group-hover/previews:opacity-70 focus-within:opacity-100",
        )}
        role="group"
        aria-label="Preview navigation"
      >
        {desktopScrollHintVisible ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[-2.5rem] flex min-h-7 w-24 -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-black/30 px-2 py-1 text-center text-[9px] font-medium leading-tight text-white/60"
            aria-hidden
          >
            <Mouse className="h-3 w-3 shrink-0" />
            <span>Scroll to browse</span>
          </div>
        ) : null}
        <button
          type="button"
          disabled={activeIndex === 0}
          onClick={() => {
            dismissDesktopScrollHint();
            moveTo(activeIndex - 1);
          }}
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/55 transition-[background-color,border-color,color,transform] duration-150 hover:border-white/15 hover:bg-black/35 hover:text-white/85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-20 motion-reduce:active:scale-100"
          aria-label="Previous preview"
          title="Previous preview (K or Up Arrow)"
        >
          <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          disabled={activeIndex === items.length - 1}
          onClick={() => {
            dismissDesktopScrollHint();
            moveTo(activeIndex + 1);
          }}
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/55 transition-[background-color,border-color,color,transform] duration-150 hover:border-white/15 hover:bg-black/35 hover:text-white/85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-20 motion-reduce:active:scale-100"
          aria-label="Next preview"
          title="Next preview (J or Down Arrow)"
        >
          <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>
      {playbackItem ? (
        <div
          ref={playerShellRef}
          className="pointer-events-none invisible absolute left-0 top-0 z-20 bg-black opacity-0 will-change-transform"
        >
          <YouTubePreview
            ref={youtubePlayerRef}
            videoKey={playbackItem.videoKey}
            title={`${titleFor(playbackItem)} trailer`}
            soundEnabled={soundEnabled}
            shouldPlay={playerShouldPlay}
            playerOrigin={playerOrigin}
            onAutoplayBlocked={handleAutoplayBlocked}
            onPlayerReady={() => setPlayerReady(true)}
            onPlaybackError={handlePlaybackError}
            onVideoVisible={setVisibleVideoKey}
          />
        </div>
      ) : null}
    </div>
  );
}
