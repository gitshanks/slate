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
      aria-label="What you can do with Slate"
      className="overflow-hidden border-y border-white/[0.07] bg-[#080809] py-5 text-white"
    >
      <div className="landing-marquee flex w-max items-center gap-8 whitespace-nowrap sm:gap-12">
        {[...FEATURES, ...FEATURES].map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="flex items-center gap-8 sm:gap-12"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/34">
              {item}
            </span>
            <span className="h-1 w-1 rounded-full bg-[#a78bfa]/70" />
          </div>
        ))}
      </div>
    </section>
  );
}
