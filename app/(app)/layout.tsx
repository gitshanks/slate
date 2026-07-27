import { CommandPaletteProvider } from "@/components/command-palette";
import { AiConversationProvider } from "@/components/ai-conversation";
import { TopNav } from "@/components/top-nav";
import { BottomNav } from "@/components/bottom-nav";
import { DemoBanner } from "@/components/demo-banner";
import { aiSearchEnabled } from "@/lib/ai-search";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";

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
        {process.env.NEXT_PUBLIC_DEMO_MODE === "1" && <DemoBanner />}
        <TopNav
          profile={
            profile
              ? {
                  displayName: profile.display_name,
                  avatarUrl: profile.avatar_url,
                }
              : null
          }
        />
        {/* Mobile reserves bottom padding for the fixed BottomNav (~56px tall
            plus iOS safe-area-inset-bottom). Desktop falls back to the
            standard py-6 / lg:py-8 since BottomNav is md:hidden. */}
        <main
          className="w-full px-4 pt-5 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8 pb-[calc(env(safe-area-inset-bottom)+7rem)] md:pb-6 lg:pb-8"
        >
          {children}
        </main>
        <BottomNav />
      </CommandPaletteProvider>
    </AiConversationProvider>
  );
}
