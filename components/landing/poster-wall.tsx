import Image from "next/image";
import { posterUrl } from "@/lib/tmdb-image";

type PosterArtifact = {
  path: string;
  title: string;
  note?: string;
  className: string;
  motion: string;
  priority?: boolean;
};

const POSTERS: PosterArtifact[] = [
  {
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    title: "Past Lives",
    note: "Loved",
    className:
      "-left-[11%] top-[20%] w-[38vw] sm:-left-[3%] sm:top-[19%] sm:w-[22vw] lg:left-[1%] lg:w-[15vw]",
    motion: "landing-drift-a",
    priority: true,
  },
  {
    path: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    title: "Severance",
    note: "Watching · S02",
    className:
      "right-[-12%] top-[15%] w-[37vw] sm:right-[2%] sm:top-[13%] sm:w-[20vw] lg:right-[4%] lg:w-[14vw]",
    motion: "landing-drift-b",
    priority: true,
  },
  {
    path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    title: "Dune: Part Two",
    className:
      "left-[13%] -top-[13%] hidden w-[14vw] sm:block lg:left-[18%] lg:w-[11vw]",
    motion: "landing-drift-c",
  },
  {
    path: "/pThyQovXQrw2m0s9x82twj48Jq4.jpg",
    title: "Knives Out",
    note: "Up next",
    className:
      "right-[16%] -top-[15%] hidden w-[15vw] sm:block lg:right-[20%] lg:w-[11vw]",
    motion: "landing-drift-a",
  },
  {
    path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    title: "Parasite",
    className:
      "-bottom-[17%] left-[-9%] w-[39vw] sm:-bottom-[25%] sm:left-[7%] sm:w-[21vw] lg:left-[10%] lg:w-[15vw]",
    motion: "landing-drift-c",
  },
  {
    path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
    title: "The Holdovers",
    note: "Liked",
    className:
      "-bottom-[19%] right-[-8%] w-[38vw] sm:-bottom-[23%] sm:right-[7%] sm:w-[22vw] lg:right-[10%] lg:w-[15vw]",
    motion: "landing-drift-b",
  },
  {
    path: "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    title: "La La Land",
    className:
      "bottom-[5%] left-[29%] hidden w-[11vw] sm:block lg:left-[31%] lg:w-[8.5vw]",
    motion: "landing-drift-b",
  },
  {
    path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    title: "Oppenheimer",
    className:
      "bottom-[2%] right-[28%] hidden w-[12vw] sm:block lg:right-[31%] lg:w-[8.5vw]",
    motion: "landing-drift-a",
  },
  {
    path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    title: "Spirited Away",
    className:
      "left-[4%] top-[-9%] hidden w-[9vw] lg:block",
    motion: "landing-drift-c",
  },
  {
    path: "/8VG8fDNiy50H4FedGwdSVUPoaJe.jpg",
    title: "The Green Mile",
    className:
      "right-[2%] top-[57%] hidden w-[9vw] lg:block",
    motion: "landing-drift-c",
  },
];

export function PosterWall() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#060607] select-none"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(124,88,255,0.2),transparent_23%),radial-gradient(circle_at_12%_18%,rgba(255,122,83,0.12),transparent_24%),radial-gradient(circle_at_88%_75%,rgba(78,117,255,0.12),transparent_26%)]" />

      {POSTERS.map((poster) => (
        <Poster key={poster.title} {...poster} />
      ))}

      <div className="landing-grain absolute inset-0 opacity-25" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,6,7,0.3)_0%,rgba(6,6,7,0.76)_44%,rgba(6,6,7,0.94)_82%,#060607_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#060607] via-[#060607]/65 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#060607] via-[#060607]/80 to-transparent" />

      <div className="absolute left-[8%] top-[57%] hidden items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-white/55 backdrop-blur-xl lg:flex landing-drift-b">
        <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
        126 films saved
      </div>
      <div className="absolute right-[9%] top-[42%] hidden rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white backdrop-blur-xl lg:block landing-drift-a">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
          Tonight&apos;s mood
        </p>
        <p className="mt-1 text-xs font-medium">Quiet, strange, beautiful</p>
      </div>
    </div>
  );
}

function Poster({
  path,
  title,
  note,
  className,
  motion,
  priority,
}: PosterArtifact) {
  const src = posterUrl(path, "w500");

  return (
    <figure className={`absolute ${className} ${motion}`}>
      <div className="group relative aspect-[2/3] overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.04] shadow-[0_30px_90px_rgba(0,0,0,0.62)] sm:rounded-[22px]">
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 40vw, (max-width: 1024px) 22vw, 15vw"
            className="object-cover saturate-[0.88]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/5" />
        <figcaption className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
          <p className="truncate text-[11px] font-semibold text-white sm:text-sm">
            {title}
          </p>
          {note ? (
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/55 sm:text-[10px]">
              {note}
            </p>
          ) : null}
        </figcaption>
      </div>
    </figure>
  );
}
