"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const EXIT_DURATION_MS = 180;

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
  const dialogRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [dismiss]);

  return (
    <section
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
