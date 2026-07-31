import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function FinalCta() {
  const hosted = SLATE_HOSTED;

  return (
    <section className="relative isolate overflow-hidden bg-[#de7548] text-[#1a0f09]">
      <div className="landing-paper-grain pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply" />
      <div className="pointer-events-none absolute -bottom-[0.22em] right-[-0.04em] font-sans text-[clamp(12rem,34vw,36rem)] font-semibold leading-none tracking-[-0.1em] text-black/[0.055]">
        S
      </div>

      <div className="relative mx-auto grid max-w-[1440px] gap-14 px-5 py-28 sm:px-8 sm:py-40 lg:grid-cols-[1fr_auto] lg:items-end lg:px-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/48">
            Start with one title
          </p>
          <h2 className="mt-5 max-w-[1050px] text-balance text-[clamp(3.7rem,8vw,8.7rem)] font-medium leading-[0.82] tracking-[-0.075em]">
            The one you keep
            <br />
            <span className="landing-serif font-normal italic text-[#f6e9d9]">
              forgetting to watch.
            </span>
          </h2>
        </div>

        <div className="flex flex-col items-start gap-5 lg:items-end lg:pb-2">
          <Link
            href={hosted ? "/login" : "/app"}
            className="group inline-flex h-13 items-center gap-3 rounded-[3px] bg-[#17120e] px-6 text-sm font-semibold text-[#f3eadc] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {hosted ? "Join Slate" : "Try the demo"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#inside"
            className="text-sm font-medium underline decoration-black/25 underline-offset-4 transition-colors hover:text-[#f6e9d9]"
          >
            Take another look
          </a>
        </div>
      </div>
    </section>
  );
}
