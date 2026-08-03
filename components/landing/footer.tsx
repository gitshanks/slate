import Image from "next/image";
import Link from "next/link";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function LandingFooter() {
  const hosted = SLATE_HOSTED;

  return (
    <footer className="border-t border-white/10 bg-[#0c0a08] text-[#f3eadc]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 text-xs text-white/36 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8 lg:px-12">
        <div>
          <Image
            src="/brand/logo-light.svg"
            alt="slate"
            width={62}
            height={17}
            className="opacity-80"
          />
          <p className="mt-4 max-w-sm leading-relaxed">
            Keep films and shows in order. Share your profile when you feel
            like it.
          </p>
        </div>

        <div className="sm:text-right">
          <div className="flex gap-5 sm:justify-end">
            <Link
              href={hosted ? "/login" : "/app"}
              className="transition-colors hover:text-white"
            >
              {hosted ? "Join slate" : "Open slate"}
            </Link>
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
            Want to run your own copy? slate is{" "}
            <a
              href="https://github.com/gitshanks/slate"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
            >
              open source on GitHub
            </a>
            . TMDB artwork is used under its API terms.
          </p>
        </div>
      </div>
    </footer>
  );
}
