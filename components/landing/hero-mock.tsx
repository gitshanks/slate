import Image from "next/image";
import { Search, Sparkles, Heart, ThumbsUp, Eye, BookmarkPlus } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";

// A self-contained, fake-but-faithful slate window. Posters resolve straight
// from TMDB's CDN (image.tmdb.org) — no API key required at runtime, since
// the paths are baked in below.
export function HeroMock() {
  return (
    <div className="relative">
      {/* Browser chrome */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10 ring-1 ring-foreground/5">
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-background/40 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2.5 py-0.5 text-[11px] text-muted-foreground">
            slate.app/
          </span>
        </div>

        {/* Window contents */}
        <div className="relative px-5 pt-5 pb-7 sm:px-7 sm:pt-7">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Your watchlist
              </p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight">Up next</h3>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">128 titles</p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {POSTERS.map((p, i) => (
              <MockPoster key={i} {...p} />
            ))}
          </div>

          {/* Floating ⌘K palette */}
          <div className="pointer-events-none absolute inset-x-5 bottom-6 sm:inset-x-12 sm:bottom-10">
            <div className="rounded-xl border border-border bg-popover/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="flex items-center gap-2 rounded-lg bg-foreground/[0.03] px-3 py-2.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">cozy autumn mysteries</span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Ask AI
                </span>
                <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘⇧K
                </kbd>
              </div>
              <ul className="mt-1 space-y-px px-1 py-1 text-sm">
                {SUGGESTIONS.map((s) => (
                  <li
                    key={s}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground first:bg-foreground/[0.03] first:text-foreground"
                  >
                    <Search className="h-3.5 w-3.5 opacity-60" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Soft glow under the window */}
      <div
        aria-hidden
        className="absolute inset-x-12 -bottom-10 -z-10 h-32 rounded-full bg-primary/30 blur-3xl"
      />
    </div>
  );
}

const STATUS = {
  want: { Icon: BookmarkPlus, label: "Want" },
  watching: { Icon: Eye, label: "Watching" },
  loved: { Icon: Heart, label: "Loved" },
  liked: { Icon: ThumbsUp, label: "Liked" },
} as const;

type StatusKey = keyof typeof STATUS;

interface MockPosterProps {
  posterPath: string;
  title: string;
  meta: string;
  status?: StatusKey;
}

function MockPoster({ posterPath, title, meta, status }: MockPosterProps) {
  const badge = status ? STATUS[status] : null;
  const src = posterUrl(posterPath, "w342");
  return (
    <div className="group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-card ring-1 ring-foreground/5">
        {src ? (
          <Image
            src={src}
            alt={title}
            fill
            sizes="(max-width: 640px) 33vw, 120px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {badge ? (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[9px] font-medium text-foreground/90 ring-1 ring-foreground/10">
            <badge.Icon className="h-2.5 w-2.5" />
            {badge.label}
          </span>
        ) : null}
        <div className="absolute inset-x-1.5 bottom-1.5">
          <p className="line-clamp-1 text-[10px] font-medium text-white drop-shadow">
            {title}
          </p>
          <p className="text-[9px] text-white/70">{meta}</p>
        </div>
      </div>
    </div>
  );
}

// Real TMDB poster paths — resolved at design-time so the page stays free of
// runtime API calls. If TMDB swaps a canonical poster the asset 404s and the
// card falls back to the empty card background until we re-pick.
const POSTERS: MockPosterProps[] = [
  {
    posterPath: "/pThyQovXQrw2m0s9x82twj48Jq4.jpg",
    title: "Knives Out",
    meta: "2019 · Mystery",
    status: "want",
  },
  {
    posterPath: "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
    title: "The Bear",
    meta: "FX · Drama",
    status: "watching",
  },
  {
    posterPath: "/hjlZSXM86wJrfCv5VKfR5DI2VeU.jpg",
    title: "Hereditary",
    meta: "2018 · Horror",
    status: "loved",
  },
  {
    posterPath: "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    title: "La La Land",
    meta: "2016 · Musical",
  },
  {
    posterPath: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    title: "Severance",
    meta: "Apple TV+ · SciFi",
    status: "watching",
  },
  {
    posterPath: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg",
    title: "Arrival",
    meta: "2016 · SciFi",
    status: "liked",
  },
  {
    posterPath: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
    title: "The Holdovers",
    meta: "2023 · Drama",
    status: "want",
  },
  {
    posterPath: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    title: "Past Lives",
    meta: "2023 · Romance",
    status: "loved",
  },
  {
    posterPath: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    title: "Oppenheimer",
    meta: "2023 · Biography",
  },
  {
    posterPath: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    title: "Dune: Part Two",
    meta: "2024 · SciFi",
    status: "want",
  },
];

const SUGGESTIONS = [
  "The Wicker Man (1973)",
  "Knives Out · Glass Onion",
  "Only Murders in the Building",
  "See How They Run (2022)",
];
