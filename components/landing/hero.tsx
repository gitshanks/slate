import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GithubMark } from "@/components/landing/icons";
import { PosterWall } from "@/components/landing/poster-wall";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#08080a] text-white">
      <PosterWall />

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-28 pb-32 text-center sm:px-8 sm:pt-40 sm:pb-44 lg:pt-48 lg:pb-52">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70 font-mono backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          A private Letterboxd · for one
        </span>

        <h1 className="mt-7 max-w-[1100px] text-balance text-[44px] font-extrabold leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl lg:text-[72px] xl:text-[80px]">
          The watchlist that's
          <br className="hidden sm:block" />{" "}
          <span className="text-primary">
            actually yours.
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-pretty text-base text-white/65 sm:text-lg">
          Track everything you want to watch, are watching, and have loved.
          One fast app. No social network, no algorithm. Just your shelf,
          on your machine.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/app"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black shadow-[0_10px_40px_-10px_rgba(255,255,255,0.35)] transition-transform hover:-translate-y-px"
          >
            Try the live demo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/[0.08]"
          >
            <GithubMark className="h-4 w-4" />
            Self-host on GitHub
          </a>
        </div>

        <p className="mt-6 text-xs text-white/45">
          MIT licensed · Docker or Vercel · Your data never leaves your box.
        </p>

        <p className="mt-3 text-xs text-white/45">
          <a
            href="https://www.nishh.dev/slate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-white"
          >
            Read the case study
            <ArrowRight className="h-3 w-3" />
          </a>
        </p>
      </div>

      {/* Hairline transition into the page background below. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/5" />
    </section>
  );
}
