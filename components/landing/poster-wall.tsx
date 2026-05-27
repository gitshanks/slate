import Image from "next/image";
import { posterUrl } from "@/lib/tmdb-image";

// Minivoid-style hero backdrop: vertical poster columns that scroll past
// each other in alternating directions. The wall sits behind the headline
// and fades into the background at the top and bottom.

type ColumnDef = {
  posters: string[];
  duration: number;
  direction: "up" | "down";
};

const COLUMNS: ColumnDef[] = [
  {
    duration: 90,
    direction: "up",
    posters: [
      "/pThyQovXQrw2m0s9x82twj48Jq4.jpg", // Knives Out
      "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg", // The Bear
      "/hjlZSXM86wJrfCv5VKfR5DI2VeU.jpg", // Hereditary
      "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg", // La La Land
      "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", // Severance
    ],
  },
  {
    duration: 110,
    direction: "down",
    posters: [
      "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg", // Arrival
      "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg", // The Holdovers
      "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", // Past Lives
      "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", // Oppenheimer
      "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", // Dune: Part Two
    ],
  },
  {
    duration: 80,
    direction: "up",
    posters: [
      "/jUkbsCxQS77Yi4Gy8RZHfQYUTPP.jpg", // The Godfather
      "/2pjBjMRiebFqK0ZBlW7P53zNDp7.jpg", // Pulp Fiction
      "/zjnZaNI8jWPiJG2KH8XLZAuthED.jpg", // Anatomy of a Fall
      "/9Z4DH7HbDxg34mAEJjANI53OAad.jpg", // Killers of the Flower Moon
      "/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg", // Inception
    ],
  },
  {
    duration: 100,
    direction: "down",
    posters: [
      "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg", // The Batman
      "/yF1eOkaYvwiORauRCPWznV9xVvi.jpg", // The Dark Knight
      "/74xTEgt7R36Fpooo50r9T25onhq.jpg", // Bullet Train
      "/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg", // Spider-Man: No Way Home
      "/mDfJG3LB3l9OcTGYJp3rqkkAuDC.jpg", // The Whale
    ],
  },
  {
    duration: 95,
    direction: "up",
    posters: [
      "/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", // Avengers: Endgame
      "/iJQIbOPm81fNZsAdvE0gFcfHIeY.jpg", // Saltburn
      "/bcM2Tl5HlsvPBnL8DKP9Ie6vU4r.jpg", // Marriage Story
      "/MoEKaPFHABtA1xKoOteirGaHl1.jpg",  // Parasite
      "/2cYjr7AVeS6KuLgmkmwWMzc15c8.jpg", // Whiplash (fallback)
    ],
  },
  {
    duration: 115,
    direction: "down",
    posters: [
      "/A7EByudX0eOzlkQ2FIbogzyazm2.jpg", // Forrest Gump
      "/9w7MMNuUDmJqVreqWQlt0KbqCfp.jpg", // Drive (2011)
      "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg", // Avengers: Infinity War
      "/8s4h9friP6Ci3adRGahHARVd76E.jpg", // Top Gun: Maverick
      "/q719jXXEzOoYaps6babgKnONONX.jpg", // Heat
    ],
  },
  {
    duration: 85,
    direction: "up",
    posters: [
      "/uHmpDgI8aIVfZc9KdmK7MTQYNGY.jpg", // Lost in Translation
      "/9Pb3hI8wt6CIVKkB8YEhMlpqdRR.jpg", // The Shining
      "/d4XfPxOKWO2VHipsxn1cnzbnYME.jpg", // Mad Max: Fury Road
      "/aDYSnJAK0BTVeE8osOy22Kz3SXY.jpg", // Past Lives alt
      "/4tlNFhEowwgN9Vc9pCxc741S6oR.jpg", // Mickey 17
    ],
  },
  {
    duration: 105,
    direction: "down",
    posters: [
      "/sw7mordbZxgITU877yTpZCud90M.jpg",  // Oppenheimer alt
      "/qhb1qOilapbapxWQn9jtRCMwXJF.jpg", // Civil War
      "/dC0E0vEvKAm91ZQpKDmaaRoq2vw.jpg", // The Boy and the Heron
      "/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg", // No Country for Old Men
      "/9JtdsRijZi9HRJ1jITZhuU3Y9PV.jpg", // Wicked
    ],
  },
];

export function PosterWall() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* Tilted, oversized container so the columns extend past the edges
          even after the rotation. */}
      <div className="absolute -inset-[12%] origin-center [transform:rotate(-7deg)_scale(1.25)]">
        <div className="flex h-full w-full justify-center gap-2 sm:gap-3">
          {COLUMNS.map((col, i) => (
            <PosterColumn key={i} {...col} />
          ))}
        </div>
      </div>

      {/* Top + bottom fade so columns dissolve into the background. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#08080a] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#08080a] to-transparent" />

      {/* Center vignette to push focus toward the headline. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,8,10,0.55)_0%,rgba(8,8,10,0.85)_55%,#08080a_100%)]" />
    </div>
  );
}

function PosterColumn({ posters, duration, direction }: ColumnDef) {
  const animationName = direction === "up" ? "col-scroll-up" : "col-scroll-down";
  // Render the same list twice so the -50% translate at the loop boundary
  // lands on an identical frame.
  const loop = [...posters, ...posters];
  return (
    <div className="relative h-full w-[22vw] shrink-0 sm:w-[18vw] md:w-[15vw] lg:w-[12vw] xl:w-[10vw]">
      <div
        className="absolute inset-0 flex flex-col gap-3 sm:gap-4 will-change-transform [animation-timing-function:linear] [animation-iteration-count:infinite]"
        style={{ animationName, animationDuration: `${duration}s` }}
      >
        {loop.map((path, idx) => (
          <PosterTile key={`${path}-${idx}`} path={path} idx={idx} />
        ))}
      </div>
    </div>
  );
}

function PosterTile({ path, idx }: { path: string; idx: number }) {
  const src = posterUrl(path, "w342");
  // Tiny varying rotations so cards feel hand-arranged rather than gridded.
  const tilt = idx % 3 === 0 ? "-0.4deg" : idx % 3 === 1 ? "0.3deg" : "0deg";
  return (
    <div
      className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-white/5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
      style={{ transform: `rotate(${tilt})` }}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 640px) 22vw, (max-width: 1024px) 15vw, 10vw"
          className="object-cover"
        />
      ) : null}
    </div>
  );
}
