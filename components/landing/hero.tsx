import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { PosterWall } from "@/components/landing/poster-wall";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function Hero() {
  const hosted = SLATE_HOSTED;

  return (
    <section className="relative isolate flex min-h-[100svh] overflow-hidden bg-[#060607] text-white">
      <PosterWall />

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center justify-center px-5 pb-24 pt-28 text-center sm:px-8 sm:pb-28 sm:pt-32 lg:px-12">
        <p className="landing-hero-enter font-mono text-[10px] uppercase tracking-[0.28em] text-white/55 sm:text-[11px]">
          Films, series, and everything in between
        </p>

        <h1 className="landing-hero-enter landing-hero-enter-delay mt-6 max-w-[1120px] text-balance text-[clamp(3.3rem,8.7vw,8.2rem)] font-extrabold leading-[0.88] tracking-[-0.065em]">
          A better home for
          <br />
          <span className="text-[#a78bfa]">everything you watch.</span>
        </h1>

        <p className="landing-hero-enter landing-hero-enter-delay-2 mx-auto mt-7 max-w-[580px] text-pretty text-[15px] leading-relaxed text-white/62 sm:mt-8 sm:text-lg">
          Save what you want to see, keep track of what you&apos;re watching, and
          remember what was worth recommending. Your profile is yours to keep
          private or share with friends.
        </p>

        <div className="landing-hero-enter landing-hero-enter-delay-3 mt-8 flex flex-col items-center gap-4 sm:mt-10 sm:flex-row">
          <Link
            href={hosted ? "/login" : "/app"}
            className="group inline-flex h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black shadow-[0_14px_50px_rgba(255,255,255,0.12)] transition-transform hover:scale-[1.025] active:scale-[0.98]"
          >
            {hosted ? "Join Slate" : "Try the demo"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#inside"
            className="inline-flex h-13 items-center rounded-full border border-white/15 bg-black/25 px-6 text-sm font-medium text-white backdrop-blur-xl transition-colors hover:bg-white/10"
          >
            See what it does
          </a>
        </div>

        <p className="landing-hero-enter landing-hero-enter-delay-3 mt-5 text-[11px] text-white/38">
          {hosted
            ? "Free to join · Private until you share"
            : "MIT licensed · Runs anywhere Docker does"}
        </p>
      </div>

      <a
        href="#inside"
        aria-label="Explore Slate"
        className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35 transition-colors hover:text-white/70 sm:bottom-9"
      >
        Explore
        <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
      </a>
    </section>
  );
}
