import { CommandPaletteProvider } from "@/components/command-palette";
import { TopNav } from "@/components/top-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <TopNav />
      <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </CommandPaletteProvider>
  );
}
