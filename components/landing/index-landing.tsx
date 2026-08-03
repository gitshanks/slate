"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SLATE_HOSTED } from "@/lib/public-mode";
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

  return (
    <main className={styles.page} data-auth-open={authOpen ? "true" : "false"}>
      {backdrop}
      <div className={styles.grain} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="slate home" scroll={false}>
          <Image
            src="/brand/logo-light.svg"
            alt="slate"
            width={82}
            height={23}
            preload
          />
        </Link>
      </header>

      <div
        className={styles.landingContent}
        aria-hidden={authOpen}
        inert={authOpen ? true : undefined}
      >
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <h1 id="landing-title">
              <span className={styles.headlineLine}>Never lose a good</span>{" "}
              <span className={styles.headlineLine}>recommendation again.</span>
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
      </div>

      <div className={styles.routeOverlay}>{children}</div>
    </main>
  );
}
