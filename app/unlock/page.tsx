import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "watchlist-unlocked";

async function unlock(formData: FormData) {
  "use server";
  const submitted = String(formData.get("passcode") ?? "");
  const from = String(formData.get("from") ?? "/");
  const passcode = process.env.APP_PASSCODE ?? "";

  if (submitted && submitted === passcode) {
    const store = await cookies();
    store.set(COOKIE, passcode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 60, // 60 days
      path: "/",
    });
    redirect(from);
  }
  redirect(`/unlock?from=${encodeURIComponent(from)}&error=1`);
}

export default async function UnlockPage(props: PageProps<"/unlock">) {
  const sp = await props.searchParams;
  const from = typeof sp.from === "string" ? sp.from : "/";
  const error = sp.error === "1";

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Locked</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter passcode to access your watchlist
          </p>
        </div>

        <form action={unlock} className="space-y-3">
          <input type="hidden" name="from" value={from} />
          <input
            name="passcode"
            type="password"
            autoFocus
            placeholder="Passcode"
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
          {error && (
            <p className="text-xs text-destructive">Wrong passcode. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
