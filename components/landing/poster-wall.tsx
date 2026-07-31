import Image from "next/image";
import { posterUrl } from "@/lib/tmdb-image";

const HERO_POSTERS = [
  {
    index: "01",
    title: "Past Lives",
    note: "Recently loved",
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
  },
  {
    index: "02",
    title: "Severance",
    note: "Watching · S02",
    path: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
  },
  {
    index: "03",
    title: "Dune: Part Two",
    note: "Up next",
    path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  },
];

export function PosterWall() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute inset-0 bg-[#0c0a08]" />
      <div className="landing-projector absolute -right-[12%] top-[-20%] h-[115%] w-[82%] opacity-90" />

      <div className="absolute -right-[24%] top-[10%] h-[62svh] w-[92%] rotate-[1.5deg] opacity-42 sm:-right-[8%] sm:top-[14%] sm:h-[68svh] sm:w-[69%] sm:opacity-72 lg:-right-[3%] lg:w-[58%]">
        <div className="grid h-full grid-cols-[1.18fr_0.82fr] grid-rows-2 gap-2 sm:gap-3">
          {HERO_POSTERS.map((poster, index) => (
            <figure
              key={poster.title}
              className={`relative overflow-hidden border border-white/15 bg-[#18130f] ${
                index === 0 ? "row-span-2" : ""
              }`}
            >
              <Image
                src={posterUrl(poster.path, "w780")!}
                alt=""
                fill
                priority
                sizes="(max-width: 640px) 70vw, 42vw"
                className="object-cover saturate-[0.78] contrast-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/15" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-white sm:text-base">
                    {poster.title}
                  </p>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-white/48 sm:text-[9px]">
                    {poster.note}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-white/38">
                  {poster.index}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="landing-grain absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0c0a08_0%,rgba(12,10,8,0.97)_32%,rgba(12,10,8,0.72)_58%,rgba(12,10,8,0.22)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#0c0a08_0%,transparent_28%,transparent_72%,rgba(12,10,8,0.66)_100%)]" />
      <div className="absolute inset-0 bg-[#0c0a08]/18 sm:hidden" />
    </div>
  );
}
