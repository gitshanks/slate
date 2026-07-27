import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GithubMark } from "@/components/landing/icons";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function FinalCta() {
  const hosted = SLATE_HOSTED;

  return (
    <section className="relative isolate overflow-hidden bg-[#a78bfa] text-[#100d17]">
      <div className="landing-paper-grain pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay" />
      <div className="absolute -right-[12%] -top-[65%] h-[700px] w-[700px] rounded-full border border-black/10" />
      <div className="absolute -right-[2%] -top-[45%] h-[500px] w-[500px] rounded-full border border-black/10" />

      <div className="relative mx-auto max-w-[1440px] px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/52">
          Your next watch starts here
        </p>
        <h2 className="mt-5 max-w-[1100px] text-balance text-[clamp(3.5rem,8vw,8.4rem)] font-bold leading-[0.88] tracking-[-0.07em]">
          Make a little room
          <br />
          for what&apos;s next.
        </h2>

        <div className="mt-10 flex flex-col gap-4 sm:mt-12 sm:flex-row sm:items-center">
          <Link
            href={hosted ? "/login" : "/app"}
            className="group inline-flex h-13 w-fit items-center gap-2 rounded-full bg-[#111113] px-6 text-sm font-semibold text-white transition-transform hover:scale-[1.025] active:scale-[0.98]"
          >
            {hosted ? "Create your slate" : "Open the demo"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-13 w-fit items-center gap-2 rounded-full border border-black/20 px-6 text-sm font-semibold transition-colors hover:bg-black/5"
          >
            <GithubMark className="h-4 w-4" />
            Self-host on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
