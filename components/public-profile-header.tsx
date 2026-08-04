import Image from "next/image";
import Link from "next/link";

export function PublicProfileHeader() {
  return (
    <header className="relative z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-10">
        <Link href="/" aria-label="slate home" className="flex items-center">
          <Image
            src="/brand/logo-light.svg"
            alt="slate"
            width={62}
            height={17}
            priority
            className="hidden dark:block"
          />
          <Image
            src="/brand/logo-dark.svg"
            alt="slate"
            width={62}
            height={17}
            priority
            className="dark:hidden"
          />
        </Link>
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3.5 text-xs font-medium transition-colors hover:bg-accent sm:px-4 sm:text-sm"
        >
          Make your own
        </Link>
      </div>
    </header>
  );
}
