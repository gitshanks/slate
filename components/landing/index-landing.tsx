import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { SLATE_HOSTED } from "@/lib/public-mode";
import styles from "./index-landing.module.css";

const queue = [
  {
    title: "Perfect Days",
    year: "2023",
    path: "/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg",
  },
  {
    title: "Past Lives",
    year: "2023",
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
  },
  {
    title: "Dune: Part Two",
    year: "2024",
    path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  },
  {
    title: "The Holdovers",
    year: "2023",
    path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
  },
] as const;

const diary = [
  ["Jul 28", "The Worst Person in the World", "2021", "4½"],
  ["Jul 24", "Aftersun", "2022", "5"],
  ["Jul 19", "Memories of Murder", "2003", "4"],
  ["Jul 12", "The Bear", "S04 E10", "4"],
] as const;

export function IndexLanding() {
  const ctaHref = SLATE_HOSTED ? "/login" : "/app";
  const ctaLabel = SLATE_HOSTED ? "Start your Slate" : "Open Slate";

  return (
    <main className={styles.page}>
      <aside className={styles.intro}>
        <Link href="/" className={styles.logo} aria-label="Slate home">
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={76}
            height={22}
            priority
          />
        </Link>

        <div className={styles.pitch}>
          <p className={styles.eyebrow}>Your screen life, filed properly</p>
          <h1>A watchlist that becomes a record.</h1>
          <p className={styles.introCopy}>
            Keep the films and shows you mean to watch. Move them as you go.
            Let friends see the list, if that&apos;s your thing.
          </p>
          <Link className={styles.primaryAction} href={ctaHref}>
            {ctaLabel}
            <ArrowRight aria-hidden="true" />
          </Link>
          {SLATE_HOSTED ? (
            <Link className={styles.signIn} href="/login">
              Already have one? Sign in
            </Link>
          ) : null}
        </div>

        <div className={styles.introFoot}>
          <span>{SLATE_HOSTED ? "Free to use" : "Self-hostable"}</span>
          <span>Private until you say otherwise</span>
        </div>
      </aside>

      <div className={styles.profile}>
        <header className={styles.profileHeader}>
          <div className={styles.profileName}>
            <span className={styles.avatar}>M</span>
            <p>Maya&apos;s Slate</p>
          </div>
          <div className={styles.profileStats} aria-label="Profile totals">
            <span><b>34</b> up next</span>
            <span><b>3</b> watching</span>
            <span><b>168</b> watched</span>
          </div>
          <a href="#share">Share this profile ↗</a>
        </header>

        <section className={styles.shelf}>
          <div className={styles.shelfHeading}>
            <h2>Up next</h2>
            <p>The four she keeps moving to the front.</p>
          </div>
          <div className={styles.posterRow}>
            {queue.map((item) => (
              <figure className={styles.poster} key={item.title}>
                <div className={styles.posterImage}>
                  <Image
                    src={posterUrl(item.path, "w500")!}
                    alt={item.title}
                    fill
                    priority
                    sizes="(max-width: 640px) 39vw, (max-width: 900px) 24vw, 16vw"
                  />
                </div>
                <figcaption>
                  <strong>{item.title}</strong>
                  <span>{item.year}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={styles.nowWatching}>
          <div className={styles.nowLabel}>
            <span>Watching now</span>
            <span>Episode 5 of 10</span>
          </div>
          <div className={styles.nowTitle}>
            <p>Severance</p>
            <span>S02</span>
          </div>
          <div className={styles.progress} aria-label="48% watched"><i /></div>
          <p className={styles.note}>
            &ldquo;I do not trust a single corridor in this building.&rdquo;
          </p>
        </section>

        <section className={styles.diary}>
          <header>
            <h2>Recently watched</h2>
            <span>Summer 2026</span>
          </header>
          {diary.map(([date, title, year, rating]) => (
            <div className={styles.diaryRow} key={title}>
              <time>{date}</time>
              <strong>{title}</strong>
              <span>{year}</span>
              <span>{rating} ★</span>
            </div>
          ))}
        </section>

        <section className={styles.sharePanel} id="share">
          <div>
            <p className={styles.shareKicker}>slate.nishh.dev/maya</p>
            <h2>Send the whole thing, not 14 screenshots.</h2>
          </div>
          <div className={styles.shareDetails}>
            <p>
              A Slate stays private until its owner makes it public. Then it
              gets one link for the watchlist, what&apos;s in progress, and what
              they&apos;ve finished.
            </p>
            <Link href={ctaHref}>
              Make yours
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>

        <footer className={styles.profileFooter}>
          <span>Slate © 2026</span>
          <span>Google sign-in · Syncs across devices</span>
          <a href="https://github.com/gitshanks/slate" rel="noreferrer">Self-hosting ↗</a>
        </footer>
      </div>
    </main>
  );
}
