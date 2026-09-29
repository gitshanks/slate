"use client";

import { useEffect, useState } from "react";
import { TrailerButton } from "@/components/trailer-button";
import type { OnboardingTitle } from "@/lib/onboarding-titles";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import styles from "./onboarding-deck.module.css";

// Undo reuses the same catalogue response. Nothing here is account data.
const detailsCache = new Map<string, PublicSpatialTitleDetail>();

export function OnboardingTitleDetails({
  title,
  onTrailerOpenChange,
}: {
  title: OnboardingTitle;
  onTrailerOpenChange: (open: boolean) => void;
}) {
  const key = `${title.mediaType}:${title.tmdbId}`;
  const [detail, setDetail] = useState(() => detailsCache.get(key) ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (detailsCache.has(key)) return;
    const controller = new AbortController();
    fetch(`/api/public/catalogue/${title.mediaType}/${title.tmdbId}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalogue unavailable");
        const result: PublicSpatialTitleDetail = await response.json();
        if (controller.signal.aborted) return;
        detailsCache.set(key, result);
        setDetail(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt, key, title.mediaType, title.tmdbId]);

  const row = detail?.resolvedTitle;
  const runtime = row?.runtime;
  const seasons = row?.seasons?.filter((season) => season.n > 0).length;
  const rating = row?.imdb_rating ?? row?.tmdb_rating;
  const summary = detail?.summary || title.overview;

  return (
    <>
      <div className={styles.meta}>
        <span>{title.mediaType === "movie" ? "Film" : "Series"}</span>
        {title.releaseDate ? <span>{title.releaseDate.slice(0, 4)}</span> : null}
        {title.genres.map((genre) => <span key={genre}>{genre}</span>)}
        {runtime ? <span>{runtime} min</span> : null}
        {seasons ? <span>{seasons} {seasons === 1 ? "season" : "seasons"}</span> : null}
        {rating ? <span>{rating.toFixed(1)} / 10 {row?.imdb_rating ? "IMDb" : "TMDB"}</span> : null}
      </div>
      <p className={styles.overview}>{summary}</p>
      {detail?.directedBy.length || detail?.cast.length ? (
        <dl className={styles.credits}>
          {detail.directedBy.length ? (
            <div>
              <dt>{title.mediaType === "movie" ? "Directed by" : "Created by"}</dt>
              <dd>{detail.directedBy.join(", ")}</dd>
            </div>
          ) : null}
          {detail.cast.length ? (
            <div>
              <dt>Starring</dt>
              <dd>{detail.cast.slice(0, 4).map((person) => person.name).join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <div className={styles.trailerRow}>
        {detail?.trailerKey ? (
          <TrailerButton
            trailerKey={detail.trailerKey}
            titleName={title.title}
            source="onboarding"
            className={styles.trailerButton}
            onOpenChange={onTrailerOpenChange}
          />
        ) : failed ? (
          <button type="button" className={styles.trailerButton} onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}>
            Retry details & trailer
          </button>
        ) : (
          <span className={styles.trailerStatus} role="status">
            {detail ? "No trailer available for this title" : "Loading details & trailer…"}
          </span>
        )}
      </div>
    </>
  );
}
