import { CommandPaletteProvider } from "@/components/command-palette";
import { TopNav } from "@/components/top-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <TopNav />
      <main className="mx-auto w-full max-w-7xl px-6 py-10">{children}</main>
    </CommandPaletteProvider>
  );
}
