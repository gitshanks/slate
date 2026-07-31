import Image from "next/image";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Eye,
  Film,
  Heart,
  Search,
  Sparkles,
} from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";

const LIBRARY_TITLES = [
  {
    title: "Past Lives",
    year: "2023",
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    rating: "8.0",
  },
  {
    title: "Dune: Part Two",
    year: "2024",
    path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    rating: "8.5",
  },
  {
    title: "The Holdovers",
    year: "2023",
    path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
    rating: "7.9",
  },
  {
    title: "Knives Out",
    year: "2019",
    path: "/pThyQovXQrw2m0s9x82twj48Jq4.jpg",
    rating: "7.9",
  },
  {
    title: "La La Land",
    year: "2016",
    path: "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    rating: "8.0",
  },
  {
    title: "Spirited Away",
    year: "2001",
    path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    rating: "8.6",
  },
];

const AI_RESULTS = [
  {
    title: "Perfect Days",
    meta: "2023 · Drama",
    path: "/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg",
    match: "97%",
  },
  {
    title: "Past Lives",
    meta: "2023 · Drama",
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    match: "94%",
  },
  {
    title: "The Holdovers",
    meta: "2023 · Comedy drama",
    path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
    match: "91%",
  },
];

export function Showcase() {
  return (
    <section
      id="inside"
      className="relative overflow-hidden bg-[#080809] text-white"
    >
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative mx-auto max-w-[1440px] px-5 pb-28 pt-28 sm:px-8 sm:pb-40 sm:pt-40 lg:px-12">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.5fr)] lg:gap-20">
          <div>
            <p className="landing-kicker">The app</p>
            <h2 className="mt-5 max-w-[980px] text-balance text-[clamp(3rem,7vw,7.25rem)] font-bold leading-[0.92] tracking-[-0.06em]">
              Everything you want to watch.
              <br />
              <span className="text-white/35">In the order you want it.</span>
            </h2>
          </div>
          <p className="max-w-md text-pretty text-base leading-relaxed text-white/52 sm:text-lg lg:pb-2">
            Add a film or show, drag it where you want it, then move on. No
            algorithm gets a vote.
          </p>
        </div>

        <div className="mt-14 sm:mt-20">
          <LibraryPreview />
        </div>

        <div className="mt-32 grid items-center gap-12 sm:mt-44 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
          <div className="max-w-lg">
            <p className="landing-kicker">Search</p>
            <h3 className="mt-5 text-balance text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-[0.96] tracking-[-0.055em]">
              Type a title.
              <br />
              <span className="text-[#a78bfa]">Or describe the mood.</span>
            </h3>
            <p className="mt-6 text-pretty text-base leading-relaxed text-white/52 sm:text-lg">
              Try “something quiet and strange for Sunday night.” Slate
              searches TMDB and leaves out anything you&apos;ve already saved or
              watched.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/45">
              <span className="inline-flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#a78bfa]" />
                Search as you type
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#a78bfa]" />
                Checks your library
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#a78bfa]" />
                Use your own model
              </span>
            </div>
          </div>

          <AiSearchStage />
        </div>
      </div>
    </section>
  );
}

function LibraryPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-16 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(140,105,255,0.16),transparent_68%)] blur-2xl" />

      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0d0f] shadow-[0_45px_120px_rgba(0,0,0,0.65)] sm:rounded-[34px]">
        <div className="flex h-12 items-center border-b border-white/[0.07] px-4 sm:h-14 sm:px-6">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/16" />
            <span className="h-2 w-2 rounded-full bg-white/10" />
            <span className="h-2 w-2 rounded-full bg-white/10" />
          </div>
          <div className="mx-auto hidden items-center gap-2 rounded-full border border-white/[0.07] bg-black/20 px-4 py-1.5 font-mono text-[9px] tracking-wide text-white/30 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
            slate.nishh.dev
          </div>
          <div className="flex w-8 justify-end">
            <span className="h-6 w-6 rounded-full bg-[#a78bfa]/25 ring-1 ring-[#a78bfa]/35" />
          </div>
        </div>

        <div className="px-4 pb-6 pt-7 sm:px-8 sm:pb-10 sm:pt-10 lg:px-12 lg:pb-14">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/35 sm:text-[10px]">
                Your watchlist
              </p>
              <h3 className="mt-1.5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Up next
              </h3>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full bg-[#a78bfa] px-3 py-1.5 text-xs font-semibold text-[#100b1e]">
                All
              </span>
              <span className="rounded-full px-3 py-1.5 text-xs text-white/45">
                Films
              </span>
              <span className="rounded-full px-3 py-1.5 text-xs text-white/45">
                Series
              </span>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-9 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-6 lg:gap-x-5">
            {LIBRARY_TITLES.map((item, index) => (
              <article
                key={item.title}
                className={
                  index > 3
                    ? "hidden sm:block"
                    : index > 1
                      ? "hidden min-[470px]:block"
                      : ""
                }
              >
                <div className="group relative aspect-[2/3] overflow-hidden rounded-[13px] bg-white/5 ring-1 ring-white/10 sm:rounded-[16px]">
                  <Image
                    src={posterUrl(item.path, "w342")!}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 44vw, (max-width: 1024px) 28vw, 15vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8">
                    <span className="rounded-full bg-black/50 px-2 py-1 font-mono text-[9px] text-white/75 backdrop-blur">
                      IMDb {item.rating}
                    </span>
                    {index === 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
                        <Bookmark className="h-3 w-3 fill-current" />
                      </span>
                    ) : null}
                  </div>
                </div>
                <h4 className="mt-3 truncate text-sm font-medium sm:text-base">
                  {item.title}
                </h4>
                <p className="mt-0.5 text-xs text-white/35">{item.year}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#18171c]/90 px-4 py-2.5 text-[11px] text-white/65 shadow-2xl backdrop-blur-xl sm:flex">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#a78bfa]/20 text-[#c4b5fd]">
          <ArrowUpRight className="h-3 w-3" />
        </span>
        Press and hold any title to reorder
      </div>
    </div>
  );
}

function AiSearchStage() {
  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-[28px] border border-white/10 bg-[#111014] p-5 shadow-[0_40px_100px_rgba(0,0,0,0.45)] sm:min-h-[590px] sm:rounded-[36px] sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(167,139,250,0.18),transparent_36%)]" />
      <div className="absolute inset-x-6 bottom-0 grid translate-y-[28%] grid-cols-3 gap-3 opacity-35 blur-[1px] sm:inset-x-10 sm:gap-5">
        {LIBRARY_TITLES.slice(0, 3).map((item) => (
          <div
            key={item.title}
            className="relative aspect-[2/3] overflow-hidden rounded-xl"
          >
            <Image
              src={posterUrl(item.path, "w342")!}
              alt=""
              fill
              sizes="180px"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <div className="relative mx-auto mt-12 max-w-[570px] overflow-hidden rounded-[20px] border border-white/12 bg-[#151419]/95 shadow-[0_28px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:mt-20">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
          <Sparkles className="h-4 w-4 shrink-0 text-[#bba6ff]" />
          <p className="min-w-0 flex-1 truncate text-sm text-white/88 sm:text-base">
            slow films where not much happens, in a good way
          </p>
          <span className="rounded-full bg-[#a78bfa]/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c4b5fd]">
            Ask AI
          </span>
        </div>

        <ul className="divide-y divide-white/[0.07]">
          {AI_RESULTS.map((item, index) => (
            <li
              key={item.title}
              className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${
                index === 0 ? "bg-white/[0.045]" : ""
              }`}
            >
              <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-white/5">
                <Image
                  src={posterUrl(item.path, "w185")!}
                  alt={item.title}
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-white/35">
                  {item.meta}
                </span>
              </span>
              <span className="font-mono text-[10px] text-[#bba6ff]">
                {item.match} match
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white/28 sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <Search className="h-3 w-3" /> 3 suggestions
          </span>
          <span>Enter to save</span>
        </div>
      </div>

      <div className="absolute left-7 top-7 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/28 sm:left-9 sm:top-9">
        <Film className="h-3.5 w-3.5" />
        Browse by mood
      </div>
      <div className="absolute bottom-6 right-6 hidden items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[10px] text-white/45 backdrop-blur sm:flex">
        <Eye className="h-3.5 w-3.5" /> Already watched? Skipped.
        <Heart className="ml-1 h-3.5 w-3.5 text-[#a78bfa]" />
      </div>
    </div>
  );
}
