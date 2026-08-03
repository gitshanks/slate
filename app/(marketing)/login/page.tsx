import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { GoogleSignInButton } from "@/components/login/google-sign-in-button";
import { LoginOverlay } from "@/components/login/login-overlay";
import { getAppSession } from "@/lib/app-access";
import { SLATE_HOSTED } from "@/lib/public-mode";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in or join · slate",
  description: "Use your Google account to create or open your slate.",
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
    <LoginOverlay
      className={styles.overlay}
      dismissClassName={styles.dismissArea}
      contentClassName={styles.auth}
      closingClassName={styles.closing}
    >
      <div className={styles.authInner}>
        <h1 id="auth-title">
          {creating ? "Create your slate" : "Sign in to slate"}
        </h1>

        {error ? <LoginError title={error.title} body={error.body} /> : null}

        <form action={continueWithGoogle} className={styles.form}>
          <GoogleSignInButton
            label={creating ? "Sign up with Google" : "Sign in with Google"}
          />
        </form>

        <p className={styles.switchMode}>
          {creating ? "Already have a slate?" : "New to slate?"}{" "}
          <Link href={creating ? "/login" : "/login?mode=create"} scroll={false}>
            {creating ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </LoginOverlay>
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
      body: "Try again with the Google account you want to use for slate.",
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
