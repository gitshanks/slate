"use client";

import * as React from "react";
import { browserPrivacySignalEnabled, readAnalyticsConsent } from "@/lib/analytics";
import {
  SIGNUP_SOURCE_COOKIE,
  SIGNUP_SOURCE_MAX_AGE,
  encodeSignupSource,
  resolveSignupSource,
} from "@/lib/signup-source";

/**
 * Remember where a visitor first arrived from (an Instagram bio link, a TikTok
 * tap, a UTM-tagged post) so it can be saved with their account if they sign
 * up. First touch only: an existing cookie is never overwritten. Skipped when
 * the browser sends a privacy signal or analytics was declined.
 */
export function SignupSourceCapture() {
  React.useEffect(() => {
    try {
      if (document.cookie.split("; ").some((c) => c.startsWith(`${SIGNUP_SOURCE_COOKIE}=`))) return;
      if (browserPrivacySignalEnabled() || readAnalyticsConsent() === "denied") return;
      const value = resolveSignupSource({
        search: window.location.search,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        ownHost: window.location.host,
        path: window.location.pathname,
      });
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${SIGNUP_SOURCE_COOKIE}=${encodeSignupSource(value)}; Max-Age=${SIGNUP_SOURCE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    } catch {
      // Attribution is best-effort and must never affect the page.
    }
  }, []);

  return null;
}
