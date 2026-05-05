import {
  Command,
  Sparkles,
  Star,
  ListChecks,
  FileUp,
  Lock,
} from "lucide-react";

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: Command,
    eyebrow: "Command palette",
    title: "Add anything in one keystroke.",
    body:
      "Press ⌘K, search the entire TMDB catalog, hit enter. Films, shows, episodes, all in your library before the keystroke fades.",
  },
  {
    icon: Sparkles,
    eyebrow: "AI search",
    title: "Type the vibe, not the title.",
    body:
      "“Cozy autumn mysteries.” “A24 horror after 2020.” “Nolan thrillers.” Powered by Llama 3.3, Claude, or whatever endpoint you point it at.",
  },
  {
    icon: Star,
    eyebrow: "Critic scores",
    title: "IMDb and Rotten Tomatoes, baked in.",
    body:
      "Every saved title carries an IMDb rating and a Tomatometer (with a Metacritic fallback). Fetched once, cached, surfaced everywhere.",
  },
  {
    icon: ListChecks,
    eyebrow: "Three states",
    title: "Want · Watching · Watched.",
    body:
      "Three clean shelves with Love / Like / Dislike ratings and a private notes field. No followers, no public timeline, no thumbs you don't want.",
  },
  {
    icon: FileUp,
    eyebrow: "One-step import",
    title: "Bring your Letterboxd or Trakt history.",
    body:
      "Drop in a CSV. Slate matches every row against TMDB, dedupes against your library, and drops it into the right state with ratings preserved.",
  },
  {
    icon: Lock,
    eyebrow: "Yours, by default",
    title: "No accounts. No tracking. No telemetry.",
    body:
      "Run it on your laptop in Docker, or on Vercel + Supabase. The only outbound calls are to TMDB. Lock the door with a passcode if you want.",
  },
];

export function FeatureGrid() {
  return (
    <section className="relative border-t border-border/60 bg-background">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Why slate
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything Letterboxd does well, without the social part.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Slate is a single-user app. It optimizes for one thing: helping you
            decide what to watch tonight, and remembering what you thought of it
            tomorrow.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCell key={f.title} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCell({ feature }: { feature: Feature }) {
  const { icon: Icon } = feature;
  return (
    <div className="group relative bg-card p-7 transition-colors hover:bg-accent/30 sm:p-8">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
        {feature.eyebrow}
      </p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight">
        {feature.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {feature.body}
      </p>
    </div>
  );
}
