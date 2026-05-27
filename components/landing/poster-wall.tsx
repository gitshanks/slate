import Image from "next/image";
import { posterUrl } from "@/lib/tmdb-image";

// Minivoid-style hero backdrop: vertical poster columns that scroll past
// each other in alternating directions. The wall sits behind the headline
// and fades into the background at the top and bottom.
//
// Poster paths are sourced from TMDB's popular/top-rated endpoints and
// verified as 200 on image.tmdb.org. Re-verify when refreshing the set —
// TMDB occasionally swaps the canonical path for a film.

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
      "/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg", // The Shawshank Redemption
      "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", // The Godfather
      "/qJ2tW6WMUDux911r6m7haRef0WH.jpg", // The Dark Knight
      "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", // Parasite
      "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", // Interstellar
      "/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg", // Fight Club
    ],
  },
  {
    duration: 110,
    direction: "down",
    posters: [
      "/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg", // Pulp Fiction
      "/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg",  // Forrest Gump
      "/q719jXXEzOoYaps6babgKnONONX.jpg", // Your Name.
      "/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg", // Schindler's List
      "/aabwWZWx6z1aYP4PX2ADvbDKktd.jpg", // Avatar: Fire and Ash
      "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", // Oppenheimer
    ],
  },
  {
    duration: 80,
    direction: "up",
    posters: [
      "/pThyQovXQrw2m0s9x82twj48Jq4.jpg", // Knives Out
      "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", // Past Lives
      "/8VG8fDNiy50H4FedGwdSVUPoaJe.jpg", // The Green Mile
      "/9OkCLM73MIU2CrKZbqiT8Ln1wY2.jpg", // GoodFellas
      "/k9tv1rXZbOhH7eiCk378x61kNQ1.jpg", // Grave of the Fireflies
      "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg", // Spirited Away
    ],
  },
  {
    duration: 100,
    direction: "down",
    posters: [
      "/hjlZSXM86wJrfCv5VKfR5DI2VeU.jpg", // Hereditary
      "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg", // La La Land
      "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg", // LotR: The Return of the King
      "/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg", // LotR: The Fellowship of the Ring
      "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg", // Arrival
      "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg", // The Batman
    ],
  },
  {
    duration: 95,
    direction: "up",
    posters: [
      "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg", // The Bear
      "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", // Severance
      "/in1R2dDc421JxsoRWaIIAqVI2KE.jpg", // The Boys
      "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg", // Breaking Bad
      "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", // Game of Thrones
      "/8iixmfGx5EIFPdpNvB2JvI3VIqX.jpg", // Supernatural
    ],
  },
  {
    duration: 115,
    direction: "down",
    posters: [
      "/zhG3vKWyDRaZYoaww1UVAi29T9h.jpg", // 12 Angry Men
      "/hek3koDUyRQk7FIhPXsa6mT2Zc3.jpg", // The Godfather Part II
      "/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg", // The Good, the Bad and the Ugly
      "/lOMGc8bnSwQhS4XyE1S99uH8NXf.jpg", // Seven Samurai
      "/k7eYdWvhYQyRQoU2TB2A2Xu2TfD.jpg", // City of God
      "/gCI2AeMV4IHSewhJkzsur5MEp6R.jpg", // Cinema Paradiso
    ],
  },
  {
    duration: 85,
    direction: "up",
    posters: [
      "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg", // The Holdovers
      "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", // Dune: Part Two
      "/6tEJnof1DKWPnl5lzkjf0FVv7oB.jpg", // Life Is Beautiful
      "/fWVSwgjpT2D78VUh6X8UBd2rorW.jpg", // Demon Slayer: Infinity Castle
      "/yihdXomYb5kTeSivtFndMy5iDmf.jpg", // Project Hail Mary
      "/3nPwMd3KviJWaHzG9fZCqlwWMas.jpg", // Harakiri
    ],
  },
  {
    duration: 105,
    direction: "down",
    posters: [
      "/8912AsVuS7Sj915apArUFbv6F9L.jpg", // The Devil Wears Prada
      "/ybrX94xQm8lXYpZAPRmwD9iIbWP.jpg", // Mortal Kombat
      "/lIsMeDbwntNXSUVHmWMMRXEZOVc.jpg", // Mortal Kombat II
      "/5Vi8dSauVwH1HOsiZceDMbRr1Ca.jpg", // The Mandalorian and Grogu
      "/eJGWx219ZcEMVQJhAgMiqo8tYY.jpg", // The Super Mario Galaxy Movie
      "/tFbfCkS7q6g96wVoAu8kyr93iPm.jpg", // Dilwale Dulhania Le Jayenge
    ],
  },
  {
    duration: 92,
    direction: "up",
    posters: [
      "/uWpG7GqfKGQqX4YMAo3nv5OrglV.jpg", // The Simpsons
      "/3PFsEuAiyLkWsP4GG6dIV37Q6gu.jpg", // Family Guy
      "/aJrG7OkoTMPWG5c8opz8a93AZPY.jpg", // Euphoria
      "/hjJkrLXhWvGHpLeLBDFznpBTY1S.jpg", // Grey's Anatomy
      "/acYXu4KaDj1NIkMgObnhe4C4a0T.jpg", // The Mentalist
      "/gigxjNnACiXAfrwoMox5WJFgc0I.jpg", // Criminal Minds
    ],
  },
  {
    duration: 108,
    direction: "down",
    posters: [
      "/pRtJagIxpfODzzb0T0NAvZSzErC.jpg", // FROM
      "/e3ojpANrFnmJCyeBNTinYwyBCIN.jpg", // The Apothecary Diaries
      "/iofokHZoUB4Qhik4PflvJl8TT6a.jpg", // Law & Order: SVU
      "/70kTz0OmjjZe7zHvIDrq2iKW7PJ.jpg", // The Rookie
      "/9HcEqn3D4J6b2Z0jK54id9nA0fr.jpg", // Remarkably Bright Creatures
      "/mBcu8d6x6zB1el3MPNl7cZQEQ31.jpg", // NCIS
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
    <div className="relative h-full w-[26vw] shrink-0 sm:w-[18vw] md:w-[14vw] lg:w-[11vw] xl:w-[9vw]">
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
          sizes="(max-width: 640px) 26vw, (max-width: 1024px) 14vw, 9vw"
          className="object-cover"
        />
      ) : null}
    </div>
  );
}
