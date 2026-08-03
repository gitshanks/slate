import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PosterCarousel } from "@/components/landing/poster-carousel";
import { ViewTransition } from "@/components/view-transition";
import { SLATE_HOSTED } from "@/lib/public-mode";
import styles from "./index-landing.module.css";

export function IndexLanding() {
  const createHref = SLATE_HOSTED ? "/login?mode=create" : "/app";
  const signInHref = SLATE_HOSTED ? "/login" : "/app";

  return (
    <main className={styles.page}>
      <ViewTransition name="slate-marketing-backdrop">
        <PosterCarousel className={styles.backdrop} />
      </ViewTransition>
      <ViewTransition name="slate-marketing-grain">
        <div className={styles.grain} aria-hidden="true" />
      </ViewTransition>

      <header className={styles.header}>
        <ViewTransition name="slate-marketing-logo">
          <Link href="/" className={styles.logo} aria-label="slate home">
            <Image
              src="/brand/logo-light.svg"
              alt="slate"
              width={82}
              height={23}
              preload
            />
          </Link>
        </ViewTransition>
      </header>

      <section className={styles.hero} aria-labelledby="landing-title">
        <ViewTransition
          name="slate-marketing-content"
          enter={{ "slate-auth-back": "slate-auth-back", default: "none" }}
          exit={{ "slate-auth-forward": "slate-auth-forward", default: "none" }}
          default="none"
        >
          <div className={styles.heroCopy}>
            <h1 id="landing-title">
              <span className={styles.headlineLine}>Never lose a good</span>{" "}
              <span className={styles.headlineLine}>recommendation again.</span>
            </h1>
            <div className={styles.actions}>
              <Link
                className={styles.primaryAction}
                href={createHref}
                transitionTypes={["slate-auth-forward"]}
              >
                {SLATE_HOSTED ? "Create your slate" : "Open slate"}
              </Link>
              {SLATE_HOSTED ? (
                <Link
                  className={styles.secondaryAction}
                  href={signInHref}
                  transitionTypes={["slate-auth-forward"]}
                >
                  Sign in
                </Link>
              ) : null}
            </div>
          </div>
        </ViewTransition>
      </section>

      <ViewTransition
        name="slate-marketing-footer"
        enter={{ "slate-auth-back": "slate-auth-footer", default: "none" }}
        exit={{ "slate-auth-forward": "slate-auth-footer", default: "none" }}
        default="none"
      >
        <footer className={styles.footer}>
          <span>{SLATE_HOSTED ? "Free · private by default" : "Open source · self-hostable"}</span>
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
            <ArrowUpRight aria-hidden="true" />
          </a>
        </footer>
      </ViewTransition>
    </main>
  );
}
