"use client";

import Link from "next/link";
import { Bookmark, Plus } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { LandingPreviews } from "./landing-previews";
import styles from "./index-landing.module.css";

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
  const featuresRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: featuresRef,
    offset: ["start end", "start 45%"],
  });
  // Measure the stable section and settle before the player becomes active.
  // Native scroll drives the entrance directly, matching the splash pullback.
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    ["scale(0.94)", "scale(1)"],
  );

  return (
    <div className={styles.details}>
      <section
        id="features"
        ref={featuresRef}
        className={styles.features}
        aria-labelledby="features-title"
        tabIndex={-1}
      >
        <motion.div
          className={styles.featuresSurface}
          style={reduceMotion ? undefined : { transform }}
        >
          <div className={styles.sectionIntro}>
            <h2 id="features-title">
              A preview of
              <br />
              what’s next.
            </h2>
          </div>
          <LandingPreviews saveHref={createHref} />
        </motion.div>
      </section>

      <section
        id="faq"
        className={styles.faq}
        aria-label="Frequently asked questions"
      >
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
