interface Feature {
  eyebrow: string;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    eyebrow: "Command palette",
    title: "Add anything in one keystroke.",
    body:
      "Press ⌘K, search the entire TMDB catalog, hit enter. Films, shows, episodes, all in your library before the keystroke fades.",
  },
  {
    eyebrow: "AI search",
    title: "Type the vibe, not the title.",
    body:
      "“Cozy autumn mysteries.” “A24 horror after 2020.” “Nolan thrillers.” Powered by Llama 3.3, Claude, or whatever endpoint you point it at.",
  },
  {
    eyebrow: "Critic scores",
    title: "IMDb and Rotten Tomatoes, baked in.",
    body:
      "Every saved title carries an IMDb rating and a Tomatometer (with a Metacritic fallback). Fetched once, cached, surfaced everywhere.",
  },
  {
    eyebrow: "Three states",
    title: "Want · Watching · Watched.",
    body:
      "Three clean shelves with Love / Like / Dislike ratings and a private notes field. No followers, no public timeline, no thumbs you don't want.",
  },
  {
    eyebrow: "One-step import",
    title: "Bring your Letterboxd or Trakt history.",
    body:
      "Drop in a CSV. Slate matches every row against TMDB, dedupes against your library, and drops it into the right state with ratings preserved.",
  },
  {
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
        <div className="max-w-2xl md:mx-auto md:text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-mono backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Why slate
          </span>

          <h2 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
            Everything Letterboxd does well,{" "}
            <span className="text-primary">without the social part.</span>
          </h2>

          <p className="mt-5 max-w-xl text-pretty text-muted-foreground sm:text-lg md:mx-auto">
            Slate is a single-user app. It optimizes for one thing: helping you
            decide what to watch tonight, and remembering what you thought of it
            tomorrow.
          </p>
        </div>

        {/* Editorial index: hairline-ruled rows, ghosted numerals, an accent
            tick that tracks the cursor like a selected row in the app itself. */}
        <ol className="mt-16 sm:mt-20">
          {FEATURES.map((f, i) => (
            <li key={f.title}>
              <FeatureRow feature={f} index={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  return (
    <article className="group relative grid grid-cols-1 gap-x-10 gap-y-3 border-t border-border py-8 transition-colors duration-200 last:border-b hover:bg-card/40 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.35fr)] md:items-start md:py-9 md:pl-6 md:pr-4">
      {/* Selection tick — grows from the row's vertical center on hover, the
          same cue the app uses when you arrow through a list. */}
      <span
        aria-hidden
        className="absolute left-0 top-1/2 hidden h-0 w-[2px] -translate-y-1/2 bg-primary transition-all duration-300 ease-out group-hover:h-[60%] md:block"
      />

      <span className="font-mono text-3xl font-light leading-none tabular-nums text-foreground/20 transition-colors duration-200 group-hover:text-primary sm:text-[2.5rem] md:self-center">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="md:pt-1.5">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-mono">
          {feature.eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:text-2xl">
          {feature.title}
        </h3>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80 md:pt-2">
        {feature.body}
      </p>
    </article>
  );
}
