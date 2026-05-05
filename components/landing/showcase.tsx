import { Sparkles, Search, BookmarkPlus, Eye, Heart, ThumbsUp } from "lucide-react";

export function Showcase() {
  return (
    <section className="relative border-t border-border/60 bg-gradient-to-b from-background to-accent/30 dark:to-card/40">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        {/* AI search row */}
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              Plain-English search
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Stop typing titles. Start typing moods.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">
              Flip the “Ask AI” pill in the command palette and type the way you
              actually think. Slate turns vibes into a real shortlist — drawn
              from TMDB, scored on critic data, and de-duplicated against what
              you've already seen.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {AI_BULLETS.map((b) => (
                <li key={b.label} className="flex gap-3">
                  <span className="mt-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <strong className="text-foreground">{b.label}.</strong> {b.body}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">
              Defaults to Groq's free tier (Llama 3.3 70B). Bring your own
              OpenAI-compatible endpoint, or set <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px] ring-1 ring-border">AI_PROVIDER=anthropic</code> for Claude.
            </p>
          </div>

          <AiPaletteMock />
        </div>

        {/* Three states row */}
        <div className="mt-24 grid items-center gap-12 lg:mt-32 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          <ThreeStatesMock />

          <div className="lg:order-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              Three shelves, no friction
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Want, watching, watched. That's the whole app.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">
              Move titles between shelves with a click. Add a private note. Mark
              it Loved, Liked, or Disliked. There's nothing public to maintain
              and nothing to follow — slate is the opposite of a feed.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
              {STATE_CHIPS.map((c) => (
                <div
                  key={c.label}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                    <c.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium text-foreground">{c.label}</span>
                  <span className="text-muted-foreground">{c.body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const AI_BULLETS = [
  {
    label: "Live suggestions",
    body: "Real titles surface as you type — no waiting for a full response.",
  },
  {
    label: "Library-aware",
    body: "Already saved? Slate skips it. Recommendations stay fresh.",
  },
  {
    label: "Bring your own model",
    body: "Llama, Claude, GPT, or self-hosted via Ollama. One env var.",
  },
];

const STATE_CHIPS = [
  {
    icon: BookmarkPlus,
    label: "Want",
    body: "Saved for later. Sortable by genre, year, rating.",
  },
  {
    icon: Eye,
    label: "Watching",
    body: "In progress — episodic shows, slow-burn series.",
  },
  {
    icon: Heart,
    label: "Watched",
    body: "Loved, Liked, or Disliked. With a private note.",
  },
];

function AiPaletteMock() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-primary/10 ring-1 ring-foreground/5">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground">A24 horror after 2020</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Ask AI
          </span>
        </div>
        <ul className="divide-y divide-border/60">
          {AI_RESULTS.map((r, i) => (
            <li
              key={r.title}
              className={
                "flex items-center gap-3 px-4 py-3 " +
                (i === 0 ? "bg-foreground/[0.03]" : "")
              }
            >
              <span
                className="h-10 w-7 shrink-0 rounded-sm ring-1 ring-foreground/10"
                style={{ backgroundImage: r.gradient }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.meta}
                </p>
              </div>
              <span className="hidden shrink-0 rounded-md bg-foreground/[0.04] px-2 py-1 font-mono text-[10px] text-muted-foreground sm:inline">
                {r.score}
              </span>
              {i === 0 ? (
                <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                  ↵
                </kbd>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border/60 bg-background/50 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Search className="h-3 w-3" /> {AI_RESULTS.length} suggestions
          </span>
          <span className="font-mono">Llama 3.3 · 240ms</span>
        </div>
      </div>
      <div
        aria-hidden
        className="absolute -bottom-6 left-10 right-10 -z-10 h-24 rounded-full bg-primary/30 blur-3xl"
      />
    </div>
  );
}

const AI_RESULTS = [
  {
    title: "Pearl (2022)",
    meta: "Slasher · Ti West",
    gradient:
      "linear-gradient(160deg, hsl(0 70% 35%) 0%, hsl(20 80% 30%) 70%, hsl(40 80% 25%) 100%)",
    score: "RT 91%",
  },
  {
    title: "Talk to Me (2023)",
    meta: "Supernatural · Philippou",
    gradient:
      "linear-gradient(160deg, hsl(280 60% 25%) 0%, hsl(320 60% 30%) 70%, hsl(0 0% 8%) 100%)",
    score: "RT 94%",
  },
  {
    title: "Men (2022)",
    meta: "Folk horror · Garland",
    gradient:
      "linear-gradient(160deg, hsl(120 30% 30%) 0%, hsl(80 35% 22%) 70%, hsl(40 30% 15%) 100%)",
    score: "RT 68%",
  },
  {
    title: "X (2022)",
    meta: "Slasher · Ti West",
    gradient:
      "linear-gradient(160deg, hsl(40 90% 40%) 0%, hsl(20 75% 30%) 70%, hsl(0 0% 8%) 100%)",
    score: "RT 94%",
  },
  {
    title: "I Saw the TV Glow (2024)",
    meta: "Surreal · Schoenbrun",
    gradient:
      "linear-gradient(160deg, hsl(280 80% 50%) 0%, hsl(320 70% 35%) 70%, hsl(220 50% 12%) 100%)",
    score: "RT 95%",
  },
];

function ThreeStatesMock() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {STATE_COLUMNS.map((col) => (
        <div
          key={col.label}
          className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4"
        >
          <div className="mb-3 flex items-center gap-1.5">
            <col.icon className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground font-mono">
              {col.label}
            </span>
          </div>
          <div className="space-y-2">
            {col.items.map((it) => (
              <div
                key={it.title}
                className="overflow-hidden rounded-md ring-1 ring-foreground/5"
              >
                <div
                  className="aspect-[2/3] w-full"
                  style={{ backgroundImage: it.gradient }}
                />
                <div className="px-2 py-1.5">
                  <p className="line-clamp-1 text-[11px] font-medium text-foreground">
                    {it.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{it.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const STATE_COLUMNS = [
  {
    label: "Want",
    icon: BookmarkPlus,
    items: [
      {
        title: "Anora",
        meta: "2024",
        gradient:
          "linear-gradient(160deg, hsl(330 70% 35%) 0%, hsl(280 60% 25%) 100%)",
      },
      {
        title: "Conclave",
        meta: "2024",
        gradient:
          "linear-gradient(160deg, hsl(0 60% 25%) 0%, hsl(40 60% 28%) 100%)",
      },
    ],
  },
  {
    label: "Watching",
    icon: Eye,
    items: [
      {
        title: "Severance",
        meta: "S2 · E5",
        gradient:
          "linear-gradient(160deg, hsl(220 50% 18%) 0%, hsl(195 60% 30%) 100%)",
      },
      {
        title: "Slow Horses",
        meta: "S4 · E1",
        gradient:
          "linear-gradient(160deg, hsl(40 30% 22%) 0%, hsl(20 50% 18%) 100%)",
      },
    ],
  },
  {
    label: "Watched",
    icon: ThumbsUp,
    items: [
      {
        title: "The Holdovers",
        meta: "Loved",
        gradient:
          "linear-gradient(160deg, hsl(0 0% 12%) 0%, hsl(45 30% 22%) 100%)",
      },
      {
        title: "Past Lives",
        meta: "Liked",
        gradient:
          "linear-gradient(160deg, hsl(330 70% 35%) 0%, hsl(220 50% 18%) 100%)",
      },
    ],
  },
];
