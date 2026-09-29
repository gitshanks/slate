"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { motion } from "motion/react";
import type { OnboardingTitle } from "@/lib/onboarding-titles";
import { titleKey, type OnboardingPick } from "@/lib/onboarding-recommendations";
import { posterUrl } from "@/lib/tmdb-image";
import styles from "./onboarding-deck.module.css";

const shelfCache = new Map<string, OnboardingTitle[]>();

export function StarterShelf({
  kept, passed, hasMore, pending, error, action, onBack, onSubmit,
}: {
  kept: OnboardingTitle[];
  passed: OnboardingPick[];
  hasMore: boolean;
  pending: boolean;
  error: string;
  action: (payload: FormData) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const requestBody = JSON.stringify({
    kept: kept.map(({ tmdbId, mediaType }) => ({ tmdbId, mediaType })),
    passed: passed.map(({ tmdbId, mediaType }) => ({ tmdbId, mediaType })),
  });
  const needsSuggestions = kept.length > 0 && kept.length < 10;
  const [suggestions, setSuggestions] = useState<OnboardingTitle[] | null>(
    () => shelfCache.get(requestBody) ?? (needsSuggestions ? null : []),
  );
  const [omitted, setOmitted] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const selectedSuggestions = (suggestions ?? []).filter((title) => !omitted.includes(titleKey(title)));
  const selections = [...kept, ...selectedSuggestions].map(({ tmdbId, mediaType }) => ({ tmdbId, mediaType }));

  useEffect(() => {
    if (!needsSuggestions || shelfCache.has(requestBody)) return;
    const controller = new AbortController();
    fetch("/api/onboarding/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Suggestions unavailable");
      const data: { titles: OnboardingTitle[] } = await response.json();
      if (controller.signal.aborted) return;
      shelfCache.set(requestBody, data.titles);
      setSuggestions(data.titles);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [attempt, needsSuggestions, requestBody]);

  return (
    <motion.section
      className={`${styles.review} ${styles.starterReview}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className={styles.eyebrow}>Your first shelf</p>
      <h1>{kept.length ? "A good beginning." : "Begin with a blank slate."}</h1>
      <p className={styles.reviewCopy}>
        {kept.length
          ? "Your picks come first. A few more, inspired by them, can round out your Up Next."
          : "Skip the warm-up and start exploring. Your recommendations grow with what you save and watch."}
      </p>
      {kept.length ? (
        <section className={styles.shelfSection} aria-labelledby="your-picks-heading">
          <h2 id="your-picks-heading">You picked <span>{kept.length}</span></h2>
          <div className={styles.shelfGrid}>
            {kept.map((title) => <ShelfPoster key={titleKey(title)} title={title} />)}
          </div>
        </section>
      ) : null}
      {needsSuggestions ? (
        <section className={styles.shelfSection} aria-labelledby="suggested-picks-heading" aria-busy={!suggestions && !failed}>
          <h2 id="suggested-picks-heading">Based on what you liked</h2>
          <p className={styles.shelfNote}>
            {suggestions?.length ? "Included in your starter shelf. Tap any to leave it out." : failed
              ? "Suggestions couldn't load. Retry, or start with just your picks."
              : suggestions ? "No close matches this time. Your picks are a great place to start."
              : "Finding a few that belong alongside your picks…"}
          </p>
          {failed ? (
            <button type="button" className={styles.backButton} onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>
              Retry suggestions
            </button>
          ) : null}
          <div className={styles.shelfGrid}>
            {suggestions?.map((title) => {
              const selected = !omitted.includes(titleKey(title));
              return (
                <button
                  type="button"
                  key={titleKey(title)}
                  aria-label={`${selected ? "Leave out" : "Include"} ${title.title}`}
                  aria-pressed={selected}
                  disabled={pending}
                  className={styles.suggestion}
                  data-selected={selected}
                  onClick={() => setOmitted((current) => selected
                    ? [...current, titleKey(title)]
                    : current.filter((key) => key !== titleKey(title)))}
                >
                  <ShelfPoster title={title} />
                  <span className={styles.selectionMark}>{selected ? <Check /> : <Plus />}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      <form action={action} className={styles.reviewActions} onSubmit={onSubmit}>
        <input type="hidden" name="selections" value={JSON.stringify(selections)} />
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" className={styles.openButton} disabled={pending || (!suggestions && !failed)}
          data-analytics-action="onboarding_save_taste" data-analytics-area="taste_builder">
          <span>{pending ? "Building your slate…" : selections.length ? `Start with ${selections.length} ${selections.length === 1 ? "title" : "titles"}` : "Start exploring"}</span>
          {!pending ? <ArrowRight aria-hidden="true" /> : null}
        </button>
        {hasMore ? <button type="button" className={styles.backButton} disabled={pending} onClick={onBack}>Keep choosing</button> : null}
      </form>
    </motion.section>
  );
}

function ShelfPoster({ title }: { title: OnboardingTitle }) {
  return (
    <div className={styles.shelfTitle}>
      <div className={styles.shelfPoster}>
        <Image src={posterUrl(title.posterPath, "w185")!} alt="" fill sizes="(max-width: 560px) 30vw, 155px" />
      </div>
      <span>{title.title}</span>
    </div>
  );
}
