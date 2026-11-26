import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The wordmark and "Make your own". On a profile it floats over the backdrop
 * (`overlay`); elsewhere it is a bar of its own.
 */
export function PublicProfileHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      {...(overlay ? {} : { "data-public-profile-header": "" })}
      className={cn(
        "z-20",
        overlay
          ? "absolute inset-x-0 top-0 pt-[env(safe-area-inset-top)]"
          : "relative border-b border-border/60 bg-background/70 backdrop-blur-xl",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-14 items-center justify-between sm:h-16",
          overlay ? "max-w-6xl px-4 sm:px-6" : "max-w-[1600px] px-4 sm:px-6 lg:px-10",
        )}
      >
        <Link href="/" aria-label="slate home" className="flex items-center">
          <Image
            src="/brand/wordmark-light.svg"
            alt="slate"
            width={47}
            height={17}
            priority
            className="hidden dark:block"
          />
          <Image
            src="/brand/wordmark-dark.svg"
            alt="slate"
            width={47}
            height={17}
            priority
            className="dark:hidden"
          />
        </Link>
        <Link
          href="/login"
          className={cn(
            "inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 sm:text-sm",
            overlay
              ? "border-foreground/15 bg-background/45 backdrop-blur-xl hover:bg-background/70"
              : "border-border bg-card hover:bg-accent",
          )}
        >
          Make your own
        </Link>
      </div>
    </header>
  );
}
