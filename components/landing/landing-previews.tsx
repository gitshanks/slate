"use client";

import Image from "next/image";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewSlide } from "@/components/previews/preview-slide";
import {
  YouTubePreview,
  type YouTubePlayerHandle,
} from "@/components/previews/youtube-preview";
import type { TmdbPreviewBatch, TmdbPreviewItem } from "@/lib/tmdb";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import styles from "./landing-previews.module.css";

export function LandingPreviews({ saveHref }: { saveHref: string }) {
  const loadRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const seedRef = useRef<string | null>(null);
  const batchRef = useRef(0);
  const attemptedRef = useRef<string[]>([]);
  const itemsRef = useRef<TmdbPreviewItem[]>([]);
  const [items, setItems] = useState<TmdbPreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadBatch = useCallback(async () => {
    if (requestRef.current && !requestRef.current.signal.aborted) return;
    const controller = new AbortController();
    requestRef.current = controller;
    seedRef.current ??= crypto.randomUUID();
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({
      seed: seedRef.current,
      batch: String(batchRef.current),
      exclude: attemptedRef.current.slice(-96).join(","),
    });
    try {
      const response = await fetch(`/api/public/previews?${query}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Previews unavailable");
      const batch: TmdbPreviewBatch = await response.json();
      if (controller.signal.aborted) return;
      const seen = new Set(
        itemsRef.current.map((item) => `${item.media_type}:${item.id}`),
      );
      const fresh = batch.items.filter(
        (item) => !seen.has(`${item.media_type}:${item.id}`),
      );
      if (fresh.length === 0 && itemsRef.current.length === 0)
        throw new Error("No trailers available");
      attemptedRef.current = [
        ...new Set([...attemptedRef.current, ...batch.attemptedKeys]),
      ].slice(-96);
      batchRef.current += 1;
      itemsRef.current = [...itemsRef.current, ...fresh];
      setItems(itemsRef.current);
      setHasMore(fresh.length > 0);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const host = loadRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void loadBatch();
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(host);
    return () => {
      observer.disconnect();
      requestRef.current?.abort();
    };
  }, [loadBatch]);

  return (
    <div ref={loadRef}>
      {items.length ? (
        <TrailerPreview
          items={items}
          saveHref={saveHref}
          loadMore={loadBatch}
          hasMore={hasMore && !error}
          loading={loading}
        />
      ) : (
        <div className={styles.placeholder} aria-busy={loading}>
          <Play aria-hidden="true" />
          <p role="status">
            {error
              ? "Trailers are taking a moment."
              : "Finding your next great watch…"}
          </p>
          {error ? (
            <button type="button" onClick={() => void loadBatch()}>
              Try again
            </button>
          ) : (
            <span>Trending this week. New in theaters.</span>
          )}
        </div>
      )}
      {error && items.length > 0 ? (
        <div className={styles.loadError} role="status">
          More trailers are taking a moment.{" "}
          <button type="button" onClick={() => void loadBatch()}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TrailerPreview({
  items,
  saveHref,
  loadMore,
  hasMore,
  loading,
}: {
  items: TmdbPreviewItem[];
  saveHref: string;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loading: boolean;
}) {
  const hostRef = useRef<HTMLElement>(null);
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [mountedPlayer, setMountedPlayer] = useState(false);
  const [startedVideoKey, setStartedVideoKey] = useState<string | null>(null);
  const [visibleVideoKey, setVisibleVideoKey] = useState<string | null>(null);
  const [failedVideoKey, setFailedVideoKey] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [playerOrigin, setPlayerOrigin] = useState<string>();
  const item = items[index];
  const failed = failedVideoKey === item.videoKey;
  const playerVisible =
    startedVideoKey === item.videoKey &&
    visibleVideoKey === item.videoKey &&
    !failed;
  const shouldPlay =
    playRequested &&
    inView &&
    pageVisible &&
    pathname !== "/login" &&
    !detailsOpen &&
    !failed;
  const ambient =
    backdropUrl(item.backdrop_path) ?? posterUrl(item.poster_path);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        setInView(visible);
        if (!visible) {
          playerRef.current?.pause();
          setPlayRequested(false);
        }
      },
      { threshold: [0, 0.25] },
    );
    observer.observe(host);
    function handleVisibility() {
      setPageVisible(!document.hidden);
      if (document.hidden) {
        playerRef.current?.pause();
        setPlayRequested(false);
      }
    }
    function handlePageHide() {
      playerRef.current?.pause();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (!shouldPlay) playerRef.current?.pause();
  }, [shouldPlay]);

  useEffect(() => {
    if (
      startedVideoKey !== item.videoKey ||
      visibleVideoKey === item.videoKey ||
      failed
    )
      return;
    // Blocked third-party scripts or unavailable embeds must leave a usable link.
    const timeout = window.setTimeout(() => {
      setFailedVideoKey(item.videoKey);
      setPlayRequested(false);
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [startedVideoKey, visibleVideoKey, item.videoKey, failed]);

  function play() {
    setPlayerOrigin(window.location.origin);
    setMountedPlayer(true);
    setStartedVideoKey(item.videoKey);
    setFailedVideoKey(null);
    setDetailsOpen(false);
    setPlayRequested(true);
    playerRef.current?.play();
  }

  function moveTo(next: number) {
    if (next < 0 || next >= items.length) return;
    playerRef.current?.pause();
    setPlayRequested(false);
    setStartedVideoKey(null);
    setVisibleVideoKey(null);
    setFailedVideoKey(null);
    setDetailsOpen(false);
    setIndex(next);
    if (next >= items.length - 3 && hasMore) void loadMore();
  }

  return (
    <figure
      ref={hostRef}
      className={styles.preview}
      aria-label="Explore Slate trailer previews"
      data-landing-previews
    >
      <div className={styles.frame}>
        {ambient && (
          <Image
            src={ambient}
            alt=""
            fill
            sizes="(max-width: 760px) 100vw, 660px"
            className={styles.ambient}
          />
        )}
        <div className={styles.scrim} />
        <PreviewSlide
          item={item}
          index={index}
          selected
          playerVisible={playerVisible}
          playbackFailed={failed}
          playerReady={(!mountedPlayer || playerReady) && !failed}
          soundReady={playerReady && !failed}
          playbackEnabled={shouldPlay}
          soundEnabled={soundEnabled}
          saveHref={saveHref}
          onEnablePlayback={play}
          onTogglePlayback={() => {
            if (playRequested) {
              playerRef.current?.pause();
              setPlayRequested(false);
            } else play();
          }}
          onToggleSound={() => {
            if (soundEnabled) playerRef.current?.mute();
            else playerRef.current?.unmuteAndPlay();
            setSoundEnabled(!soundEnabled);
            if (!soundEnabled) {
              setStartedVideoKey(item.videoKey);
              setPlayRequested(true);
            }
          }}
          onDetail={() => {
            playerRef.current?.pause();
            setPlayRequested(false);
            setDetailsOpen(!detailsOpen);
          }}
          detailsId="landing-preview-details"
          detailExpanded={detailsOpen}
          player={
            mountedPlayer ? (
              <YouTubePreview
                ref={playerRef}
                videoKey={item.videoKey}
                title={`${item.title || item.name} trailer`}
                soundEnabled={soundEnabled}
                shouldPlay={shouldPlay}
                playerOrigin={playerOrigin}
                onPlayerReady={() => setPlayerReady(true)}
                onVideoVisible={setVisibleVideoKey}
                onPlaybackError={(key) => {
                  if (key !== item.videoKey) return;
                  setFailedVideoKey(key);
                  setPlayRequested(false);
                }}
                onAutoplayBlocked={() => {
                  if (!playerReady) setFailedVideoKey(item.videoKey);
                  setStartedVideoKey(null);
                  setPlayRequested(false);
                }}
              />
            ) : undefined
          }
        />
      </div>
      <div className={styles.navigation}>
        <span aria-live="polite" aria-atomic="true">
          {index + 1} / {items.length}
          <span className={styles.srOnly}> — {item.title || item.name}</span>
        </span>
        <div role="group" aria-label="Preview navigation">
          <button
            type="button"
            onClick={() => moveTo(index - 1)}
            disabled={index === 0}
            aria-label="Previous preview"
          >
            <ChevronUp aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() =>
              index < items.length - 1 ? moveTo(index + 1) : void loadMore()
            }
            disabled={index === items.length - 1 && (!hasMore || loading)}
            aria-label={
              index === items.length - 1 && hasMore
                ? "Load more previews"
                : "Next preview"
            }
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        id="landing-preview-details"
        hidden={!detailsOpen}
        className={styles.synopsis}
      >
        <p>{item.overview}</p>
      </div>
      <figcaption>Find something you can’t wait to watch.</figcaption>
    </figure>
  );
}
