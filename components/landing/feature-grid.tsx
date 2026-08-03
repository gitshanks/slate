import Image from "next/image";
import { ArrowUpRight, Globe2, LockKeyhole } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";

const PROFILE_TITLES = [
  { title: "Parasite", path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
  { title: "Aftersun", path: "/jeXmhP2zbUkREMRqFOYIwQOk49T.jpg" },
  { title: "Past Lives", path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg" },
  { title: "The Holdovers", path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg" },
  { title: "Perfect Days", path: "/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg" },
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
    title: "Bring the old list",
    body: "Upload your Letterboxd or Trakt CSV. slate carries over the titles and ratings without duplicates.",
  },
];

export function FeatureGrid() {
  return (
    <section
      id="share"
      className="relative overflow-hidden border-y border-black/20 bg-[#ce6741] text-[#1b100b]"
    >
      <div className="landing-paper-grain pointer-events-none absolute inset-0 opacity-28 mix-blend-multiply" />

      <div className="relative mx-auto max-w-[1440px] px-5 pb-32 pt-28 sm:px-8 sm:pb-44 sm:pt-40 lg:px-12">
        <div className="grid items-start gap-16 lg:grid-cols-[0.68fr_1.32fr] lg:gap-24">
          <div className="max-w-lg lg:sticky lg:top-32">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/48">
              03 / Your profile
            </p>
            <h2 className="mt-5 text-balance text-[clamp(3.3rem,5.8vw,6.2rem)] font-medium leading-[0.86] tracking-[-0.065em]">
              Your list.
              <br />
              <span className="landing-serif font-normal italic text-[#f5e8d7]">
                Your audience.
              </span>
            </h2>
            <p className="mt-7 max-w-md text-pretty text-base leading-relaxed text-black/60 sm:text-lg">
              slate starts private. When you want to show a friend what you
              loved, send one link to the whole profile.
            </p>

            <div className="mt-9 grid grid-cols-2 border-y border-black/20 text-xs font-medium text-black/58">
              <span className="inline-flex items-center gap-2 border-r border-black/20 py-4 pr-4">
                <LockKeyhole className="h-3.5 w-3.5" />
                Private first
              </span>
              <span className="inline-flex items-center gap-2 py-4 pl-4">
                <Globe2 className="h-3.5 w-3.5" />
                Public when ready
              </span>
            </div>
          </div>

          <PublicProfilePreview />
        </div>

        <ol className="mt-28 border-t border-black/25 sm:mt-40 lg:grid lg:grid-cols-[0.85fr_1.15fr_0.85fr_1.15fr]">
          {DETAILS.map((detail) => (
            <li
              key={detail.index}
              className="group border-b border-black/25 py-7 lg:border-b-0 lg:border-r lg:px-7 lg:py-9 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
            >
              <div className="flex gap-6 lg:block">
                <span className="font-mono text-[10px] tracking-[0.18em] text-black/38 transition-colors group-hover:text-black">
                  {detail.index}
                </span>
                <div className="flex-1 lg:mt-12">
                  <h3 className="text-xl font-semibold tracking-[-0.025em]">
                    {detail.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-black/55">
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
    <div className="border border-black/25 bg-[#efe7da] shadow-[18px_22px_0_rgba(45,24,15,0.14)]">
      <div className="flex items-center justify-between border-b border-black/15 px-5 py-4 sm:px-8 sm:py-5">
        <span className="text-sm font-bold tracking-[-0.03em]">▰ slate</span>
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-black/42">
          <span className="h-1.5 w-1.5 bg-[#ce6741]" />
          Public profile
        </div>
      </div>

      <div className="px-5 pb-7 pt-8 sm:px-8 sm:pb-10 sm:pt-10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center bg-[#19140f] text-sm font-semibold text-white sm:h-14 sm:w-14">
            MJ
          </div>
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              Maya&apos;s slate
            </h3>
            <p className="mt-1 text-xs text-black/45">
              126 watched · 34 up next
            </p>
          </div>
        </div>

        <div className="mt-9 flex items-end justify-between border-b border-black/15 pb-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/42">
              Recently loved
            </p>
            <p className="mt-1 landing-serif text-xl italic text-black/72">
              Five worth talking about
            </p>
          </div>
          <span className="text-[10px] text-black/40">View all 126</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
          {PROFILE_TITLES.map((item, index) => (
            <div
              key={item.title}
              className={`relative aspect-[2/3] overflow-hidden border border-black/12 bg-black/5 ${
                index > 2 ? "hidden sm:block" : ""
              }`}
            >
              <Image
                src={posterUrl(item.path, "w342")!}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 28vw, 120px"
                className="object-cover transition-transform duration-500 hover:scale-[1.025]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-black/15 bg-[#17120e] px-5 py-4 text-[#f3eadc] sm:px-8">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">
            Share link
          </p>
          <p className="mt-1 text-xs font-medium">slate.nishh.dev/maya</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-[#de7548]" />
      </div>
    </div>
  );
}
