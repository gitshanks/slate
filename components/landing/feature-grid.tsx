import Image from "next/image";
import { Copy, Globe2, Link2, LockKeyhole } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";

const PROFILE_TITLES = [
  {
    title: "Parasite",
    path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  },
  {
    title: "Aftersun",
    path: "/jeXmhP2zbUkREMRqFOYIwQOk49T.jpg",
  },
  {
    title: "Past Lives",
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
  },
  {
    title: "The Holdovers",
    path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
  },
  {
    title: "Perfect Days",
    path: "/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg",
  },
];

const DETAILS = [
  {
    index: "01",
    title: "Add it fast",
    body: "Open search, type a few letters, and save the title before you forget why you opened the app.",
  },
  {
    index: "02",
    title: "Put it in order",
    body: "Hold a card and drag it where you want it. That order follows you on every device.",
  },
  {
    index: "03",
    title: "Save your take",
    body: "Mark it loved, liked, or disliked. Add a note when the rating needs context.",
  },
  {
    index: "04",
    title: "Bring your old lists",
    body: "Upload your Letterboxd or Trakt CSV. Slate carries over the titles and ratings without making duplicates.",
  },
];

export function FeatureGrid() {
  return (
    <section
      id="share"
      className="relative overflow-hidden bg-[#e9e6de] text-[#111113]"
    >
      <div className="landing-paper-grain pointer-events-none absolute inset-0 opacity-45" />

      <div className="relative mx-auto max-w-[1440px] px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
        <div className="grid items-center gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
          <div className="max-w-lg">
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-black/45">
              Share when you want
            </p>
            <h2 className="mt-5 text-balance text-[clamp(3rem,5.8vw,6rem)] font-semibold leading-[0.93] tracking-[-0.06em]">
              Private by default.
              <br />
              <span className="text-[#7957df]">Public in one tap.</span>
            </h2>
            <p className="mt-6 max-w-md text-pretty text-base leading-relaxed text-black/55 sm:text-lg">
              Send friends one link to everything you&apos;ve saved and watched.
              Turn it off whenever you like.
            </p>

            <div className="mt-8 flex items-center gap-5 text-xs font-medium text-black/52">
              <span className="inline-flex items-center gap-2">
                <LockKeyhole className="h-3.5 w-3.5" />
                Starts private
              </span>
              <span className="inline-flex items-center gap-2">
                <Globe2 className="h-3.5 w-3.5" />
                Turn off anytime
              </span>
            </div>
          </div>

          <PublicProfilePreview />
        </div>

        <ol className="mt-28 border-t border-black/15 sm:mt-40 lg:grid lg:grid-cols-4">
          {DETAILS.map((detail) => (
            <li
              key={detail.index}
              className="group border-b border-black/15 py-7 lg:border-b-0 lg:border-r lg:px-7 lg:py-9 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
            >
              <div className="flex gap-6 lg:block">
                <span className="font-mono text-[10px] tracking-[0.18em] text-black/35 transition-colors group-hover:text-[#7957df]">
                  {detail.index}
                </span>
                <div className="flex-1 lg:mt-8">
                  <h3 className="text-xl font-semibold tracking-[-0.025em]">
                    {detail.title}
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-black/52">
                    {detail.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PublicProfilePreview() {
  return (
    <div className="relative pb-8 sm:pb-12">
      <div className="overflow-hidden rounded-[26px] border border-black/10 bg-[#f8f7f3] shadow-[0_40px_90px_rgba(44,36,25,0.18)] sm:rounded-[34px]">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4 sm:px-8 sm:py-5">
          <span className="text-sm font-bold tracking-[-0.03em]">▰ slate</span>
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-black/38">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Public profile
          </div>
        </div>

        <div className="px-5 pb-6 pt-7 sm:px-8 sm:pb-9 sm:pt-9">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#19181c] text-sm font-semibold text-white sm:h-14 sm:w-14">
              MJ
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                Maya&apos;s slate
              </h3>
              <p className="mt-0.5 text-xs text-black/42">
                126 watched · 34 up next
              </p>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <p className="text-sm font-semibold">Recently loved</p>
            <span className="text-[10px] text-black/38">View all</span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
            {PROFILE_TITLES.map((item, index) => (
              <div
                key={item.title}
                className={`relative aspect-[2/3] overflow-hidden rounded-[10px] bg-black/5 ring-1 ring-black/10 ${
                  index > 2 ? "hidden sm:block" : ""
                }`}
              >
                <Image
                  src={posterUrl(item.path, "w342")!}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 28vw, 120px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 flex w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-black/10 bg-white/90 px-4 py-3 shadow-[0_18px_50px_rgba(44,36,25,0.17)] backdrop-blur-xl sm:left-auto sm:right-6 sm:w-auto sm:translate-x-0 sm:px-5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7957df]/12 text-[#7957df]">
          <Link2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 sm:min-w-[190px]">
          <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-black/35">
            Share link
          </p>
          <p className="mt-0.5 truncate text-xs font-medium">
            slate.nishh.dev/maya
          </p>
        </div>
        <Copy className="h-3.5 w-3.5 text-black/35" />
      </div>
    </div>
  );
}
