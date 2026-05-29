"use client";

import { useCommandPalette } from "@/components/command-palette";
import { Search } from "lucide-react";

export function OpenPaletteHint() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <Search className="h-4 w-4" />
      Open search
      <kbd className="ml-1 rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
        ⌘K
      </kbd>
    </button>
  );
}
