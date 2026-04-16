"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-[0.15em]"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      Back
    </button>
  );
}
