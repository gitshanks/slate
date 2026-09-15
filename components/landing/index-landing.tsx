"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { LandingDetails } from "./landing-details";
import styles from "./index-landing.module.css";

export function IndexLanding({
  backdrop,
  children,
}: {
  backdrop: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const authOpen = pathname === "/login";
  const createHref = SLATE_HOSTED ? "/login?mode=create" : "/app";
  const signInHref = SLATE_HOSTED ? "/login" : "/app";
  const splashRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: splashRef,
    offset: ["start start", "end start"],
  });
  // Scrub directly with native scroll: no wheel interception or spring lag.
  const transform = useTransform(
    scrollYProgress,
    [0, 0.65],
    ["scale(1)", "scale(0.94)"],
  );
  const opacity = useTransform(scrollYProgress, [0, 0.18, 0.8], [1, 1, 0.3]);

  function rememberAuthTrigger(event: MouseEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      'a[href^="/login"]',
    );
    if (!link) return;
    document
      .querySelector("[data-slate-auth-trigger]")
      ?.removeAttribute("data-slate-auth-trigger");
    link.setAttribute("data-slate-auth-trigger", "true");
  }

  return (
    <main className={styles.page} data-auth-open={authOpen ? "true" : "false"}>
      <div
        className={styles.landingContent}
        aria-hidden={authOpen}
        inert={authOpen ? true : undefined}
        onClickCapture={rememberAuthTrigger}
      >
        <div className={styles.splashTrack} ref={splashRef}>
          <div className={styles.splashSticky}>
            <motion.div
              className={styles.splashSurface}
              style={reduceMotion ? undefined : { transform, opacity }}
            >
              {backdrop}
              <div className={styles.grain} aria-hidden="true" />
              <header className={styles.header}>
                <Link
                  href="/"
                  className={styles.logo}
                  aria-label="slate home"
                  scroll={false}
                >
                  <Image
                    src="/brand/logo-light.svg"
                    alt="slate"
                    width={82}
                    height={23}
                    preload
                  />
                </Link>
              </header>

              <section className={styles.hero} aria-labelledby="landing-title">
                <div className={styles.heroCopy}>
                  <h1 id="landing-title">
                    <span className={styles.headlineLine}>
                      Never lose a good
                    </span>{" "}
                    <span className={styles.headlineLine}>
                      recommendation again.
                    </span>
                  </h1>
                  <div className={styles.actions}>
                    <Link
                      className={styles.primaryAction}
                      href={createHref}
                      scroll={false}
                    >
                      {SLATE_HOSTED ? "Create your slate" : "Open slate"}
                    </Link>
                    {SLATE_HOSTED ? (
                      <Link
                        className={styles.secondaryAction}
                        href={signInHref}
                        scroll={false}
                      >
                        Sign in
                      </Link>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className={styles.splashFooter}>
                <span>
                  {SLATE_HOSTED
                    ? "Free · private by default"
                    : "Open source · self-hostable"}
                </span>
                <a href="#features" className={styles.explore}>
                  A little more about slate
                  <ArrowDown aria-hidden="true" />
                </a>
              </div>
            </motion.div>
          </div>
        </div>

        <LandingDetails createHref={createHref} />

        <footer className={styles.footer}>
          <Link href="/" aria-label="slate home">
            <Image
              src="/brand/logo-light.svg"
              alt="slate"
              width={68}
              height={20}
            />
          </Link>
          <span>A little space for your next great watch.</span>
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight aria-hidden="true" />
          </a>
        </footer>
      </div>

      <div className={styles.routeOverlay}>{children}</div>
    </main>
  );
}
