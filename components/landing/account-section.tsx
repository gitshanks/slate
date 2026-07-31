import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  Eye,
  RefreshCw,
} from "lucide-react";
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
      className="relative overflow-hidden bg-[#080809] text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(167,139,250,0.12),transparent_28%)]" />
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-10" />

      <div className="relative mx-auto max-w-[1440px] px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:gap-20">
          <div>
            <p className="landing-kicker">One account, every screen</p>
            <h2 className="mt-5 max-w-[980px] text-balance text-[clamp(3rem,7vw,7.1rem)] font-semibold leading-[0.91] tracking-[-0.065em]">
              Your list is ready
              <br />
              <span className="text-white/32">whenever you are.</span>
            </h2>
          </div>
          <p className="max-w-md text-pretty text-base leading-relaxed text-white/52 sm:text-lg lg:pb-2">
            Sign in with Google and pick up on any screen. Your custom order,
            ratings, notes, and progress are already there.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d0f] shadow-[0_40px_110px_rgba(0,0,0,0.4)] sm:mt-20 sm:rounded-[38px] lg:grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="flex flex-col border-b border-white/10 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#bba6ff]">
              <RefreshCw className="h-5 w-5" />
            </div>
            <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.24em] text-white/35">
              Your Slate account
            </p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              One library that keeps up.
            </h3>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/48 sm:text-base">
              Add something on your phone and it is waiting on your laptop.
              Change the order anywhere and it changes everywhere.
            </p>

            <ul className="mt-7 space-y-3 text-sm text-white/58">
              {["Films and series together", "Automatic sync", "Private until you share"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <Check className="h-3.5 w-3.5 text-[#a78bfa]" />
                    {item}
                  </li>
                ),
              )}
            </ul>

            <Link
              href={hosted ? "/login" : "/app"}
              className="group mt-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-[#c4b5fd]"
            >
              {hosted ? "Create your account" : "Open Slate"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="relative p-4 sm:p-6 lg:p-8">
            <div className="h-full overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#070708] sm:rounded-[26px]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7 sm:py-5">
                <div>
                  <p className="text-sm font-semibold tracking-[-0.02em] sm:text-base">
                    Maya&apos;s library
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/30">166 titles</p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Synced now
                </div>
              </div>

              <div className="divide-y divide-white/[0.07]">
                {SHELVES.map((shelf) => {
                  const Icon = shelf.icon;

                  return (
                    <div
                      key={shelf.label}
                      className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.025] sm:grid-cols-[0.7fr_1.3fr_auto] sm:px-7 sm:py-5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/45">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-medium">{shelf.label}</p>
                          <p className="mt-0.5 text-[10px] text-white/28">
                            {shelf.count}
                          </p>
                        </div>
                      </div>

                      <div className="hidden items-center gap-3 sm:flex">
                        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
                          <Image
                            src={posterUrl(shelf.path, "w185")!}
                            alt={shelf.title}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white/72">
                            {shelf.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-white/28">
                            {shelf.meta}
                          </p>
                        </div>
                      </div>

                      <ArrowRight className="h-3.5 w-3.5 text-white/22" />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 border-t border-white/[0.07]">
                <LibraryStat label="Up next" value="34" />
                <LibraryStat label="Watching" value="6" />
                <LibraryStat label="Watched" value="126" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LibraryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/[0.07] px-4 py-4 text-center last:border-r-0 sm:px-6">
      <p className="text-lg font-semibold tracking-[-0.03em] text-white/72">
        {value}
      </p>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/27">
        {label}
      </p>
    </div>
  );
}
