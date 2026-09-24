import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { GoogleSignInButton } from "@/components/login/google-sign-in-button";
import { EmailAuthForm } from "@/components/login/email-auth-form";
import { LoginOverlay } from "@/components/login/login-overlay";
import { getAppSession } from "@/lib/app-access";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { safeRedirectPath } from "@/lib/email-auth-core";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in or join · slate",
  description: "Use your email or Google account to create or open your slate.",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    mode?: string | string[];
    next?: string | string[];
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
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next;
  const creating = rawMode === "create";
  const redirectTo = safeRedirectPath(rawNext);
  const error = rawError ? loginErrorMessage(rawError) : null;
  const switchParams = new URLSearchParams();
  if (!creating) switchParams.set("mode", "create");
  if (redirectTo !== "/app") switchParams.set("next", redirectTo);
  const switchHref = `/login${switchParams.size ? `?${switchParams}` : ""}`;

  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo });
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

        <EmailAuthForm creating={creating} redirectTo={redirectTo} />

        <div className="my-5 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35" aria-hidden>
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form action={continueWithGoogle}>
          <GoogleSignInButton
            label={creating ? "Sign up with Google" : "Sign in with Google"}
          />
        </form>

        <p className={styles.switchMode}>
          {creating ? "Already have a slate?" : "New to slate?"}{" "}
          <Link href={switchHref} scroll={false}>
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
    body: "Nothing changed. Try again with email or Google.",
  };
}
