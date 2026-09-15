"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  Check,
  Eye,
  Heart,
  LockKeyhole,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { posterUrl } from "@/lib/tmdb-image";
import styles from "./index-landing.module.css";

const SHELVES = {
  Watchlist: [
    {
      title: "Past Lives",
      detail: "2023 · Film",
      path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    },
    {
      title: "Dune: Part Two",
      detail: "2024 · Film",
      path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    },
    {
      title: "Perfect Days",
      detail: "2023 · Film",
      path: "/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg",
    },
  ],
  Watching: [
    {
      title: "Severance",
      detail: "S1 · E4",
      path: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    },
    {
      title: "Succession",
      detail: "S2 · E5",
      path: "/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg",
    },
    {
      title: "The Bear",
      detail: "S1 · E3",
      path: "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
    },
  ],
  Watched: [
    {
      title: "Parasite",
      detail: "2019 · Film",
      path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    },
    {
      title: "The Holdovers",
      detail: "2023 · Film",
      path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
    },
    {
      title: "La La Land",
      detail: "2016 · Film",
      path: "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    },
  ],
};
type Shelf = keyof typeof SHELVES;
const SHELF_NAMES = Object.keys(SHELVES) as Shelf[];
const SHELF_ICONS = { Watchlist: Bookmark, Watching: Eye, Watched: Check };

const FAQS = [
  {
    question: "What is slate?",
    answer:
      "A personal home for the films and shows you want to watch, are watching, and have loved. Save recommendations, make lists, and keep track of what’s next.",
  },
  {
    question: "Is slate free?",
    answer: SLATE_HOSTED
      ? "Yes. Slate is free to use and open source. You can also host your own copy."
      : "Slate is open source and free to self-host. Your hosting and connected services may have their own costs.",
  },
  {
    question: "Who can see my library?",
    answer: SLATE_HOSTED
      ? "Your profile starts private. When you want to share, make it public and send a read-only link to your shelves. You can turn sharing off again whenever you like."
      : "On the hosted app, your profile starts private and sharing is your choice. If you self-host, you control who can access your instance.",
  },
  {
    question: "Can I bring my watch history?",
    answer:
      "Yes. Import your watched history from Letterboxd or Trakt with a CSV export. Slate matches the titles and skips anything already in your library.",
  },
  {
    question: "Can I use it on my phone?",
    answer: SLATE_HOSTED
      ? "Yes. Slate works in your browser on phones, tablets, and desktops. Sign in with the same Google account to keep your library with you."
      : "Yes. Open your Slate instance in a browser on your phone, tablet, or desktop.",
  },
];

export function LandingDetails({ createHref }: { createHref: string }) {
  return (
    <div className={styles.details}>
      <section
        id="features"
        className={styles.features}
        aria-labelledby="features-title"
        tabIndex={-1}
      >
        <div className={styles.sectionIntro}>
          <h2 id="features-title">
            Good recommendations.
            <br />
            All in one place.
          </h2>
          <p>
            The films friends mention. The shows you mean to start.
            <br className={styles.desktopBreak} /> A little space to keep them
            all.
          </p>
        </div>

        <div className={styles.featureLayout}>
          <LibraryPreview />
          <div className={styles.featureList}>
            <article className={styles.feature}>
              <span className={styles.featureIcon}>
                <Search aria-hidden="true" />
              </span>
              <div>
                <h3>Save it before you forget.</h3>
                <p>
                  Find a film or show and add it to your watchlist. The next
                  great recommendation has a home.
                </p>
              </div>
            </article>
            <article className={styles.feature}>
              <span className={styles.featureIcon}>
                <Bookmark aria-hidden="true" />
              </span>
              <div>
                <h3>A place for every phase.</h3>
                <p>
                  Watchlist, Watching, Watched. Keep your episode, collect your
                  favorites, and remember what you loved.
                </p>
              </div>
            </article>
            <article className={styles.feature}>
              <span className={styles.featureIcon}>
                <LockKeyhole aria-hidden="true" />
              </span>
              <div>
                <h3>
                  {SLATE_HOSTED
                    ? "Your taste. Your choice."
                    : "Make it your own."}
                </h3>
                <p>
                  {SLATE_HOSTED
                    ? "Private from the start. Share a read-only view of your shelves when you want to let someone in."
                    : "Choose a theme and accent that feel like you. Slate is open source, with the option to host your own copy."}
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.faqIntro}>
          <h2 id="faq-title">
            A few things
            <br /> you might wonder.
          </h2>
          <p>Small details, before you settle in.</p>
        </div>
        <div className={styles.faqList}>
          {FAQS.map(({ question, answer }) => (
            <details key={question} className={styles.faqItem}>
              <summary>
                {question}
                <Plus aria-hidden="true" />
              </summary>
              <div className={styles.faqAnswer}>
                <p>{answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-title">
        <Bookmark className={styles.closingIcon} aria-hidden="true" />
        <h2 id="closing-title">
          Make room for
          <br />
          your next great watch.
        </h2>
        <p>Start with the one you’ve been meaning to see.</p>
        <Link className={styles.primaryAction} href={createHref} scroll={false}>
          {SLATE_HOSTED ? "Create your slate" : "Open slate"}
        </Link>
        <span className={styles.closingNote}>
          {SLATE_HOSTED
            ? "Free. Private by default. Yours to fill."
            : "Open source. Yours to make your own."}
        </span>
      </section>
    </div>
  );
}

function LibraryPreview() {
  const [shelf, setShelf] = useState<Shelf>("Watchlist");
  return (
    <figure
      className={styles.libraryPreview}
      aria-label="Example Slate library"
    >
      <div className={styles.libraryWindow}>
        <div className={styles.libraryHeader}>
          <span>Your library</span>
          <span className={styles.privateBadge}>
            <LockKeyhole aria-hidden="true" />{" "}
            {SLATE_HOSTED ? "Private" : "Personal"}
          </span>
        </div>
        <div
          className={styles.shelfPicker}
          role="group"
          aria-label="Preview a shelf"
        >
          {SHELF_NAMES.map((name) => {
            const Icon = SHELF_ICONS[name];
            return (
              <button
                key={name}
                type="button"
                aria-pressed={shelf === name}
                onClick={() => setShelf(name)}
              >
                <Icon aria-hidden="true" />
                {name}
              </button>
            );
          })}
        </div>
        <div
          className={styles.previewPosters}
          aria-live="polite"
          aria-atomic="true"
        >
          {SHELVES[shelf].map((title) => (
            <div className={styles.previewTitle} key={title.title}>
              <div className={styles.previewPoster}>
                <Image
                  src={posterUrl(title.path, "w500")!}
                  alt=""
                  width={200}
                  height={300}
                  sizes="(max-width: 640px) 28vw, 170px"
                />
                {shelf === "Watched" && (
                  <span className={styles.lovedBadge}>
                    <Heart aria-hidden="true" />
                    <span className={styles.srOnly}>Loved</span>
                  </span>
                )}
              </div>
              <h3>{title.title}</h3>
              <p className={shelf === "Watching" ? styles.episode : undefined}>
                {title.detail}
              </p>
            </div>
          ))}
        </div>
        <div className={styles.libraryStatus}>
          <span>
            {shelf === "Watchlist"
              ? "Good things ahead."
              : shelf === "Watching"
                ? "Right where you left off."
                : "Worth remembering."}
          </span>
          <span>3 titles</span>
        </div>
      </div>
      <figcaption>A peek at your slate. Pick a shelf to explore.</figcaption>
    </figure>
  );
}
