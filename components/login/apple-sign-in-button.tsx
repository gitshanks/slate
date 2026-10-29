"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { captureAnalytics } from "@/lib/analytics";

export function AppleSignInButton({
  label = "Continue with Apple",
}: {
  label?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Opening Apple" : label}
      onClick={() => captureAnalytics("auth_method_selected", { method: "apple", stage: "started" })}
      data-analytics-action="continue_with_apple"
      data-analytics-area="auth"
      className="group relative flex h-[58px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.1] bg-[#1b1b1b] px-6 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(0,0,0,0.38),inset_0_1px_rgba(255,255,255,0.04)] transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-white/[0.17] hover:bg-[#232323] active:translate-y-0 active:scale-[0.985] disabled:cursor-wait disabled:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ADEBB3] focus-visible:ring-offset-4 focus-visible:ring-offset-black"
    >
      <span
        aria-hidden
        className={`flex items-center justify-center gap-3 transition-[opacity,transform] duration-200 ${
          pending ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <AppleMark />
        {label}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>

      <span
        aria-hidden
        className={`absolute inset-0 flex items-center justify-center gap-3 transition-[opacity,transform] duration-200 ${
          pending ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="flex items-center gap-1" aria-hidden>
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#ADEBB3] [animation-delay:-180ms]" />
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#ADEBB3] [animation-delay:-90ms]" />
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#ADEBB3]" />
        </span>
        Opening Apple
      </span>
      <span className="sr-only" aria-live="polite">
        {pending ? "Opening Apple" : ""}
      </span>
    </button>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <path d="M16.37 12.7c-.02-2.17 1.77-3.21 1.85-3.26-1.01-1.47-2.58-1.67-3.13-1.7-1.33-.13-2.6.79-3.28.79-.68 0-1.72-.77-2.83-.75-1.45.02-2.8.85-3.55 2.15-1.52 2.63-.39 6.52 1.09 8.66.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.82-.7 1.31 0 1.69.7 2.84.68 1.17-.02 1.91-1.06 2.63-2.11.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.28-.87-2.3-3.46ZM14.2 6.33c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.07 1.96-.49 2.56-1.22Z" />
    </svg>
  );
}
