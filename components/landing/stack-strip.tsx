// A muted strip naming what slate is built with. Calms the page after the
// dense feature/showcase rows and earns trust before the final CTA.
const STACK = [
  "Next.js 16",
  "React 19",
  "Tailwind CSS v4",
  "shadcn/ui",
  "Postgres",
  "PostgREST",
  "TMDB",
  "OMDB",
];

export function StackStrip() {
  return (
    <section className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8">
        <p className="text-center text-[11px] uppercase tracking-[0.24em] text-muted-foreground font-mono">
          Built on
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground sm:gap-x-12">
          {STACK.map((s) => (
            <li
              key={s}
              className="font-medium tracking-tight transition-colors hover:text-foreground"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
