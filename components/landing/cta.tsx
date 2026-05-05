import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GithubMark } from "@/components/landing/icons";

export function FinalCta() {
  return (
    <section className="relative border-t border-border/60 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">
            Decide what to watch tonight.
            <br />
            <span className="text-muted-foreground">
              Remember it tomorrow.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty text-muted-foreground">
            Try the live demo with seeded data, or pull the repo and have your
            own copy running before the kettle boils.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app"
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background shadow-lg shadow-primary/10 transition-transform hover:-translate-y-px"
            >
              Open the demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://github.com/gitshanks/slate"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-card"
            >
              <GithubMark className="h-4 w-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
