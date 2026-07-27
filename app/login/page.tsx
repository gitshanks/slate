import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  EyeOff,
  Globe2,
  LockKeyhole,
} from "lucide-react";
import { signIn } from "@/auth";
import { GoogleSignInButton } from "@/components/login/google-sign-in-button";
import { posterUrl } from "@/lib/tmdb-image";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const metadata: Metadata = {
  title: "Welcome back — slate",
  description:
    "Sign in with Google to pick up your Slate watchlist on any device.",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

const LOGIN_POSTERS = [
  {
    title: "Past Lives",
    path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    className: "col-span-4 row-span-5",
  },
  {
    title: "Severance",
    path: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    className: "col-span-4 row-span-6 -translate-y-16",
  },
  {
    title: "Dune: Part Two",
    path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    className: "col-span-4 row-span-5 translate-y-8",
  },
  {
    title: "Knives Out",
    path: "/pThyQovXQrw2m0s9x82twj48Jq4.jpg",
    className: "col-span-4 row-span-6 -translate-y-5",
  },
  {
    title: "The Holdovers",
    path: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
    className: "col-span-4 row-span-5 -translate-y-20",
  },
  {
    title: "Spirited Away",
    path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    className: "col-span-4 row-span-6 translate-y-2",
  },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!SLATE_HOSTED) redirect("/");

  const query = await searchParams;
  const rawError = Array.isArray(query.error) ? query.error[0] : query.error;
  const error = rawError ? loginErrorMessage(rawError) : null;

  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/app" });
  }

  return (
    <main className="dark relative min-h-dvh overflow-hidden bg-[#070708] text-white lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1.12fr)_minmax(440px,0.88fr)]">
      <CinemaPanel />
      <MobileCinemaBackdrop />

      <section className="relative z-10 flex min-h-dvh flex-col border-white/[0.08] bg-[#09090b]/72 backdrop-blur-xl lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:border-l lg:bg-[#09090b] lg:backdrop-blur-none">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-5">
          <Link
            href="/"
            aria-label="Slate home"
            className="inline-flex items-center rounded-full py-2 transition-opacity hover:opacity-72"
          >
            <Image
              src="/brand/logo-light.svg"
              alt="Slate"
              width={73}
              height={20}
              priority
              className="h-5 w-[73px]"
            />
          </Link>

          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-2 text-xs font-medium text-white/52 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back home
          </Link>
        </header>

        <div className="flex flex-1 items-center px-5 pb-14 pt-8 sm:px-8 sm:pb-20 lg:px-12 lg:py-4 xl:px-16">
          <div className="mx-auto w-full max-w-[470px]">
            <div className="landing-hero-enter">
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-white/38">
                Your Slate account
              </p>
              <h1 className="mt-5 max-w-md text-balance text-[clamp(2.8rem,5.4vw,5rem)] font-semibold leading-[0.93] tracking-[-0.06em]">
                Your slate
                <br />
                <span className="text-[#a78bfa]">is waiting.</span>
              </h1>
              <p className="mt-5 max-w-md text-pretty text-[15px] leading-7 text-white/48 sm:text-base">
                Sign in once to keep every film, show, note, and carefully
                arranged shelf with you wherever you watch.
              </p>
            </div>

            {error ? <LoginError title={error.title} body={error.body} /> : null}

            <form
              action={continueWithGoogle}
              className="landing-hero-enter landing-hero-enter-delay-2 mt-7"
            >
              <GoogleSignInButton />
            </form>

            <div className="landing-hero-enter landing-hero-enter-delay-3 mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              <TrustRow
                icon={EyeOff}
                title="Nothing public by accident"
                body="Your library starts private. Publishing is always your choice."
              />
              <TrustRow
                icon={Globe2}
                title="One account, every screen"
                body="Your order, ratings, and notes stay in sync."
              />
            </div>

            <p
              id="google-sign-in-note"
              className="landing-hero-enter landing-hero-enter-delay-3 mt-4 text-xs leading-5 text-white/32"
            >
              Slate uses Google only to identify your account. We never post on
              your behalf or access your Google data.
            </p>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/[0.07] px-5 py-4 text-[11px] text-white/32 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span>Open source · MIT licensed</span>
          <a
            href="https://github.com/gitshanks/slate"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 transition-colors hover:text-white/70"
          >
            Prefer your own server?
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </footer>
      </section>
    </main>
  );
}

function CinemaPanel() {
  return (
    <aside
      aria-label="A glimpse of a Slate film library"
      className="relative hidden min-h-dvh overflow-hidden bg-[#070708] lg:block lg:h-dvh lg:min-h-0"
    >
      <PosterMosaic />
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_34%,transparent_8%,rgba(7,7,8,0.16)_43%,rgba(7,7,8,0.68)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070708] via-[#070708]/25 to-[#070708]/40" />

      <div className="absolute inset-x-0 bottom-0 z-10 p-10 xl:p-14">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.23em] text-white/38">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
          On your slate
        </div>
        <h2 className="mt-5 max-w-[680px] text-balance text-[clamp(3.5rem,5.5vw,6.8rem)] font-semibold leading-[0.89] tracking-[-0.065em]">
          You saved it
          <br />
          <span className="text-white/38">for a reason.</span>
        </h2>
        <div className="mt-6 flex items-center gap-3">
          <span className="rounded-full border border-white/12 bg-black/35 px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 backdrop-blur-xl">
            34 up next
          </span>
          <span className="rounded-full border border-white/12 bg-black/35 px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 backdrop-blur-xl">
            6 watching
          </span>
        </div>
      </div>
    </aside>
  );
}

function MobileCinemaBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[52vh] overflow-hidden opacity-70 lg:hidden"
    >
      <div className="absolute -inset-x-24 -top-32 h-[520px] rotate-[-7deg] scale-110">
        <PosterMosaic />
      </div>
      <div className="landing-grain absolute inset-0 opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070708]/20 via-[#070708]/45 to-[#09090b]" />
    </div>
  );
}

function PosterMosaic() {
  return (
    <div className="absolute -inset-10 grid auto-rows-[16vh] grid-cols-12 gap-3 rotate-[-4deg] scale-110 p-8 xl:gap-4">
      {LOGIN_POSTERS.map((poster, index) => (
        <div
          key={poster.title}
          className={`relative overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_rgba(0,0,0,0.55)] ${poster.className} ${
            index % 3 === 0
              ? "landing-drift-a"
              : index % 3 === 1
                ? "landing-drift-b"
                : "landing-drift-c"
          }`}
        >
          <Image
            src={posterUrl(poster.path, "w500")!}
            alt=""
            fill
            priority={index < 3}
            sizes="(max-width: 1024px) 42vw, 19vw"
            className="object-cover saturate-[0.88]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

function TrustRow({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof LockKeyhole;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[2.25rem_1fr] gap-3 py-3.5">
      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.045] text-[#bba6ff] ring-1 ring-white/[0.08]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-white/82">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-white/36">{body}</p>
      </div>
    </div>
  );
}

function LoginError({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
      className="landing-hero-enter landing-hero-enter-delay mt-7 border-l-2 border-[#a78bfa] bg-[#a78bfa]/[0.07] px-4 py-3.5"
    >
      <p className="text-sm font-medium text-white/88">{title}</p>
      <p className="mt-1 text-xs leading-5 text-white/45">{body}</p>
    </div>
  );
}

function loginErrorMessage(error: string) {
  if (error === "AccessDenied") {
    return {
      title: "Google couldn’t finish the sign-in.",
      body: "Try again with the Google account you want to use for Slate. If it keeps happening, return home and retry in a moment.",
    };
  }

  if (error === "Configuration") {
    return {
      title: "Sign-in is temporarily unavailable.",
      body: "Slate’s Google connection needs attention. Please try again shortly.",
    };
  }

  return {
    title: "We couldn’t sign you in.",
    body: "Nothing was changed. Try Google again, or return home and come back in a moment.",
  };
}
