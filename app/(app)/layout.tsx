import { CommandPaletteProvider } from "@/components/command-palette";
import { AiConversationProvider } from "@/components/ai-conversation";
import { TopNav } from "@/components/top-nav";
import { BottomNav } from "@/components/bottom-nav";
import { DemoBanner } from "@/components/demo-banner";
import { aiSearchEnabled } from "@/lib/ai-search";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // AiConversationProvider wraps everything so the command palette and the
    // /discover page share one live AI thread across client-side navigation.
    <AiConversationProvider>
      <CommandPaletteProvider aiEnabled={aiSearchEnabled}>
        {process.env.NEXT_PUBLIC_DEMO_MODE === "1" && <DemoBanner />}
        <TopNav />
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
