"use client";

import * as React from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  captureAnalytics,
  identifyAnalyticsUser,
  readAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics";

export function AnalyticsIdentity({
  id,
  email,
  displayName,
  createdAt,
}: {
  id: string;
  email?: string | null;
  displayName?: string | null;
  createdAt?: string | null;
}) {
  React.useEffect(() => {
    const identify = () => {
      if (readAnalyticsConsent() !== "granted") return;
      identifyAnalyticsUser({ id, email, displayName, createdAt });
      const sessionKey = `slate:analytics-session:${id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        captureAnalytics("account_session_started", {
          has_profile_name: Boolean(displayName),
          account_age_days: createdAt
            ? Math.max(
                0,
                Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000),
              )
            : null,
        });
        sessionStorage.setItem(sessionKey, "1");
      }
    };

    identify();
    const onConsent = (event: Event) => {
      if ((event as CustomEvent<AnalyticsConsent>).detail === "granted") identify();
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
  }, [createdAt, displayName, email, id]);

  return null;
}
