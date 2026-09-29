"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState } from "react";
import { ArrowRight, Check, Plus, RotateCcw, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import {
  completeOnboarding,
  type OnboardingState,
} from "@/lib/onboarding-actions";
import type { OnboardingTitle } from "@/lib/onboarding-titles";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import { captureAnalytics, countBucket } from "@/lib/analytics";
import styles from "./onboarding-deck.module.css";

const INITIAL_STATE: OnboardingState = { ok: false, message: "" };

type Choice = "keep" | "pass";
interface Decision {
  title: OnboardingTitle;
  choice: Choice;
}

export function OnboardingDeck({ titles }: { titles: OnboardingTitle[] }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [cursor, setCursor] = React.useState(0);
  const [decisions, setDecisions] = React.useState<Decision[]>([]);
  const [reviewing, setReviewing] = React.useState(titles.length === 0);
  const [exitDirection, setExitDirection] = React.useState<1 | -1>(1);
  const [state, action, pending] = useActionState(completeOnboarding, INITIAL_STATE);
  const submittedViewedRef = React.useRef(0);
  const completionTrackedRef = React.useRef(false);

  const active = titles[cursor] ?? null;
  const next = titles[cursor + 1] ?? null;
  const kept = React.useMemo(
    () => decisions.filter((decision) => decision.choice === "keep").map((decision) => decision.title),
    [decisions],
  );
  const backdropTitle = reviewing
    ? kept.at(-1) ?? decisions.at(-1)?.title ?? titles[0] ?? null
    : active ?? titles[0] ?? null;

  React.useEffect(() => {
    captureAnalytics("onboarding_started", {
      surface: "taste_builder",
      title_count: countBucket(titles.length),
    });
  }, [titles.length]);

  React.useEffect(() => {
    if (!state.ok || completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    const savedCount = state.savedCount ?? kept.length;
    captureAnalytics("onboarding_completed", {
      selected_count: countBucket(savedCount),
      viewed_count: countBucket(submittedViewedRef.current),
    });
    if (savedCount === 0) {
      captureAnalytics("onboarding_skipped", {
        viewed_count: countBucket(submittedViewedRef.current),
      });
    }
    const timeout = window.setTimeout(() => {
      router.replace("/app");
      router.refresh();
    }, reduceMotion ? 0 : 720);
    return () => window.clearTimeout(timeout);
  }, [kept.length, reduceMotion, router, state]);

  const decide = React.useCallback(
    (choice: Choice) => {
      if (!active || pending || reviewing) return;
      const direction = choice === "keep" ? 1 : -1;
      setExitDirection(direction);
      setDecisions((current) => [...current, { title: active, choice }]);
      captureAnalytics("onboarding_title_decided", {
        choice,
        media_type: active.mediaType,
        position: cursor + 1,
      });
      if (cursor + 1 >= titles.length) {
        setReviewing(true);
      } else {
        setCursor((current) => current + 1);
      }
    }, [active, cursor, pending, reviewing, titles.length],
  );

  const undo = React.useCallback(() => {
    if (!decisions.length || pending) return;
    setDecisions((current) => current.slice(0, -1));
    setCursor((current) => Math.max(0, current - 1));
    setReviewing(false);
  }, [decisions.length, pending]);

  React.useEffect(() => {
    if (reviewing || pending || state.ok) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        decide("pass");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        decide("keep");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decide, pending, reviewing, state.ok]);

  const progress = reviewing ? 1 : titles.length ? cursor / titles.length : 1;

  return (
    <main className={styles.page} data-analytics-private>
      <CinematicBackdrop title={backdropTitle} reduceMotion={Boolean(reduceMotion)} />
      <div className={styles.grain} aria-hidden="true" />

      <header className={styles.header}>
        <Image
          className={styles.logo}
          src="/brand/logo-light.svg"
          alt="slate"
          width={78}
          height={22}
          priority
        />

        <div className={styles.progress} aria-label={`${Math.min(cursor + 1, titles.length)} of ${titles.length}`}>
          <span>{reviewing ? "Ready" : "A few to start"}</span>
          <div className={styles.progressTrack} aria-hidden="true">
            <motion.div
              className={styles.progressFill}
              animate={{ scaleX: progress }}
              transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className={styles.progressCount}>
            {reviewing
              ? `${kept.length} kept`
              : `${String(cursor + 1).padStart(2, "0")} / ${String(titles.length).padStart(2, "0")}`}
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={undo}
            disabled={!decisions.length || pending}
            className={styles.undoButton}
            data-analytics-action="onboarding_undo"
            data-analytics-area="taste_builder"
          >
            <RotateCcw aria-hidden="true" />
            <span>Undo</span>
          </button>
          {!reviewing && (
            <button
              type="button"
              onClick={() => setReviewing(true)}
              disabled={pending}
              className={styles.finishButton}
              data-analytics-action={decisions.length ? "onboarding_finish_early" : "onboarding_skip"}
              data-analytics-area="taste_builder"
            >
              {decisions.length ? "Finish" : "Skip"}
            </button>
          )}
        </div>
      </header>

      <div className={styles.content}>
        <AnimatePresence mode="wait" initial={false} custom={exitDirection}>
          {state.ok ? (
            <Completion key="complete" savedCount={state.savedCount ?? kept.length} />
          ) : reviewing ? (
            <Review
              key="review"
              kept={kept}
              viewedCount={decisions.length}
              pending={pending}
              error={state.message}
              action={action}
              onBack={() => setReviewing(false)}
              onSubmit={() => {
                submittedViewedRef.current = decisions.length;
              }}
            />
          ) : active ? (
            <motion.section
              key="deck"
              className={styles.stage}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
              aria-live="polite"
            >
              <div className={styles.deck}>
                {next ? (
                  <div className={styles.nextCard} aria-hidden="true">
                    <Image src={posterUrl(next.posterPath, "w500")!} alt="" fill sizes="380px" />
                  </div>
                ) : null}
                <AnimatePresence initial={false} custom={exitDirection}>
                  <SwipeCard
                    key={`${active.mediaType}:${active.tmdbId}`}
                    title={active}
                    exitDirection={exitDirection}
                    reduceMotion={Boolean(reduceMotion)}
                    onDecision={decide}
                  />
                </AnimatePresence>
              </div>

              <div className={styles.details}>
                <p className={styles.eyebrow}>Shape your Up Next</p>
                <h1 data-onboarding-title>{active.title}</h1>
                <div className={styles.meta}>
                  <span>{active.mediaType === "movie" ? "Film" : "Series"}</span>
                  {yearFor(active) ? <span>{yearFor(active)}</span> : null}
                  {active.genres.map((genre) => <span key={genre}>{genre}</span>)}
                </div>
                <p className={styles.overview}>{active.overview}</p>

                <div className={styles.decisionRow}>
                  <button
                    type="button"
                    className={styles.passButton}
                    onClick={() => decide("pass")}
                    data-analytics-action="onboarding_pass"
                    data-analytics-area="taste_builder"
                  >
                    <X aria-hidden="true" />
                    <span>Pass</span>
                  </button>
                  <button
                    type="button"
                    className={styles.keepButton}
                    onClick={() => decide("keep")}
                    data-analytics-action="onboarding_keep"
                    data-analytics-area="taste_builder"
                  >
                    <Plus aria-hidden="true" />
                    <span>Keep for later</span>
                  </button>
                </div>
                <p className={styles.gestureHint}>
                  Drag the poster or use <span>←</span> <span>→</span>
                </p>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}

function CinematicBackdrop({
  title,
  reduceMotion,
}: {
  title: OnboardingTitle | null;
  reduceMotion: boolean;
}) {
  const source = title ? backdropUrl(title.backdropPath, "w1280") : null;
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <AnimatePresence initial={false}>
        {source ? (
          <motion.div
            key={source}
            className={styles.backdropImage}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
          >
            <Image src={source} alt="" fill sizes="100vw" priority />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className={styles.backdropWash} />
    </div>
  );
}

function SwipeCard({
  title,
  exitDirection,
  reduceMotion,
  onDecision,
}: {
  title: OnboardingTitle;
  exitDirection: 1 | -1;
  reduceMotion: boolean;
  onDecision: (choice: Choice) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 0, 180], [-7, 0, 7]);
  const keepOpacity = useTransform(x, [18, 95], [0, 1]);
  const passOpacity = useTransform(x, [-95, -18], [1, 0]);

  function finishDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const intent = Math.abs(info.offset.x) > 82 || Math.abs(info.velocity.x) > 620;
    if (!intent) return;
    onDecision(info.offset.x > 0 ? "keep" : "pass");
  }

  return (
    <motion.div
      className={styles.activeCard}
      data-onboarding-card
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.72}
      dragMomentum={false}
      onDragEnd={finishDrag}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.975, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : {
              x: exitDirection * 560,
              rotate: exitDirection * 9,
              opacity: 0,
              transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
            }
      }
      transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ cursor: "grabbing", scale: reduceMotion ? 1 : 0.992 }}
    >
      <Image
        src={posterUrl(title.posterPath, "w500")!}
        alt={`${title.title} poster`}
        fill
        draggable={false}
        loading="eager"
        sizes="(max-width: 700px) 76vw, 390px"
      />
      <div className={styles.cardSheen} aria-hidden="true" />
      <motion.span className={`${styles.swipeStamp} ${styles.keepStamp}`} style={{ opacity: keepOpacity }}>
        Keep
      </motion.span>
      <motion.span className={`${styles.swipeStamp} ${styles.passStamp}`} style={{ opacity: passOpacity }}>
        Pass
      </motion.span>
    </motion.div>
  );
}

function Review({
  kept,
  viewedCount,
  pending,
  error,
  action,
  onBack,
  onSubmit,
}: {
  kept: OnboardingTitle[];
  viewedCount: number;
  pending: boolean;
  error: string;
  action: (payload: FormData) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const selections = kept.map((title) => ({
    tmdbId: title.tmdbId,
    mediaType: title.mediaType,
  }));

  return (
    <motion.section
      className={styles.review}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className={styles.eyebrow}>Your first shelf</p>
      <h1>
        {kept.length ? "A good beginning." : "Begin with a blank slate."}
      </h1>
      <p className={styles.reviewCopy}>
        {kept.length
          ? `${kept.length} ${kept.length === 1 ? "title is" : "titles are"} ready in Up Next. Your previews will get sharper as you keep watching and saving.`
          : "Skip the warm-up and start exploring. Slate will learn from what you save, watch, and pass on."}
      </p>

      {kept.length ? (
        <div className={styles.posterStrip} aria-label={`${kept.length} kept titles`}>
          {kept.slice(0, 6).map((title, index) => (
            <motion.div
              key={`${title.mediaType}:${title.tmdbId}`}
              className={styles.miniPoster}
              initial={{ opacity: 0, y: 16, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: (index - Math.min(kept.length, 6) / 2) * 1.4 }}
              transition={{ delay: index * 0.045, duration: 0.38 }}
            >
              <Image src={posterUrl(title.posterPath, "w185")!} alt={title.title} fill sizes="110px" />
            </motion.div>
          ))}
          {kept.length > 6 ? <span className={styles.moreCount}>+{kept.length - 6}</span> : null}
        </div>
      ) : null}

      <form
        action={action}
        className={styles.reviewActions}
        onSubmit={() => onSubmit()}
      >
        <input type="hidden" name="selections" value={JSON.stringify(selections)} />
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button
          type="submit"
          className={styles.openButton}
          disabled={pending}
          data-analytics-action="onboarding_save_taste"
          data-analytics-area="taste_builder"
        >
          <span>{pending ? "Building your slate…" : kept.length ? "Open Up Next" : "Start exploring"}</span>
          {!pending ? <ArrowRight aria-hidden="true" /> : null}
        </button>
        {viewedCount < 10 ? (
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            disabled={pending}
          >
            Keep choosing
          </button>
        ) : null}
      </form>
    </motion.section>
  );
}

function Completion({ savedCount }: { savedCount: number }) {
  return (
    <motion.section
      className={styles.completion}
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      role="status"
    >
      <motion.span
        className={styles.completionMark}
        initial={{ scale: 0.6, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 24 }}
      >
        <Check aria-hidden="true" />
      </motion.span>
      <p className={styles.eyebrow}>You&apos;re in</p>
      <h1>{savedCount ? "Your Up Next is waiting." : "Your slate is ready."}</h1>
    </motion.section>
  );
}

function yearFor(title: OnboardingTitle) {
  return title.releaseDate?.slice(0, 4) ?? "";
}
