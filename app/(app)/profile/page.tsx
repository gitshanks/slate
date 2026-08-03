import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { APP_ROOT, SLATE_HOSTED } from "@/lib/public-mode";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Profile · slate",
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
          Profile settings are available on the hosted Google-account version of slate.
        </p>
      </div>
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://slate.nishh.dev";
  const avatarUrl = profileAvatarUrl(profile);

  return (
    <div className="mx-auto max-w-2xl pb-4 sm:pb-8">
      <header>
        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          Your account
        </p>
        <h1 className="mt-1 text-[2.5rem] font-semibold leading-none tracking-[-0.045em] sm:text-5xl">
          Your profile
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          Choose how your corner of slate appears when you share it.
        </p>
      </header>

      <section className="mt-7 overflow-hidden rounded-[1.75rem] border border-border bg-card/70 shadow-[0_18px_60px_-44px_hsl(var(--foreground)/0.45)] sm:mt-9">
        <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 border-b border-border/70 p-5 sm:flex sm:items-center sm:p-6">
          <ProfileAvatarEditor
            avatarUrl={avatarUrl}
            displayName={profile.display_name}
          />
          <div className="min-w-0 pt-1 sm:pt-0">
            <h2 className="truncate text-lg font-semibold sm:text-xl">
              {profile.display_name}
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              @{profile.username}
            </p>
          </div>
          <span
            className={`col-start-2 w-fit shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] sm:ml-auto ${
              profile.is_public
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {profile.is_public ? "Public" : "Private"}
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              Profile details
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Make it yours
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Update the name, address, and visibility of your slate.
            </p>
          </div>

          <ProfileSettingsForm
            displayName={profile.display_name}
            username={profile.username}
            isPublic={profile.is_public}
            origin={origin}
          />
        </div>
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
          className="inline-flex h-11 w-full items-center justify-between rounded-2xl px-4 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:justify-center sm:gap-2 sm:rounded-full"
        >
          <span className="inline-flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] sm:hidden">
            Google account
          </span>
        </button>
      </form>
    </div>
  );
}
