import { CommandPaletteProvider } from "@/components/command-palette";
import { AiConversationProvider } from "@/components/ai-conversation";
import { TopNav } from "@/components/top-nav";
import { BottomNav } from "@/components/bottom-nav";
import { AppScrollArea } from "@/components/app-scroll-area";
import { DemoBanner } from "@/components/demo-banner";
import { aiSearchEnabled } from "@/lib/ai-search";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { SLATE_HOSTED, SLATE_PUBLIC } from "@/lib/public-mode";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // This layout and the data-access layer are the authorization boundary.
  // Keeping the check here avoids a billable Proxy invocation on every route.
  const ownerId = await getLibraryOwnerId();
  const profile = SLATE_HOSTED
    ? await getProfileById(ownerId)
    : null;

  return (
    // AiConversationProvider wraps everything so the command palette and the
    // /discover page share one live AI thread across client-side navigation.
    <AiConversationProvider>
      <CommandPaletteProvider aiEnabled={aiSearchEnabled}>
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
