"use client";

import { Play } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewsFeed } from "@/components/previews-feed";
import { DiscoverTitleOverlayProvider } from "@/components/discover-title-overlay";
import type { TmdbPreviewBatch } from "@/lib/tmdb";
import styles from "./landing-previews.module.css";

export function LandingPreviews({ saveHref }: { saveHref: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const seedRef = useRef<string | null>(null);
  const [batch, setBatch] = useState<
    (TmdbPreviewBatch & { nextBatchIndex: number }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const [playerOrigin, setPlayerOrigin] = useState<string>();
  const pathname = usePathname();

  const loadInitialBatch = useCallback(async () => {
    if (requestRef.current && !requestRef.current.signal.aborted) return;
    const controller = new AbortController();
    requestRef.current = controller;
    seedRef.current ??= crypto.randomUUID();
    setPlayerOrigin(window.location.origin);
    setLoading(true);
    setError(false);
    try {
      // The shared app feed takes over all subsequent loading and rotation.
      const attempted = new Set<string>();
      let nextBatchIndex = 0;
      let result: TmdbPreviewBatch;
      do {
        const query = new URLSearchParams({
          seed: seedRef.current,
          batch: String(nextBatchIndex++),
          exclude: [...attempted].join(","),
        });
        const response = await fetch(`/api/public/previews?${query}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Previews unavailable");
        result = await response.json();
        result.attemptedKeys.forEach((key) => attempted.add(key));
      } while (
        !result.items.length &&
        result.attemptedKeys.length &&
        attempted.size < 240 &&
        nextBatchIndex < 10
      );
      if (!result.items.length) throw new Error("No playable trailers");
      if (!controller.signal.aborted)
        setBatch({ ...result, attemptedKeys: [...attempted], nextBatchIndex });
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
    const host = hostRef.current;
    if (!host) return;
    const loadObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        void loadInitialBatch();
        loadObserver.disconnect();
      },
      { rootMargin: "240px" },
    );
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting && entry.intersectionRatio >= 0.5);
      },
      { threshold: [0, 0.5] },
    );
    loadObserver.observe(host);
    visibilityObserver.observe(host);
    return () => {
      loadObserver.disconnect();
      visibilityObserver.disconnect();
      requestRef.current?.abort();
    };
  }, [loadInitialBatch]);

  return (
    <div ref={hostRef} className={styles.preview}>
      {batch ? (
        <DiscoverTitleOverlayProvider publicPreview={{ saveHref }}>
          <div className={styles.frame}>
            <PreviewsFeed
              items={batch.items}
              attemptedKeys={batch.attemptedKeys}
              lists={[]}
              playerOrigin={playerOrigin}
              profileKey="landing-public"
              sessionSeed={seedRef.current ?? undefined}
              publicPreview={{
                saveHref,
                active: inView && pathname !== "/login",
                nextBatchIndex: batch.nextBatchIndex,
              }}
            />
          </div>
        </DiscoverTitleOverlayProvider>
      ) : (
        <div className={styles.placeholder} aria-busy={loading}>
          <Play aria-hidden="true" />
          <p role="status">
            {error ? "Trailers are taking a moment." : "Loading previews…"}
          </p>
          {error && (
            <button type="button" onClick={() => void loadInitialBatch()}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
