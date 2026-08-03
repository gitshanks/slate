import Link from "next/link";
import { ArrowDownRight, ArrowRight } from "lucide-react";
import { PosterWall } from "@/components/landing/poster-wall";
import { PosterTrail } from "@/components/landing/poster-trail";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function Hero() {
  const hosted = SLATE_HOSTED;

  return (
    <section className="relative isolate bg-[#0c0a08] text-[#f3eadc]">
      <PosterTrail className="flex min-h-[100svh]">
        <PosterWall />

        <div className="relative z-20 mx-auto flex w-full max-w-[1440px] flex-col justify-end px-5 pb-20 pt-32 sm:px-8 sm:pb-24 sm:pt-40 lg:px-12 lg:pb-20">
          <div className="max-w-[860px]">
            <p className="landing-hero-enter max-w-sm text-sm leading-relaxed text-[#f3eadc]/58 sm:text-base">
              A personal home for film and television.
            </p>

            <h1 className="landing-hero-enter landing-hero-enter-delay mt-5 text-balance text-[clamp(4rem,9.2vw,9.5rem)] font-medium leading-[0.78] tracking-[-0.075em]">
              Put your
              <br />
              <span className="landing-serif font-normal italic text-[#de7548]">
                screen life
              </span>
              <br />
              in order.
            </h1>

            <div className="landing-hero-enter landing-hero-enter-delay-2 mt-8 grid max-w-[740px] gap-7 border-t border-[#f3eadc]/20 pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <p className="max-w-[520px] text-pretty text-sm leading-relaxed text-[#f3eadc]/62 sm:text-base">
                Save the title. Move it when you start. Rate it when you&apos;re
                done. Share the whole profile with friends if you want.
              </p>

              <div className="flex items-center">
                <Link
                  href={hosted ? "/login" : "/app"}
                  className="group inline-flex h-12 items-center gap-3 rounded-[3px] bg-[#de7548] px-5 text-sm font-semibold text-[#160d08] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#eb8557] active:translate-y-0"
                >
                  {hosted ? "Join slate" : "Try the demo"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="landing-hero-enter landing-hero-enter-delay-3 mt-12 flex items-end justify-between gap-8 border-t border-[#f3eadc]/12 pt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-[#f3eadc]/35 lg:mt-16">
            <span>{hosted ? "Free · Private by default" : "Open source · Self hostable"}</span>
            <a
              href="#inside"
              aria-label="Explore slate"
              className="inline-flex items-center gap-2 transition-colors hover:text-[#f3eadc]"
            >
              Scroll to explore
              <ArrowDownRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </PosterTrail>
    </section>
  );
}
