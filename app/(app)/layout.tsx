import { CommandPaletteProvider } from "@/components/command-palette";
import { AiConversationProvider } from "@/components/ai-conversation";
import { TopNav } from "@/components/top-nav";
import { BottomNav } from "@/components/bottom-nav";
import { AppScrollArea } from "@/components/app-scroll-area";
import { DemoBanner } from "@/components/demo-banner";
import { aiSearchEnabled } from "@/lib/ai-search";
import { getLibraryClient, getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { SLATE_HOSTED, SLATE_PUBLIC } from "@/lib/public-mode";
import { getAppSession } from "@/lib/app-access";
import { AnalyticsIdentity } from "@/components/analytics/analytics-identity";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // This layout and the data-access layer are the authorization boundary.
  // Keeping the check here avoids a billable Proxy invocation on every route.
  const ownerId = await getLibraryOwnerId();
  const [profile, db, session] = await Promise.all([
    SLATE_HOSTED ? getProfileById(ownerId) : Promise.resolve(null),
    getLibraryClient(),
    SLATE_HOSTED ? getAppSession() : Promise.resolve(null),
  ]);
  const listsResult = await db.from("lists").select("id, name").order("name");
  if (SLATE_HOSTED && profile && !profile.onboarding_completed_at) {
    redirect("/onboarding");
  }
  const lists = (listsResult.data ?? []).map((list) => ({
    id: String(list.id),
    name: String(list.name),
  }));

  return (
    // AiConversationProvider wraps everything so the command palette and the
    // /discover page share one live AI thread across client-side navigation.
    <AiConversationProvider>
      {SLATE_HOSTED ? (
        <AnalyticsIdentity
          id={ownerId}
          email={session?.user?.email}
          displayName={profile?.display_name}
          createdAt={profile?.created_at}
        />
      ) : null}
      <CommandPaletteProvider aiEnabled={aiSearchEnabled} lists={lists}>
        {/* Mobile navigation stays in the app stack so only the middle region
            scrolls, avoiding iOS drift after keyboard dismissal. Desktop uses
            the same dock as a compact fixed surface over document scrolling. */}
        <div className="flex h-svh min-h-0 w-full flex-col overflow-hidden md:block md:h-auto md:overflow-visible">
          {SLATE_PUBLIC && <DemoBanner />}
          <TopNav
            profile={
              profile
                ? {
                    displayName: profile.display_name,
                    avatarUrl: profileAvatarUrl(profile),
                  }
                : null
            }
          />
          <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] [grid-template-areas:'app-stack'] md:contents">
            <BottomNav />
            <AppScrollArea>{children}</AppScrollArea>
          </div>
        </div>
      </CommandPaletteProvider>
    </AiConversationProvider>
  );
}
