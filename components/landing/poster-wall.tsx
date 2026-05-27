import Image from "next/image";
import { posterUrl } from "@/lib/tmdb-image";

// Minivoid-style hero backdrop: vertical poster columns that scroll past
// each other in alternating directions. The wall sits behind the headline
// and fades into the background at the top and bottom.
//
// Poster paths are sourced from TMDB's popular/top-rated endpoints and
// verified as 200 on image.tmdb.org. Each column carries 10 posters so
// the doubled-up loop always over-fills the column, even on mobile
// viewports where individual tiles are small.

type ColumnDef = {
  posters: string[];
  duration: number;
  direction: "up" | "down";
};

const COLUMNS: ColumnDef[] = [
  {
    duration: 330,
    direction: "up",
    posters: [
      "/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg", // The Shawshank Redemption
      "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", // The Godfather
      "/qJ2tW6WMUDux911r6m7haRef0WH.jpg", // The Dark Knight
      "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", // Parasite
      "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", // Interstellar
      "/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg", // Fight Club
      "/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg", // Spider-Man: Into the Spider-Verse
      "/nNAeTmF4CtdSgMDplXTDPOpYzsX.jpg", // The Empire Strikes Back
      "/pThyQovXQrw2m0s9x82twj48Jq4.jpg", // Knives Out
      "/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg",  // Forrest Gump
    ],
  },
  {
    duration: 380,
    direction: "down",
    posters: [
      "/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg", // Pulp Fiction
      "/q719jXXEzOoYaps6babgKnONONX.jpg", // Your Name.
      "/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg", // Schindler's List
      "/aabwWZWx6z1aYP4PX2ADvbDKktd.jpg", // Avatar: Fire and Ash
      "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", // Oppenheimer
      "/hjJkrLXhWvGHpLeLBDFznpBTY1S.jpg", // Grey's Anatomy
      "/zjg4jpK1Wp2kiRvtt5ND0kznako.jpg", // Better Call Saul
      "/9HcEqn3D4J6b2Z0jK54id9nA0fr.jpg", // Remarkably Bright Creatures
      "/13kOl2v0nD2OLbVSHnHk8GUFEhO.jpg", // Howl's Moving Castle
      "/3PFsEuAiyLkWsP4GG6dIV37Q6gu.jpg", // Family Guy
    ],
  },
  {
    duration: 280,
    direction: "up",
    posters: [
      "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", // Past Lives
      "/8VG8fDNiy50H4FedGwdSVUPoaJe.jpg", // The Green Mile
      "/9OkCLM73MIU2CrKZbqiT8Ln1wY2.jpg", // GoodFellas
      "/k9tv1rXZbOhH7eiCk378x61kNQ1.jpg", // Grave of the Fireflies
      "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg", // Spirited Away
      "/abf8tHznhSvl9BAElD2cQeRr7do.jpg", // Arcane
      "/9RQhVb3r3mCMqYVhLoCu4EvuipP.jpg", // Avatar: The Last Airbender
      "/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg", // Stranger Things
      "/dqZENchTd7lp5zht7BdlqM7RBhD.jpg", // Frieren: Beyond Journey's End
      "/i3xQJlQRff4k5IMEY55l4iKaKl3.jpg", // Reply 1988
    ],
  },
  {
    duration: 350,
    direction: "down",
    posters: [
      "/hjlZSXM86wJrfCv5VKfR5DI2VeU.jpg", // Hereditary
      "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg", // La La Land
      "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg", // LotR: The Return of the King
      "/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg", // LotR: The Fellowship of the Ring
      "/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg", // LotR: The Two Towers
      "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg", // Arrival
      "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg", // The Batman
      "/4lbclFySvugI51fwsyxBTOm4DqK.jpg", // The Wire
      "/tCZFfYTIwrR7n94J6G14Y4hAFU6.jpg", // Death Note
      "/4tblBrslcKSifMVZ3TmtT2ukMor.jpg", // INVINCIBLE
    ],
  },
  {
    duration: 310,
    direction: "up",
    posters: [
      "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg", // The Bear
      "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", // Severance
      "/in1R2dDc421JxsoRWaIIAqVI2KE.jpg", // The Boys
      "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg", // Breaking Bad
      "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", // Game of Thrones
      "/8iixmfGx5EIFPdpNvB2JvI3VIqX.jpg", // Supernatural
      "/dB4EDhre2dsC2kxYDavyKWqLQwi.jpg", // One Piece
      "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg", // Chernobyl
      "/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg", // The Sopranos
      "/i2EEr2uBvRlAwJ8d8zTG2Y19mIa.jpg", // Hunter x Hunter
    ],
  },
  {
    duration: 400,
    direction: "down",
    posters: [
      "/zhG3vKWyDRaZYoaww1UVAi29T9h.jpg", // 12 Angry Men
      "/hek3koDUyRQk7FIhPXsa6mT2Zc3.jpg", // The Godfather Part II
      "/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg", // The Good, the Bad and the Ugly
      "/lOMGc8bnSwQhS4XyE1S99uH8NXf.jpg", // Seven Samurai
      "/k7eYdWvhYQyRQoU2TB2A2Xu2TfD.jpg", // City of God
      "/gCI2AeMV4IHSewhJkzsur5MEp6R.jpg", // Cinema Paradiso
      "/yz4QVqPx3h1hD1DfqqQkCq3rmxW.jpg", // Psycho
      "/kjWsMh72V6d8KRLV4EOoSJLT1H7.jpg", // One Flew Over the Cuckoo's Nest
      "/dbqNBeLvAWFqpAvdBc0cecaqytT.jpg", // Attack on Titan
      "/5ZFUEOULaVml7pQuXxhpR2SmVUw.jpg", // Fullmetal Alchemist: Brotherhood
    ],
  },
  {
    duration: 300,
    direction: "up",
    posters: [
      "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg", // The Holdovers
      "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", // Dune: Part Two
      "/6tEJnof1DKWPnl5lzkjf0FVv7oB.jpg", // Life Is Beautiful
      "/fWVSwgjpT2D78VUh6X8UBd2rorW.jpg", // Demon Slayer: Infinity Castle
      "/yihdXomYb5kTeSivtFndMy5iDmf.jpg", // Project Hail Mary
      "/3nPwMd3KviJWaHzG9fZCqlwWMas.jpg", // Harakiri
      "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg", // Demon Slayer: KnY
      "/tuFaWiqX0TXoWu7DGNcmX3UW7sT.jpg", // A Silent Voice
      "/geCRueV3ElhRTr0xtJuEWJt6dJ1.jpg", // Solo Leveling
      "/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg", // JUJUTSU KAISEN
    ],
  },
  {
    duration: 360,
    direction: "down",
    posters: [
      "/8912AsVuS7Sj915apArUFbv6F9L.jpg", // The Devil Wears Prada
      "/ybrX94xQm8lXYpZAPRmwD9iIbWP.jpg", // Mortal Kombat
      "/lIsMeDbwntNXSUVHmWMMRXEZOVc.jpg", // Mortal Kombat II
      "/5Vi8dSauVwH1HOsiZceDMbRr1Ca.jpg", // The Mandalorian and Grogu
      "/eJGWx219ZcEMVQJhAgMiqo8tYY.jpg", // The Super Mario Galaxy Movie
      "/tFbfCkS7q6g96wVoAu8kyr93iPm.jpg", // Dilwale Dulhania Le Jayenge
      "/owhkU6KRqdXoUQpjV8uyZGPtX58.jpg", // Rick and Morty
      "/vOYfRZ0NpUK5hG2CB2dJFnYJlGe.jpg", // Yellowstone
      "/3Cz7ySOQJmqiuTdrc6CY0r65yDI.jpg", // House
      "/ifo31fMWLmyOVpdak9K0kY4jldQ.jpg", // Shameless
    ],
  },
  {
    duration: 340,
    direction: "up",
    posters: [
      "/uWpG7GqfKGQqX4YMAo3nv5OrglV.jpg", // The Simpsons
      "/aJrG7OkoTMPWG5c8opz8a93AZPY.jpg", // Euphoria
      "/acYXu4KaDj1NIkMgObnhe4C4a0T.jpg", // The Mentalist
      "/gigxjNnACiXAfrwoMox5WJFgc0I.jpg", // Criminal Minds
      "/rhzwpJBhi2WkfihXndS1xUdQlzB.jpg", // The Owl House
      "/6P6tXhjT5tK3qOXzxF9OMLlG7iz.jpg", // Anne with an E
      "/kvFSpESyBZMjaeOJDx7RS3P1jey.jpg", // The Pitt
      "/4HTfd1PhgFUenJxVuBDNdLmdr0c.jpg", // The Blacklist
      "/5maYKYzWpE68ycxGh1luu4P2LOS.jpg", // Planet Earth II
      "/j1NsoYYDYHnPkRr7Enqr8tlexgO.jpg", // Blue Planet II
    ],
  },
  {
    duration: 410,
    direction: "down",
    posters: [
      "/pRtJagIxpfODzzb0T0NAvZSzErC.jpg", // FROM
      "/e3ojpANrFnmJCyeBNTinYwyBCIN.jpg", // The Apothecary Diaries
      "/iofokHZoUB4Qhik4PflvJl8TT6a.jpg", // Law & Order: SVU
      "/70kTz0OmjjZe7zHvIDrq2iKW7PJ.jpg", // The Rookie
      "/mBcu8d6x6zB1el3MPNl7cZQEQ31.jpg", // NCIS
      "/nmmOKeydeeO4TKucpvyMA2o6gdD.jpg", // Slam Dunk
      "/fi1b6U1kp73xheECzqwzMn8u3mX.jpg", // Adventure Time: Fionna and Cake
      "/eyTu5c8LniVciRZIOSHTvvkkgJa.jpg", // Bones
      "/ttzrYMdsKWR8PTRLw7uo4noqaOJ.jpg", // S.W.A.T.
      "/i5hmoRjHNWady4AtAGICTUXknKH.jpg", // CSI
    ],
  },
];

export function PosterWall() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* Tilted, oversized container so the columns extend past the edges
          even after the rotation. Columns flex-fill the container so no
          dead space appears on either side once the wall is scaled up. */}
      <div className="absolute -inset-[12%] origin-center [transform:rotate(-7deg)_scale(1.25)]">
        <div className="flex h-full w-full gap-2 sm:gap-3">
          {COLUMNS.map((col, i) => (
            <PosterColumn key={i} {...col} />
          ))}
        </div>
      </div>

      {/* Top + bottom fade so columns dissolve into the hero surface.
          Uses the dedicated --hero-bg token so the fade matches the
          band's tinted background in both light and dark modes. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[hsl(var(--hero-bg))] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[hsl(var(--hero-bg))] to-transparent" />

      {/* Center vignette to push focus toward the headline. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--hero-bg)/0.55)_0%,hsl(var(--hero-bg)/0.85)_55%,hsl(var(--hero-bg))_100%)]" />
    </div>
  );
}

function PosterColumn({ posters, duration, direction }: ColumnDef) {
  const animationName = direction === "up" ? "col-scroll-up" : "col-scroll-down";
  // Render the same list twice so the -50% translate at the loop boundary
  // lands on an identical frame. The unique list is long enough that the
  // doubled content always over-fills the column on every breakpoint.
  const loop = [...posters, ...posters];
  return (
    <div className="relative h-full min-w-0 flex-1 overflow-hidden">
      <div
        className="flex flex-col gap-3 sm:gap-4 will-change-transform [animation-timing-function:linear] [animation-iteration-count:infinite]"
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
      className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted ring-1 ring-foreground/5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
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
