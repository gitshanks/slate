import type { Metadata } from "next";
import { LogOut, UserRound } from "lucide-react";
import { signOut } from "@/auth";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById } from "@/lib/profiles";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { APP_ROOT, SLATE_HOSTED } from "@/lib/public-mode";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Profile — slate",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  if (!SLATE_HOSTED) redirect(APP_ROOT);
  const ownerId = await getLibraryOwnerId();
  const profile = await getProfileById(ownerId);

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-border p-6">
        <p className="text-sm text-muted-foreground">
          Profile settings are available on the hosted Google-account version of Slate.
        </p>
      </div>
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://slate.nishh.dev";

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Your account
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Profile</h1>
        </div>
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-12 w-12 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <UserRound className="h-5 w-5" />
          </span>
        )}
      </div>

      <section className="mt-8 rounded-[1.5rem] border border-border bg-card/70 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">{profile.display_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your library stays private until you turn on its public link.
          </p>
        </div>

        <ProfileSettingsForm
          username={profile.username}
          isPublic={profile.is_public}
          origin={origin}
        />
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
        className="mt-4"
      >
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}
