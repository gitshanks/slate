"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ShieldCheck, X } from "lucide-react";
import * as React from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_PREFERENCES_EVENT,
  analyticsConfigured,
  analyticsRoute,
  analyticsSurface,
  browserPrivacySignalEnabled,
  captureAnalytics,
  capturePageview,
  ensureAnalyticsInitialized,
  errorFingerprint,
  readAnalyticsConsent,
  resetAnalyticsIdentity,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const [choice, setChoice] = React.useState<AnalyticsConsent | null>(null);
  const [ready, setReady] = React.useState(false);
  const [preferencesOpen, setPreferencesOpen] = React.useState(false);
  const configured = analyticsConfigured();
  const privacySignal = browserPrivacySignalEnabled();

  React.useEffect(() => {
    const initial = readAnalyticsConsent();
    setChoice(initial);
    setReady(true);
    if (initial === "granted") ensureAnalyticsInitialized();

    const onConsent = (event: Event) => {
      setChoice((event as CustomEvent<AnalyticsConsent>).detail);
    };
    const onPreferences = () => setPreferencesOpen(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_CONSENT_KEY) return;
      setChoice(readAnalyticsConsent());
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, onPreferences);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
      window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, onPreferences);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  React.useEffect(() => {
    if (choice === "granted") capturePageview(pathname);
  }, [choice, pathname]);

  React.useEffect(() => {
    if (choice !== "granted") return;

    const onClick = (event: MouseEvent) => {
      const source = event.target;
      if (!(source instanceof Element)) return;
      if (source.closest(".ph-no-capture,[data-analytics-ignore]")) return;
      const target = source.closest<HTMLElement>(
        'a,button,input[type="button"],input[type="submit"],[role="button"],[role="menuitem"],[data-analytics-action]',
      );
      if (!target || target.hasAttribute("disabled")) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      const destination = anchor ? destinationFor(anchor.href) : null;
      captureAnalytics("ui_interaction", {
        action: target.dataset.analyticsAction || "unlabeled",
        area:
          target.dataset.analyticsArea ||
          target.closest<HTMLElement>("[data-analytics-area]")?.dataset
            .analyticsArea ||
          "unlabeled",
        element: elementKind(target),
        destination,
        route: analyticsRoute(window.location.pathname),
        surface: analyticsSurface(analyticsRoute(window.location.pathname)),
      });
      if (target.dataset.analyticsReset === "true") {
        window.setTimeout(resetAnalyticsIdentity, 0);
      }
    };

    const onSubmit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      if (event.target.closest(".ph-no-capture,[data-analytics-ignore]")) return;
      captureAnalytics("form_submitted", {
        form: event.target.dataset.analyticsForm || "unlabeled",
        route: analyticsRoute(window.location.pathname),
      });
      if (event.target.dataset.analyticsReset === "true") {
        window.setTimeout(resetAnalyticsIdentity, 0);
      }
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      if (
        target instanceof HTMLInputElement &&
        !["checkbox", "radio", "range"].includes(target.type)
      ) {
        return;
      }
      if (target.closest(".ph-no-capture,[data-analytics-ignore]")) return;
      captureAnalytics("ui_control_changed", {
        action: target.dataset.analyticsAction || target.name || "unlabeled",
        area:
          target.dataset.analyticsArea ||
          target.closest<HTMLElement>("[data-analytics-area]")?.dataset
            .analyticsArea ||
          "unlabeled",
        control: target instanceof HTMLSelectElement ? "select" : target.type,
        enabled:
          target instanceof HTMLInputElement &&
          ["checkbox", "radio"].includes(target.type)
            ? target.checked
            : null,
        route: analyticsRoute(window.location.pathname),
      });
    };

    const onError = (event: ErrorEvent) => {
      captureAnalytics("client_error", {
        ...errorFingerprint(event.error ?? event.message),
        source: errorSource(event.filename),
        line: event.lineno || null,
        column: event.colno || null,
        route: analyticsRoute(window.location.pathname),
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      captureAnalytics("client_error", {
        ...errorFingerprint(event.reason),
        source: "unhandled_promise",
        route: analyticsRoute(window.location.pathname),
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("change", onChange, true);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("change", onChange, true);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [choice]);

  if (!configured || !ready) return null;
  const panelOpen = choice === null || preferencesOpen;
  if (!panelOpen) return null;

  function choose(next: AnalyticsConsent) {
    setAnalyticsConsent(next);
    setChoice(readAnalyticsConsent());
    setPreferencesOpen(false);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
      role={preferencesOpen ? "dialog" : "region"}
      aria-modal={preferencesOpen || undefined}
      aria-label="Analytics choices"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[1.4rem] border border-white/[0.12] bg-[#11110f]/96 text-[#f4efe6] shadow-[0_28px_100px_rgba(0,0,0,0.56)] ring-1 ring-black/30 backdrop-blur-2xl">
        <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4 sm:p-5">
          <div className="hidden h-11 w-11 place-items-center rounded-full bg-[#adebb3]/10 text-[#adebb3] sm:grid">
            {privacySignal ? (
              <ShieldCheck className="h-5 w-5" aria-hidden />
            ) : (
              <BarChart3 className="h-5 w-5" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold tracking-[-0.01em]">
                  {privacySignal ? "Your privacy signal is on" : "Help make slate better"}
                </h2>
                <p className="mt-1.5 max-w-xl text-xs leading-5 text-white/58">
                  {privacySignal
                    ? "Slate is keeping optional analytics off for this browser."
                    : "With your permission, slate records feature use, performance, errors, and masked session replays. Search text, notes, list names, sign-in codes, and file contents stay out."}
                </p>
              </div>
              {preferencesOpen ? (
                <button
                  type="button"
                  onClick={() => setPreferencesOpen(false)}
                  className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white"
                  aria-label="Close analytics choices"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <Link
              href="/privacy"
              className="mt-2 inline-block text-[11px] font-medium text-[#adebb3]/80 underline decoration-[#adebb3]/25 underline-offset-4 hover:text-[#adebb3]"
            >
              Privacy and analytics details
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={() => choose("denied")}
              className="h-10 rounded-full border border-white/12 px-4 text-xs font-semibold text-white/72 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              Necessary only
            </button>
            <button
              type="button"
              onClick={() => choose("granted")}
              disabled={privacySignal}
              className="h-10 rounded-full bg-[#adebb3] px-4 text-xs font-semibold text-[#0a0c0a] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Accept analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function elementKind(element: HTMLElement) {
  if (element instanceof HTMLAnchorElement) return "link";
  if (element instanceof HTMLButtonElement) return "button";
  return element.getAttribute("role") || element.tagName.toLowerCase();
}

function destinationFor(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin
      ? analyticsRoute(url.pathname)
      : `external:${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return null;
  }
}

function errorSource(filename: string) {
  if (!filename) return "window";
  try {
    return analyticsRoute(new URL(filename, window.location.origin).pathname);
  } catch {
    return "window";
  }
}
