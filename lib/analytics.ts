"use client";

import type {
  CaptureResult,
  PostHog,
  Properties,
} from "posthog-js";

export const ANALYTICS_CONSENT_KEY = "slate:analytics-consent:v1";
export const ANALYTICS_CONSENT_EVENT = "slate:analytics-consent-changed";
export const ANALYTICS_PREFERENCES_EVENT = "slate:open-analytics-preferences";

export type AnalyticsConsent = "granted" | "denied";

export type AnalyticsEvent =
  | "account_session_started"
  | "ai_prompt_submitted"
  | "account_signed_out"
  | "analytics_consent_updated"
  | "auth_method_selected"
  | "client_error"
  | "form_submitted"
  | "import_completed"
  | "list_created"
  | "list_deleted"
  | "list_invite_created"
  | "list_member_removed"
  | "list_title_added"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "onboarding_started"
  | "onboarding_title_decided"
  | "preview_advanced"
  | "preview_info_opened"
  | "preview_playback_failed"
  | "preview_saved"
  | "preview_session_completed"
  | "profile_link_copied"
  | "profile_avatar_updated"
  | "profile_updated"
  | "search_opened"
  | "search_started"
  | "shared_link_resolved"
  | "shared_link_titles_saved"
  | "title_share_opened"
  | "title_share_link_copied"
  | "title_share_sheet_completed"
  | "shared_title_viewed"
  | "shared_title_save_started"
  | "shared_title_join_started"
  | "shared_title_saved"
  | "title_favorite_changed"
  | "title_note_saved"
  | "title_rated"
  | "title_removed"
  | "title_saved"
  | "title_status_changed"
  | "trailer_opened"
  | "ui_control_changed"
  | "ui_interaction";

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const API_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const UI_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_UI_HOST?.trim() || "https://us.posthog.com";

let analyticsClient: PostHog | null = null;
let initializationPromise: Promise<PostHog | null> | null = null;

export function analyticsConfigured() {
  return Boolean(PROJECT_TOKEN);
}

export function browserPrivacySignalEnabled() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const privacyNavigator = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    doNotTrack?: string | null;
  };
  return (
    privacyNavigator.globalPrivacyControl === true ||
    privacyNavigator.doNotTrack === "1" ||
    (window as Window & { doNotTrack?: string | null }).doNotTrack === "1"
  );
}

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  if (browserPrivacySignalEnabled()) return "denied";
  const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return stored === "granted" || stored === "denied" ? stored : null;
}

export function setAnalyticsConsent(consent: AnalyticsConsent) {
  if (typeof window === "undefined") return;
  const next = browserPrivacySignalEnabled() ? "denied" : consent;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, next);

  if (next === "granted") {
    void ensureAnalyticsInitialized().then((client) => {
      if (!client) return;
      client.opt_in_capturing();
      client.startSessionRecording();
      client.capture("analytics_consent_updated", { choice: "granted" });
    });
  } else if (analyticsClient) {
    analyticsClient.stopSessionRecording();
    analyticsClient.opt_out_capturing();
  }

  window.dispatchEvent(
    new CustomEvent<AnalyticsConsent>(ANALYTICS_CONSENT_EVENT, {
      detail: next,
    }),
  );
}

export function ensureAnalyticsInitialized(): Promise<PostHog | null> {
  if (
    !PROJECT_TOKEN ||
    typeof window === "undefined" ||
    browserPrivacySignalEnabled()
  ) {
    return Promise.resolve(analyticsClient);
  }
  if (analyticsClient) return Promise.resolve(analyticsClient);
  if (initializationPromise) return initializationPromise;

  initializationPromise = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(PROJECT_TOKEN, {
    api_host: API_HOST,
    ui_host: UI_HOST,
    defaults: "2026-05-30",
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
    cookie_expiration: 180,
    cross_subdomain_cookie: false,
    secure_cookie: window.location.protocol === "https:",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    rageclick: true,
    capture_exceptions: false,
    capture_performance: {
      network_timing: false,
      web_vitals: true,
      web_vitals_attribution: false,
    },
    disableDeviceModel: true,
    disable_surveys: true,
    advanced_disable_feature_flags: true,
    advanced_disable_feature_flags_on_first_load: true,
    respect_dnt: true,
    ip: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    mask_personal_data_properties: true,
    custom_personal_data_properties: [
      "email",
      "code",
      "token",
      "invite",
      "q",
      "query",
      "search",
      "text",
      "url",
    ],
    property_denylist: ["$raw_user_agent", "$user_agent"],
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "*",
      blockSelector:
        '[data-analytics-private], input[type="hidden"], input[type="file"]',
      recordHeaders: false,
      recordBody: false,
      captureCanvas: { recordCanvas: false },
      maskCapturedNetworkRequestFn: () => null,
    },
    get_current_url: sanitizeUrl,
    before_send: sanitizeCapture,
    loaded: (loadedClient) => {
      if (readAnalyticsConsent() === "granted") {
        loadedClient.opt_in_capturing();
        loadedClient.startSessionRecording();
      } else {
        loadedClient.stopSessionRecording();
        loadedClient.opt_out_capturing();
      }
    },
  });
    analyticsClient = posthog;
    return posthog;
  });
  return initializationPromise;
}

export function captureAnalytics(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
  options?: { immediate?: boolean },
) {
  if (readAnalyticsConsent() !== "granted") return;
  void ensureAnalyticsInitialized().then((client) => {
    client?.capture(event, cleanProperties(properties), {
      send_instantly: options?.immediate,
    });
  });
}

export function capturePageview(pathname?: string) {
  if (typeof window === "undefined") return;
  if (readAnalyticsConsent() !== "granted") return;
  const route = analyticsRoute(pathname ?? window.location.pathname);
  const currentUrl = new URL(window.location.href);
  currentUrl.pathname = route;
  currentUrl.search = "";
  currentUrl.hash = "";
  void ensureAnalyticsInitialized().then((client) => {
    client?.capture("$pageview", {
      $current_url: currentUrl.toString(),
      $pathname: route,
      route,
      surface: analyticsSurface(route),
    });
  });
}

export function identifyAnalyticsUser({
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
  if (readAnalyticsConsent() !== "granted") return;
  const locale = navigator.language || null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  void ensureAnalyticsInitialized().then((client) => {
    client?.identify(
      id,
      {
        ...(email ? { email } : {}),
        ...(displayName ? { display_name: displayName } : {}),
        locale,
        time_zone: timeZone,
        platform: "web",
      },
      {
        ...(createdAt ? { account_created_at: createdAt } : {}),
      },
    );
  });
}

export function resetAnalyticsIdentity() {
  if (readAnalyticsConsent() !== "granted" || !analyticsClient) return;
  analyticsClient.capture("account_signed_out", {}, { send_instantly: true });
  analyticsClient.reset();
  analyticsClient.opt_in_capturing();
  analyticsClient.startSessionRecording();
}

export function openAnalyticsPreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT));
}

export function analyticsRoute(rawPath: string) {
  let pathname = rawPath.split(/[?#]/, 1)[0] || "/";
  try {
    pathname = decodeURI(pathname);
  } catch {
    // Keep the undecodable path and still apply segment redaction below.
  }

  const replacements: Array<[RegExp, string]> = [
    [/^\/t\/(movie|tv)\/[^/]+/i, "/t/:type/:id"],
    [/^\/join\/[^/]+/i, "/join/:token"],
    [/^\/u\/[^/]+\/title\/[^/]+/i, "/u/:username/title/:id"],
    [/^\/u\/[^/]+/i, "/u/:username"],
    [/^\/discover\/(movie|tv)\/[^/]+/i, "/discover/:type/:id"],
    [/^\/title\/[^/]+/i, "/title/:id"],
    [/^\/person\/[^/]+/i, "/person/:id"],
    [/^\/lists\/[^/]+/i, "/lists/:slug"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(pathname)) return pathname.replace(pattern, replacement);
  }
  return pathname;
}

export function analyticsSurface(route: string) {
  if (route.startsWith("/t/")) return "shared_title";
  if (route === "/") return "landing";
  if (route.startsWith("/login")) return "auth";
  if (route.startsWith("/onboarding")) return "onboarding";
  if (route.startsWith("/previews")) return "previews";
  if (route.startsWith("/discover")) return "discover";
  if (route.startsWith("/lists")) return "lists";
  if (route.startsWith("/profile")) return "profile";
  if (route.startsWith("/import")) return "import";
  if (route.startsWith("/search")) return "search";
  if (route.startsWith("/title/")) return "title_detail";
  if (route.startsWith("/person/")) return "person_detail";
  if (route.startsWith("/privacy")) return "privacy";
  if (route.startsWith("/u/")) return "public_profile";
  if (route === "/app") return "library";
  return "other";
}

export function countBucket(value: number) {
  if (value <= 0) return "0";
  if (value === 1) return "1";
  if (value <= 3) return "2-3";
  if (value <= 10) return "4-10";
  if (value <= 25) return "11-25";
  if (value <= 100) return "26-100";
  return "100+";
}

export function durationBucket(milliseconds: number) {
  if (milliseconds < 2_000) return "under_2s";
  if (milliseconds < 10_000) return "2-10s";
  if (milliseconds < 30_000) return "10-30s";
  if (milliseconds < 120_000) return "30s-2m";
  if (milliseconds < 600_000) return "2-10m";
  return "10m+";
}

export function errorFingerprint(value: unknown) {
  const error = value instanceof Error ? value : null;
  const name = error?.name || typeof value;
  const raw = error?.message || String(value ?? "unknown");
  const normalized = raw
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "<email>")
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/["'`][^"'`]{1,100}["'`]/g, "<value>")
    .replace(/\b\d+\b/g, "#")
    .slice(0, 300);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return { error_name: name.slice(0, 80), fingerprint: (hash >>> 0).toString(36) };
}

function sanitizeCapture(capture: CaptureResult | null): CaptureResult | null {
  if (!capture) return null;
  capture.properties = sanitizeSystemProperties(capture.properties);
  return capture;
}

function sanitizeSystemProperties(properties: Properties): Properties {
  const next: Properties = { ...properties };
  for (const key of [
    "$current_url",
    "$referrer",
  ]) {
    if (typeof next[key] === "string") next[key] = sanitizeUrl(next[key]);
  }
  for (const key of [
    "$prev_pageview_pathname",
    "$next_pageview_pathname",
    "$pathname",
  ]) {
    if (typeof next[key] === "string") next[key] = analyticsRoute(next[key]);
  }
  return next;
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    url.pathname = analyticsRoute(url.pathname);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return analyticsRoute(value);
  }
}

function cleanProperties(properties: AnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([, value]) =>
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    ),
  );
}
