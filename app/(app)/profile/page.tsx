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
      <div className="mx-auto max-w-xl rounded-[1.5rem] border border-border/70 bg-card/50 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profile unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Profile settings are available on the hosted Google-account version of slate.
        </p>
      </div>
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.s1ate.space";
  const avatarUrl = profileAvatarUrl(profile);

  return (
    <div className="mx-auto w-full max-w-5xl pb-4 sm:pb-8">
      <header className="max-w-2xl">
        <h1 className="text-[2.5rem] font-semibold leading-none tracking-[-0.05em] sm:text-5xl">
          Profile
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-[15px]">
          Manage how you appear on slate and what friends can see.
        </p>
      </header>

      <div className="mt-7 grid items-start gap-5 sm:mt-9 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-7">
        <aside className="rounded-[1.75rem] border border-border/70 bg-card/55 p-5 shadow-[0_22px_70px_-56px_hsl(var(--foreground)/0.5)] sm:p-6 lg:sticky lg:top-24">
          <div className="flex min-w-0 items-center gap-5 lg:flex-col lg:text-center">
            <ProfileAvatarEditor
              avatarUrl={avatarUrl}
              displayName={profile.display_name}
            />
            <div className="min-w-0 flex-1 lg:w-full">
              <div className="flex items-center gap-2 lg:justify-center">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    profile.is_public ? "bg-success" : "bg-muted-foreground/55"
                  }`}
                  aria-hidden
                />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {profile.is_public ? "Public profile" : "Private profile"}
                </span>
              </div>
              <h2 className="mt-2 break-words text-2xl font-semibold leading-tight tracking-[-0.035em]">
                {profile.display_name}
              </h2>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                @{profile.username}
              </p>
              <p className="mt-4 hidden text-xs leading-5 text-muted-foreground lg:block">
                This is how your name and photo appear when friends open your slate.
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <ProfileSettingsForm
            displayName={profile.display_name}
            username={profile.username}
            isPublic={profile.is_public}
            origin={origin}
          />

          <section className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-sm font-semibold">Account</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Sign out of slate on this device.
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border/80 px-4 text-xs font-medium text-muted-foreground transition-[background-color,border-color,color,transform] hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive active:scale-[0.98] sm:w-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
