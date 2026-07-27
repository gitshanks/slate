import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GithubMark } from "@/components/landing/icons";
import { PosterWall } from "@/components/landing/poster-wall";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function Hero() {
  const hosted = SLATE_HOSTED;
  return (
    <section className="relative isolate overflow-hidden bg-[hsl(var(--hero-bg))] text-foreground">
      <PosterWall />

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-28 pb-32 text-center sm:px-8 sm:pt-40 sm:pb-44 lg:pt-48 lg:pb-52">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-mono backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {hosted ? "Your watchlist · share when you want" : "A private Letterboxd · for one"}
        </span>

        <h1 className="mt-7 max-w-[1100px] text-balance text-[44px] font-extrabold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-6xl lg:text-[72px] xl:text-[80px]">
          The watchlist that&apos;s
          <br className="hidden sm:block" />{" "}
          <span className="text-primary">
            actually yours.
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          Track everything you want to watch, are watching, and have loved.
          One fast app. No noisy social feed, no algorithm. Just your shelf
          {hosted ? ", synced and private until you share it." : ", on your machine."}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={hosted ? "/login" : "/app"}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-lg shadow-primary/15 transition-transform hover:-translate-y-px"
          >
            {hosted ? "Build your slate" : "Try the live demo"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card/70 px-5 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:bg-card"
          >
            <GithubMark className="h-4 w-4" />
            Self-host on GitHub
          </a>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          {hosted
            ? "Private by default · Public only when you choose · Still self-hostable"
            : "MIT licensed · Docker or Vercel · Your data never leaves your box."}
        </p>

        <p className="mt-3 text-xs text-muted-foreground">
          <a
            href="https://www.nishh.dev/slate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            Read the case study
            <ArrowRight className="h-3 w-3" />
          </a>
        </p>
      </div>

      {/* Hairline transition into the page background below. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-border/60" />
    </section>
  );
}
