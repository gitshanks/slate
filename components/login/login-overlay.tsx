"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const EXIT_DURATION_MS = 180;
const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

export function LoginOverlay({
  children,
  className,
  dismissClassName,
  contentClassName,
  closingClassName,
}: {
  children: React.ReactNode;
  className: string;
  dismissClassName: string;
  contentClassName: string;
  closingClassName: string;
}) {
  const router = useRouter();
  const overlayRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusFrameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      router.replace("/", { scroll: false });
    }, EXIT_DURATION_MS);
  }, [router]);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (restoreFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFocusFrameRef.current);
    }

    // The landing page marks its trigger before navigation can make it inert.
    const markedTrigger = document.querySelector<HTMLElement>(
      '[data-slate-auth-trigger="true"]',
    );
    const activeElement = document.activeElement;
    if (markedTrigger) {
      returnFocusRef.current = markedTrigger;
    } else if (
      !returnFocusRef.current &&
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      !overlay.contains(activeElement)
    ) {
      returnFocusRef.current = activeElement;
    }

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousOverscroll = body.style.overscrollBehavior;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Keep the document at the same scroll offset while the dialog scrolls.
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    dialogRef.current?.focus({ preventScroll: true });

    function getFocusableElements() {
      return Array.from(
        overlay!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[inert]") &&
          element.getClientRects().length > 0 &&
          window.getComputedStyle(element).visibility !== "hidden",
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus({ preventScroll: true });
        return;
      }

      const focused = document.activeElement;
      const focusIsInside = focusable.some((element) => element === focused);
      if (event.shiftKey && (!focusIsInside || focused === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!focusIsInside || focused === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (event.target instanceof Node && !overlay!.contains(event.target)) {
        dialogRef.current?.focus({ preventScroll: true });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }

      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousOverscroll;
      markedTrigger?.removeAttribute("data-slate-auth-trigger");

      if (
        window.location.pathname === "/" ||
        window.location.pathname === "/login"
      ) {
        window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
      }

      // Wait until the shared landing layout has removed its inert state.
      restoreFocusFrameRef.current = window.requestAnimationFrame(() => {
        if (window.location.pathname !== "/" || overlay.isConnected) return;
        const target =
          returnFocusRef.current ??
          document.querySelector<HTMLElement>('a[href^="/login"]');
        if (target?.isConnected && !target.closest("[inert]")) {
          target.focus({ preventScroll: true });
        }
      });
    };
  }, [dismiss]);

  return (
    <section
      ref={overlayRef}
      className={cn(className, closing && closingClassName)}
      aria-labelledby="auth-title"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        className={dismissClassName}
        aria-label="Back to slate"
        tabIndex={-1}
        onClick={dismiss}
      />
      <div ref={dialogRef} className={contentClassName} tabIndex={-1}>
        {children}
      </div>
    </section>
  );
}
