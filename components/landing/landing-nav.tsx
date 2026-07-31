import Image from "next/image";
import Link from "next/link";
import { SLATE_HOSTED } from "@/lib/public-mode";

export function LandingNav() {
  const hosted = SLATE_HOSTED;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0c0a08]/72 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="relative z-10 flex items-center py-2"
          aria-label="Slate home"
        >
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={72}
            height={20}
            priority
          />
        </Link>

        <nav className="flex items-center gap-1 text-[13px] text-white/58 sm:gap-3">
          <a
            href="#inside"
            className="hidden px-2 py-2 transition-colors hover:text-white md:inline-flex"
          >
            Features
          </a>
          <a
            href="#share"
            className="hidden px-2 py-2 transition-colors hover:text-white md:inline-flex"
          >
            Profiles
          </a>
          <a
            href="#account"
            className="hidden px-2 py-2 transition-colors hover:text-white md:inline-flex"
          >
            Your library
          </a>
          {hosted ? (
            <Link
              href="/login"
              className="inline-flex h-9 items-center px-2.5 font-medium text-white/68 transition-colors hover:text-white sm:px-3"
            >
              Sign in
            </Link>
          ) : null}
          <Link
            href={hosted ? "/login" : "/app"}
            className="inline-flex h-9 items-center rounded-[3px] bg-[#de7548] px-4 font-semibold text-[#160d08] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#eb8557] active:translate-y-0 sm:px-5"
          >
            {hosted ? "Join Slate" : "Open Slate"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
