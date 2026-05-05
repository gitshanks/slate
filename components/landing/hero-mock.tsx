import { Search, Sparkles, Heart, ThumbsUp, Eye, BookmarkPlus } from "lucide-react";

// A self-contained, fake-but-faithful slate window. Nothing here makes a
// network call: posters are rendered as gradient placeholders so this works
// in any deploy without TMDB credentials.
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
  gradient: string;
  title: string;
  meta: string;
  status?: StatusKey;
}

function MockPoster({ gradient, title, meta, status }: MockPosterProps) {
  const badge = status ? STATUS[status] : null;
  return (
    <div className="group">
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-md ring-1 ring-foreground/5"
        style={{ backgroundImage: gradient }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
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

// Hand-tuned gradients standing in for posters — keeps the hero offline-safe.
const POSTERS: MockPosterProps[] = [
  {
    gradient:
      "linear-gradient(135deg, hsl(252 88% 62%) 0%, hsl(282 75% 30%) 60%, hsl(220 50% 12%) 100%)",
    title: "Knives Out",
    meta: "2019 · Mystery",
    status: "want",
  },
  {
    gradient:
      "linear-gradient(140deg, hsl(220 50% 18%) 0%, hsl(195 60% 30%) 50%, hsl(160 50% 22%) 100%)",
    title: "The Bear",
    meta: "FX · Drama",
    status: "watching",
  },
  {
    gradient:
      "linear-gradient(160deg, hsl(20 75% 35%) 0%, hsl(0 70% 22%) 60%, hsl(280 30% 18%) 100%)",
    title: "Hereditary",
    meta: "2018 · Horror",
    status: "loved",
  },
  {
    gradient:
      "linear-gradient(135deg, hsl(45 90% 55%) 0%, hsl(20 75% 40%) 55%, hsl(340 60% 30%) 100%)",
    title: "La La Land",
    meta: "2016 · Musical",
  },
  {
    gradient:
      "linear-gradient(160deg, hsl(160 60% 30%) 0%, hsl(195 70% 22%) 60%, hsl(240 40% 12%) 100%)",
    title: "Severance",
    meta: "Apple TV+ · SciFi",
    status: "watching",
  },
  {
    gradient:
      "linear-gradient(140deg, hsl(282 60% 35%) 0%, hsl(220 70% 18%) 60%, hsl(180 40% 18%) 100%)",
    title: "Arrival",
    meta: "2016 · SciFi",
    status: "liked",
  },
  {
    gradient:
      "linear-gradient(160deg, hsl(0 0% 12%) 0%, hsl(45 30% 20%) 60%, hsl(40 60% 35%) 100%)",
    title: "The Holdovers",
    meta: "2023 · Drama",
    status: "want",
  },
  {
    gradient:
      "linear-gradient(135deg, hsl(330 70% 40%) 0%, hsl(280 60% 25%) 60%, hsl(220 50% 15%) 100%)",
    title: "Past Lives",
    meta: "2023 · Romance",
    status: "loved",
  },
  {
    gradient:
      "linear-gradient(160deg, hsl(195 60% 25%) 0%, hsl(220 50% 18%) 50%, hsl(0 0% 8%) 100%)",
    title: "Oppenheimer",
    meta: "2023 · Biography",
  },
  {
    gradient:
      "linear-gradient(135deg, hsl(20 80% 50%) 0%, hsl(340 65% 30%) 60%, hsl(240 50% 15%) 100%)",
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
