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
    <section className="relative isolate overflow-hidden border-t border-border/60 bg-background">
      {/* Accent shimmer on the seam + an ambient glow, echoing the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[340px] w-[760px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-mono backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Why slate
          </span>

          <h2 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
            Everything Letterboxd does well,{" "}
            <span className="text-primary">without the social part.</span>
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground sm:text-lg">
            Slate is a single-user app. It optimizes for one thing: helping you
            decide what to watch tonight, and remembering what you thought of it
            tomorrow.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCell key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Each feature reads like a film production slate — the object the app is
 * named after. A hinged clapper stick (the diagonal stripes) sits on top,
 * the board below carries stencilled SLATE/TAKE fields, and on hover the
 * clapper snaps shut. Cinema-coherent with the poster-wall hero and a long
 * way from the stock icon-chip feature card.
 */
function FeatureCell({ feature, index }: { feature: Feature; index: number }) {
  const { icon: Icon } = feature;
  const slate = String(index + 1).padStart(2, "0");

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card/40 transition-all duration-300 hover:-translate-y-1 hover:bg-card hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.75)]">
      {/* Clapper stick: hinged at the left, snaps shut on hover. */}
      <div className="relative h-9 border-b border-border bg-background/40">
        <div
          aria-hidden
          className="absolute inset-0 origin-left -rotate-[7deg] transition-transform duration-300 ease-out group-hover:rotate-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-56deg, hsl(var(--foreground) / 0.85) 0 12px, transparent 12px 24px)",
            opacity: 0.5,
          }}
        />
        <div className="relative flex h-full items-center justify-between px-4">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75">
            Slate {slate}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
            Take 1
          </span>
        </div>
      </div>

      {/* The board. */}
      <div className="p-6 sm:p-7">
        <div className="flex items-center gap-2.5 text-primary">
          <Icon className="h-4 w-4" />
          <p className="text-[10px] uppercase tracking-[0.2em] font-mono">
            {feature.eyebrow}
          </p>
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          {feature.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {feature.body}
        </p>
      </div>
    </div>
  );
}
