"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "slate-ios-install-dismissed";

function detectIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !("MSStream" in window)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStandalone()) return;

    if (detectIOS()) {
      if (!localStorage.getItem(DISMISS_KEY)) setShowIOS(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Close hint on outside click
  useEffect(() => {
    if (!hintOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setHintOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [hintOpen]);

  function dismissIOS() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShowIOS(false);
    setHintOpen(false);
  }

  // Chrome / Edge / Android — native install prompt
  if (prompt) {
    async function handleInstall() {
      if (!prompt) return;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setPrompt(null);
    }

    return (
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-primary/40"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install</span>
      </button>
    );
  }

  // iOS Safari — share sheet instructions
  if (showIOS) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setHintOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-primary/40"
        >
          <Share className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add to home</span>
        </button>

        {hintOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">Add to home screen</p>
              <button
                type="button"
                onClick={dismissIOS}
                aria-label="Dismiss"
                className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Tap{" "}
              <span className="inline-flex items-center gap-0.5 align-middle">
                <Share className="h-3.5 w-3.5 text-foreground" />
              </span>{" "}
              at the bottom of your browser, then tap{" "}
              <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
