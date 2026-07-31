import Image from "next/image";
import Link from "next/link";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function LandingNav() {
  const hosted = SLATE_HOSTED;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:h-24 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="relative z-10 flex items-center rounded-full border border-white/10 bg-black/70 px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:px-4"
          aria-label="Slate home"
        >
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={72}
            height={20}
            priority
            className="h-[18px] w-auto sm:h-5"
          />
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-black/55 p-1.5 text-sm text-white/65 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:gap-2">
          <a
            href="#inside"
            className="hidden rounded-full px-3 py-2 transition-colors hover:text-white md:inline-flex"
          >
            Features
          </a>
          <a
            href="#share"
            className="hidden rounded-full px-3 py-2 transition-colors hover:text-white md:inline-flex"
          >
            Profiles
          </a>
          <a
            href="#account"
            className="hidden rounded-full px-3 py-2 transition-colors hover:text-white md:inline-flex"
          >
            Your library
          </a>
          {hosted ? (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-full px-2.5 font-medium text-white/70 transition-colors hover:text-white sm:px-3"
            >
              Sign in
            </Link>
          ) : null}
          <Link
            href={hosted ? "/login" : "/app"}
            className="inline-flex h-9 items-center rounded-full bg-white px-4 font-medium text-black transition-transform hover:scale-[1.02] active:scale-[0.98] sm:px-5"
          >
            {hosted ? "Join Slate" : "Open Slate"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
