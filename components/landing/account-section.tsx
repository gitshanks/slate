import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bookmark, Clock3, Eye } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { SLATE_HOSTED } from "@/lib/public-mode";

const SHELVES = [
  {
    label: "Up next",
    count: "34 titles",
    icon: Bookmark,
    title: "Perfect Days",
    meta: "2023 · Drama",
    path: "/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg",
  },
  {
    label: "Watching",
    count: "6 titles",
    icon: Clock3,
    title: "The Bear",
    meta: "2022 · Series",
    path: "/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg",
  },
  {
    label: "Watched",
    count: "126 titles",
    icon: Eye,
    title: "Past Lives",
    meta: "2023 · Drama",
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
  },
];

export function AccountSection() {
  const hosted = SLATE_HOSTED;

  return (
    <section
      id="account"
      className="relative overflow-hidden bg-[#0c0a08] text-[#f3eadc]"
    >
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-18" />
      <div className="absolute right-[-20%] top-[-15%] h-[70%] w-[70%] bg-[radial-gradient(circle,rgba(222,117,72,0.12),transparent_62%)]" />

      <div className="relative mx-auto max-w-[1440px] px-5 pb-32 pt-28 sm:px-8 sm:pb-44 sm:pt-40 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-24">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/38">
              04 / Same slate everywhere
            </p>
            <h2 className="mt-5 max-w-[900px] text-balance text-[clamp(3.5rem,7vw,7.4rem)] font-medium leading-[0.84] tracking-[-0.07em]">
              One account.
              <br />
              <span className="landing-serif font-normal italic text-[#de7548]">
                No starting over.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-pretty text-base leading-relaxed text-white/52 sm:text-lg lg:pb-2">
            Sign in with Google and pick up on any screen. Your order, ratings,
            notes, and progress are already there.
          </p>
        </div>

        <div className="mt-16 grid border-y border-white/15 sm:mt-24 lg:grid-cols-[0.66fr_1.34fr]">
          <div className="flex flex-col justify-between border-b border-white/15 py-10 lg:border-b-0 lg:border-r lg:py-14 lg:pr-14">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/32">
                Maya&apos;s library
              </p>
              <p className="mt-5 text-[clamp(5rem,10vw,9rem)] font-medium leading-none tracking-[-0.08em] text-[#de7548]">
                166
              </p>
              <p className="mt-1 landing-serif text-2xl italic text-white/48">
                titles and counting
              </p>
            </div>

            <div className="mt-14">
              <p className="max-w-sm text-sm leading-relaxed text-white/45 sm:text-base">
                Add something on your phone. Reorder it on your laptop. Share
                the same profile from either.
              </p>
              <Link
                href={hosted ? "/login" : "/app"}
                className="group mt-8 inline-flex items-center gap-3 text-sm font-semibold text-[#f3eadc] underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#de7548]"
              >
                {hosted ? "Create your account" : "Open slate"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          <div className="lg:pl-14">
            <div className="flex items-center justify-between border-b border-white/12 py-5">
              <p className="text-sm font-semibold">The shelves</p>
              <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">
                <span className="h-1.5 w-1.5 bg-[#de7548]" />
                Synced now
              </div>
            </div>

            <div className="divide-y divide-white/12">
              {SHELVES.map((shelf, index) => {
                const Icon = shelf.icon;

                return (
                  <div
                    key={shelf.label}
                    className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-5 sm:grid-cols-[auto_0.7fr_1.3fr_auto] sm:gap-6 sm:py-6"
                  >
                    <span className="font-mono text-[9px] text-white/24">
                      0{index + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[#de7548]" />
                      <div>
                        <p className="text-sm font-medium">{shelf.label}</p>
                        <p className="mt-0.5 text-[10px] text-white/30">
                          {shelf.count}
                        </p>
                      </div>
                    </div>

                    <div className="hidden items-center gap-3 sm:flex">
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden border border-white/10 bg-white/5">
                        <Image
                          src={posterUrl(shelf.path, "w185")!}
                          alt={shelf.title}
                          fill
                          sizes="40px"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/70">
                          {shelf.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/28">
                          {shelf.meta}
                        </p>
                      </div>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-white/18 transition-transform group-hover:translate-x-1 group-hover:text-[#de7548]" />
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 border-t border-white/12">
              <LibraryStat label="Up next" value="34" />
              <LibraryStat label="Watching" value="6" />
              <LibraryStat label="Watched" value="126" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LibraryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/12 py-5 text-left last:border-r-0 sm:py-6">
      <p className="text-xl font-semibold tracking-[-0.03em] text-white/72">
        {value}
      </p>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/25">
        {label}
      </p>
    </div>
  );
}
