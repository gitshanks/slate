import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { signIn } from "@/auth";
import { PosterCarousel } from "@/components/landing/poster-carousel";
import { GoogleSignInButton } from "@/components/login/google-sign-in-button";
import { getAppSession } from "@/lib/app-access";
import { SLATE_HOSTED } from "@/lib/public-mode";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in or join · slate",
  description: "Use your Google account to create or open your Slate.",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    mode?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!SLATE_HOSTED) redirect("/");

  const session = await getAppSession();

  if (session?.user?.id) {
    redirect("/app");
  }

  const query = await searchParams;
  const rawError = Array.isArray(query.error) ? query.error[0] : query.error;
  const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const creating = rawMode === "create";
  const error = rawError ? loginErrorMessage(rawError) : null;

  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/app" });
  }

  return (
    <main className={styles.page}>
      <PosterCarousel quiet className={styles.background} />
      <div className={styles.grain} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to Slate">
          <ArrowLeft aria-hidden="true" />
        </Link>
        <Link href="/" className={styles.logo} aria-label="Slate home">
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={78}
            height={22}
            preload
          />
        </Link>
      </header>

      <section className={styles.auth} aria-labelledby="auth-title">
        <div className={styles.authInner}>
          <p className={styles.eyebrow}>{creating ? "New account" : "Welcome back"}</p>
          <h1 id="auth-title">
            {creating ? "Create your slate" : "Sign in to Slate"}
          </h1>

          {error ? <LoginError title={error.title} body={error.body} /> : null}

          <form action={continueWithGoogle} className={styles.form}>
            <GoogleSignInButton
              label={creating ? "Sign up with Google" : "Sign in with Google"}
            />
          </form>

          <p className={styles.switchMode}>
            {creating ? "Already have a Slate?" : "New to Slate?"}{" "}
            <Link href={creating ? "/login" : "/login?mode=create"}>
              {creating ? "Sign in" : "Create one"}
            </Link>
          </p>

          <p id="google-sign-in-note" className={styles.note}>
            Google only identifies your account.
          </p>
        </div>
      </section>
    </main>
  );
}

function LoginError({ title, body }: { title: string; body: string }) {
  return (
    <div role="alert" className={styles.error}>
      <p>{title}</p>
      <span>{body}</span>
    </div>
  );
}

function loginErrorMessage(error: string) {
  if (error === "AccessDenied") {
    return {
      title: "Google couldn’t finish the sign-in.",
      body: "Try again with the Google account you want to use for Slate.",
    };
  }

  if (error === "Configuration") {
    return {
      title: "Sign-in is temporarily unavailable.",
      body: "Please try again shortly.",
    };
  }

  return {
    title: "We couldn’t sign you in.",
    body: "Nothing changed. Try Google again.",
  };
}
