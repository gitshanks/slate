"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";

export function GoogleSignInButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Opening Google" : "Continue with Google"}
      aria-describedby="google-sign-in-note"
      className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-white px-6 text-sm font-semibold text-[#101012] shadow-[0_18px_55px_rgba(255,255,255,0.1)] transition-[transform,background-color] duration-200 hover:scale-[1.015] hover:bg-[#f4f1ff] active:scale-[0.985] disabled:cursor-wait disabled:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] focus-visible:ring-offset-4 focus-visible:ring-offset-[#09090b]"
    >
      <span
        aria-hidden
        className={`flex items-center justify-center gap-3 transition-[opacity,transform] duration-200 ${
          pending ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <GoogleMark />
        Continue with Google
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>

      <span
        aria-hidden
        className={`absolute inset-0 flex items-center justify-center gap-3 transition-[opacity,transform] duration-200 ${
          pending ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="flex items-center gap-1" aria-hidden>
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#7957df] [animation-delay:-180ms]" />
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#7957df] [animation-delay:-90ms]" />
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#7957df]" />
        </span>
        Opening Google
      </span>
      <span className="sr-only" aria-live="polite">
        {pending ? "Opening Google" : ""}
      </span>
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6.01 6.01 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}
