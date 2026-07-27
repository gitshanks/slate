import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="bg-[#080809] text-white">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 text-xs text-white/36 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8 lg:px-12">
        <div>
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={62}
            height={17}
            className="h-[17px] w-auto opacity-80"
          />
          <p className="mt-4 max-w-sm leading-relaxed">
            A calmer place for everything worth watching.
            <br />
            Hosted for convenience. Open source by conviction.
          </p>
        </div>

        <div className="sm:text-right">
          <div className="flex gap-5 sm:justify-end">
            <a
              href="https://github.com/gitshanks/slate"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://www.nishh.dev/slate"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              Case study
            </a>
          </div>
          <p className="mt-4 max-w-lg leading-relaxed">
            TMDB artwork is used under its API terms. Slate is not endorsed or
            certified by TMDB.
          </p>
        </div>
      </div>
    </footer>
  );
}
