import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { getLandingPosterColumns } from "@/lib/landing-posters";
import { posterUrl } from "@/lib/tmdb-image";
import styles from "./poster-carousel.module.css";

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
  const columns = await getLandingPosterColumns();

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
