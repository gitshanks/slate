import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { ImportExperience } from "@/components/import-experience";

export const metadata: Metadata = {
  title: "slate · Import",
};

const SOURCES = [
  {
    service: "Letterboxd",
    href: "https://letterboxd.com/settings/data/",
    steps: "Settings, Data, Export your data. Unzip it and use watched.csv.",
  },
  {
    service: "IMDb",
    href: "https://www.imdb.com/list/ratings",
    steps: "Your ratings, the ⋯ menu, Export. Use the CSV it sends.",
  },
  {
    service: "Trakt",
    href: "https://trakt.tv/users/settings",
    steps: "Settings, Exports. Request a CSV of your watched history.",
  },
] as const;

export default function ImportPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="sr-only">Import your watch history</h1>
      <ImportExperience />

      <ul className="mt-10 grid gap-x-10 gap-y-6 sm:mt-12 sm:grid-cols-3">
        {SOURCES.map(({ service, href, steps }) => (
          <li key={service}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex items-center gap-1 text-sm font-medium text-foreground outline-none focus-visible:underline"
            >
              Export from {service}
              <ArrowUpRight
                aria-hidden
                className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ease-[var(--ease-ui-out)] group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-foreground motion-reduce:transition-none"
              />
            </a>
            <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
              {steps}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
