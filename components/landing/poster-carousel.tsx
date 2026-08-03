import { unstable_cache } from "next/cache";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { getTrending } from "@/lib/tmdb";
import { posterUrl } from "@/lib/tmdb-image";
import styles from "./poster-carousel.module.css";

const COLUMN_COUNT = 8;
// Each repeated sequence must be taller than the transformed wall. Five
// posters left a real gap at the end of the loop on tall mobile viewports,
// which flashed to the carousel background before the animation restarted.
const POSTERS_PER_COLUMN = 8;
const WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

const FALLBACK_COLUMNS = [
  [
    "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    "/lqoMzCcZYEFK729d6qzt349fB4o.jpg",
    "/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg",
    "/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg",
  ],
  [
    "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    "/c15BtJxCXMrISLVmysdsnZUPQft.jpg",
    "/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg",
    "/zYqVTiHK5ZajYcNzAW7qWte5NWS.jpg",
    "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  ],
  [
    "/vYEyxF1UT779RiEalpMjUT6kfdf.jpg",
    "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    "/gbSaK9v1CbcYH1ISgbM7XObD2dW.jpg",
    "/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg",
    "/dnpatlJrEPiDSn5fzgzvxtiSnMo.jpg",
  ],
  [
    "/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg",
    "/abf8tHznhSvl9BAElD2cQeRr7do.jpg",
    "/zjg4jpK1Wp2kiRvtt5ND0kznako.jpg",
    "/khZqmwHQicTYoS7Flreb9EddFZC.jpg",
    "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
  ],
  [
    "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    "/25ih0Xq2zWbxhhKxwhvswKYQyEr.jpg",
    "/u68AjlvlutfEIcpmbYpKcdi09ut.jpg",
    "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
    "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
  ],
  [
    "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    "/27vEYsRKa3eAniwmoccOoluEXQ1.jpg",
    "/hjlZSXM86wJrfCv5VKfR5DI2VeU.jpg",
    "/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
    "/zU0htwkhNvBQdVSIKB9s6hgVeFK.jpg",
  ],
  [
    "/qLnfEmPrDjJfPyyddLJPkXmshkp.jpg",
    "/7v8iCNzKFpdlrCMcqCoJyn74Nsa.jpg",
    "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg",
    "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
  ],
  [
    "/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg",
    "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    "/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg",
    "/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg",
    "/AoGsDM02UVt0npBA8OvpDcZbaMi.jpg",
  ],
] as const;

const getWeeklyTrendingPosterPaths = unstable_cache(
  async () => {
    const trending = await getTrending();
    const seen = new Set<string>();
    const posters: string[] = [];

    for (const title of trending) {
      const path = title.poster_path;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      posters.push(path);
    }

    if (posters.length < COLUMN_COUNT) {
      throw new Error("TMDB returned too few weekly trending posters.");
    }

    return posters.slice(0, COLUMN_COUNT * POSTERS_PER_COLUMN);
  },
  ["slate-weekly-trending-poster-wall-v1", "tmdb-trending-all-week"],
  {
    revalidate: WEEK_IN_SECONDS,
    tags: ["slate-weekly-trending-poster-wall"],
  },
);

const COLUMN_STYLES = [
  styles.columnOne,
  styles.columnTwo,
  styles.columnThree,
  styles.columnFour,
  styles.columnFive,
  styles.columnSix,
  styles.columnSeven,
  styles.columnEight,
];

export async function PosterCarousel({
  quiet = false,
  className,
}: {
  quiet?: boolean;
  className?: string;
}) {
  const columns = await getPosterColumns();

  return (
    <div
      aria-hidden="true"
      data-marketing-poster-wall=""
      className={cn(styles.carousel, quiet && styles.quiet, className)}
    >
      <div className={styles.wall}>
        <div className={styles.columns}>
          {columns.map((posters, columnIndex) => (
            <PosterColumn
              key={columnIndex}
              posters={posters}
              className={COLUMN_STYLES[columnIndex]}
            />
          ))}
        </div>
      </div>
      <div className={styles.centerScrim} />
      <div className={styles.edgeFade} />
    </div>
  );
}

async function getPosterColumns(): Promise<readonly (readonly string[])[]> {
  try {
    const trending = await getWeeklyTrendingPosterPaths();
    const posterCount = COLUMN_COUNT * POSTERS_PER_COLUMN;
    const wall = Array.from(
      { length: posterCount },
      (_, index) => trending[index % trending.length],
    );

    return Array.from({ length: COLUMN_COUNT }, (_, columnIndex) =>
      Array.from(
        { length: POSTERS_PER_COLUMN },
        (_, rowIndex) => wall[rowIndex * COLUMN_COUNT + columnIndex],
      ),
    );
  } catch {
    return FALLBACK_COLUMNS.map((posters) =>
      Array.from(
        { length: POSTERS_PER_COLUMN },
        (_, index) => posters[index % posters.length],
      ),
    );
  }
}

function PosterColumn({
  posters,
  className,
}: {
  posters: readonly string[];
  className: string;
}) {
  return (
    <div className={cn(styles.column, className)}>
      <div className={styles.track}>
        {[0, 1].map((copyIndex) => (
          <div className={styles.sequence} key={copyIndex}>
            {posters.map((path, posterIndex) => (
              <PosterTile
                key={`${path}-${copyIndex}-${posterIndex}`}
                path={path}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PosterTile({ path }: { path: string }) {
  const posterStyle = {
    "--poster-image": `url("${posterUrl(path, "w500")}")`,
  } as CSSProperties;

  return <div className={styles.poster} style={posterStyle} />;
}
