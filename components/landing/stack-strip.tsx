import { TextReveal } from "@/components/landing/text-reveal";

const FEATURES = [
  "Films and series",
  "Up next",
  "Watching",
  "Watched",
  "Ratings and notes",
  "Custom lists",
  "Public profiles",
  "CSV imports",
];

export function StackStrip() {
  return (
    <section
      aria-label="What you can do with slate"
      className="relative overflow-hidden border-y border-black/15 bg-[#e8dfd1] text-[#18130f]"
    >
      <div className="landing-paper-grain pointer-events-none absolute inset-0 opacity-36" />
      <div className="relative mx-auto max-w-[1440px] px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/42">
          The whole thing, at a glance
        </p>

        <TextReveal
          text="A place for every title, from maybe tonight to watched three times."
          className="mt-6 max-w-[1180px] text-balance text-[clamp(3rem,6.7vw,7rem)] font-medium leading-[0.9] tracking-[-0.065em]"
        />

        <div className="mt-20 grid grid-cols-2 border-l border-t border-black/18 sm:mt-28 sm:grid-cols-4 lg:grid-cols-8">
          {FEATURES.map((feature, index) => (
            <div
              key={feature}
              className="min-h-28 border-b border-r border-black/18 p-4 sm:min-h-36 sm:p-5"
            >
              <span className="font-mono text-[8px] tracking-[0.14em] text-black/32">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-8 max-w-[9rem] text-sm font-medium leading-snug sm:mt-12">
                {feature}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
