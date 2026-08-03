import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PosterCarousel } from "@/components/landing/poster-carousel";
import { SLATE_HOSTED } from "@/lib/public-mode";
import styles from "./index-landing.module.css";

export function IndexLanding() {
  const createHref = SLATE_HOSTED ? "/login?mode=create" : "/app";
  const signInHref = SLATE_HOSTED ? "/login" : "/app";

  return (
    <main className={styles.page}>
      <PosterCarousel className={styles.backdrop} />
      <div className={styles.grain} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Slate home">
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={82}
            height={23}
            preload
          />
        </Link>
      </header>

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <h1 id="landing-title">
            <span className={styles.headlineLine}>Never lose a good</span>{" "}
            <span className={styles.headlineLine}>recommendation again.</span>
          </h1>
          <p>Save it. Watch it. Share it.</p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href={createHref}>
              {SLATE_HOSTED ? "Create your slate" : "Open Slate"}
            </Link>
            {SLATE_HOSTED ? (
              <Link className={styles.secondaryAction} href={signInHref}>
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      </section>

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
    </main>
  );
}
