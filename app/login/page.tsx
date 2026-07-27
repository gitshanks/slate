import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { signIn } from "@/auth";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const metadata: Metadata = {
  title: "Sign in — slate",
  description: "Sign in with Google to create your Slate watchlist.",
  robots: { index: false, follow: false },
};

function safeNext(value: string | undefined) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/app";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!SLATE_HOSTED) redirect("/");
  const params = await searchParams;
  const next = safeNext(params.next);

  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: next });
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,hsl(var(--primary)/0.16),transparent_38%)]"
      />

      <section className="relative w-full max-w-md">
        <Link href="/" className="mx-auto flex w-fit items-center pb-10" aria-label="Slate home">
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={86}
            height={24}
            priority
            className="hidden h-6 w-auto dark:block"
          />
          <Image
            src="/brand/logo-dark.svg"
            alt="Slate"
            width={86}
            height={24}
            priority
            className="h-6 w-auto dark:hidden"
          />
        </Link>

        <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-6 shadow-[0_32px_100px_-40px_hsl(var(--primary)/0.3)] backdrop-blur-xl sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <LockKeyhole className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            Your shelf, wherever you are.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in to build your watchlist, keep it in sync, and share it with
            friends whenever you choose.
          </p>

          {params.error && (
            <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Google sign-in didn&apos;t finish. Please try again.
            </p>
          )}

          <form action={continueWithGoogle} className="mt-7">
            <button
              type="submit"
              className="group flex h-12 w-full items-center justify-center gap-3 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:-translate-y-px active:translate-y-0"
            >
              <GoogleMark />
              Continue with Google
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
            Your library is private by default. You decide if it gets a public link.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prefer to run your own copy?{" "}
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Slate remains self-hostable.
          </a>
        </p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6.01 6.01 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}
