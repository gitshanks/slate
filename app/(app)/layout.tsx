import { CommandPaletteProvider } from "@/components/command-palette";
import { TopNav } from "@/components/top-nav";
import { NavDirectionProvider } from "@/components/nav-direction-context";
import { PageTransition } from "@/components/page-transition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavDirectionProvider>
      <CommandPaletteProvider>
        <TopNav />
        <PageTransition>{children}</PageTransition>
      </CommandPaletteProvider>
    </NavDirectionProvider>
  );
}
