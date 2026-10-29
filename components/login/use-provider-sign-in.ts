"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";

// Google and Apple sign-in leave the page for the provider. If the person
// closes that sheet or goes back, the page comes back (from the back-forward
// cache, or from behind an in-app browser in the installed app), so the button
// has to stop showing its loading state then. A server action can't do that:
// its pending state never settles once it hands off to an external redirect.
export function useProviderSignIn(provider: "google" | "apple", redirectTo: string) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) return;

    let left = document.visibilityState === "hidden";
    const reset = () => setPending(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") left = true;
      else if (left) reset();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pending]);

  const start = useCallback(() => {
    if (pending) return;
    setPending(true);
    signIn(provider, { redirectTo }).catch(() => setPending(false));
  }, [pending, provider, redirectTo]);

  return { pending, start };
}
