"use client";

import * as React from "react";

/**
 * Thin wrapper around React's experimental `<ViewTransition>` component.
 *
 * Next.js 16 aliases the `react` import to its bundled React build (see
 * `node_modules/next/dist/build/create-compiler-aliases.js`), which exports
 * `ViewTransition` at runtime. The public `@types/react@19.2` package does
 * not declare it yet, so we look it up dynamically and fall back to a plain
 * fragment when absent (e.g. in a test or typecheck-only environment).
 *
 * Requires `experimental.viewTransition: true` in `next.config.ts` for Next
 * to wrap router navigations in `document.startViewTransition`.
 */

interface ViewTransitionProps {
  name?: string;
  children: React.ReactNode;
}

const RuntimeViewTransition = (
  React as unknown as {
    ViewTransition?: React.ComponentType<ViewTransitionProps>;
  }
).ViewTransition;

export function ViewTransition({ name, children }: ViewTransitionProps) {
  if (!RuntimeViewTransition) return <>{children}</>;
  return <RuntimeViewTransition name={name}>{children}</RuntimeViewTransition>;
}
