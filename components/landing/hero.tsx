import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GithubMark } from "@/components/landing/icons";
import { HeroMock } from "@/components/landing/hero-mock";

export function Hero() {
  return (
    <section className="relative">
      {/* Ambient gradient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-160px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl opacity-60 dark:opacity-50" />
        <div className="absolute left-[10%] top-[40%] h-[260px] w-[260px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute right-[5%] top-[20%] h-[300px] w-[300px] rounded-full bg-sky-500/15 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1200px] px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-mono backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            A private Letterboxd · for one
          </span>

          <h1 className="mt-6 text-balance text-5xl font-semibold tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            The watchlist that's
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-br from-primary via-fuchsia-400 to-sky-400 bg-clip-text text-transparent">
              actually yours.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Track everything you want to watch, are watching, and have loved.
            One fast app. No social network, no algorithm. Just your shelf,
            on your machine.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app"
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background shadow-lg shadow-primary/10 transition-transform hover:-translate-y-px"
            >
              Try the live demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://github.com/gitshanks/slate"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-card"
            >
              <GithubMark className="h-4 w-4" />
              Self-host on GitHub
            </a>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            MIT licensed · Docker or Vercel · Your data never leaves your box.
          </p>
        </div>

        <div className="relative mt-14 sm:mt-20">
          <HeroMock />
        </div>
      </div>
    </section>
  );
}
