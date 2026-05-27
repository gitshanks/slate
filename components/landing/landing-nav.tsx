import Image from "next/image";
import Link from "next/link";
import { GithubMark } from "@/components/landing/icons";
import { AccentPicker } from "@/components/accent-picker";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-border/40">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 sm:h-16 sm:px-8">
        <Link href="/" className="flex items-center pt-1 pb-2" aria-label="Slate home">
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={62}
            height={17}
            priority
            className="hidden h-[17px] w-auto dark:block"
          />
          <Image
            src="/brand/logo-dark.svg"
            alt="Slate"
            width={62}
            height={17}
            priority
            className="h-[17px] w-auto dark:hidden"
          />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <AccentPicker />
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubMark className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            href="/app"
            className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Open slate
          </Link>
        </nav>
      </div>
    </header>
  );
}
