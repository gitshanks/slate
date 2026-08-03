import Image from "next/image";
import { cn } from "@/lib/utils";
import { posterUrl } from "@/lib/tmdb-image";
import styles from "./poster-constellation.module.css";

const POSTERS = [
  ["Past Lives", "2023", "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg"],
  ["Severance", "2022", "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg"],
  ["Dune: Part Two", "2024", "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg"],
  ["Knives Out", "2019", "/pThyQovXQrw2m0s9x82twj48Jq4.jpg"],
  ["The Holdovers", "2023", "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg"],
  ["Spirited Away", "2001", "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg"],
  ["Perfect Days", "2023", "/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg"],
  ["Aftersun", "2022", "/jeXmhP2zbUkREMRqFOYIwQOk49T.jpg"],
  ["Parasite", "2019", "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg"],
  ["Memories of Murder", "2003", "/jcgUjx1QcupGzjntTVlnQ15lHqy.jpg"],
  ["The Bear", "2022", "/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg"],
  ["Arrival", "2016", "/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg"],
] as const;

const POSITIONS = [
  styles.posterOne,
  styles.posterTwo,
  styles.posterThree,
  styles.posterFour,
  styles.posterFive,
  styles.posterSix,
  styles.posterSeven,
  styles.posterEight,
  styles.posterNine,
  styles.posterTen,
  styles.posterEleven,
  styles.posterTwelve,
];

export function PosterConstellation({
  quiet = false,
  className,
}: {
  quiet?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(styles.constellation, quiet && styles.quiet, className)}
    >
      <div className={styles.stars} />
      {POSTERS.map(([title, year, path], index) => (
        <figure
          className={cn(styles.poster, POSITIONS[index])}
          key={title}
        >
          <div className={styles.artwork}>
            <Image
              src={posterUrl(path, "w500")!}
              alt=""
              fill
              sizes="(max-width: 640px) 22vw, 8vw"
              loading={index < 8 ? "eager" : "lazy"}
              className={styles.image}
            />
          </div>
          <figcaption>
            <strong>{title}</strong>
            <span>{year}</span>
          </figcaption>
        </figure>
      ))}
      <div className={styles.centerVoid} />
      <div className={styles.edgeFade} />
    </div>
  );
}
