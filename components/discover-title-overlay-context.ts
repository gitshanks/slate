"use client";

import * as React from "react";
import type { TmdbSearchResult } from "@/lib/tmdb";

export interface DiscoverTitleOverlayContextValue {
  selectedAnchorElementId: string | null;
  hasSelection: boolean;
  open: (
    item: TmdbSearchResult,
    saved: boolean,
    anchorElementId: string,
  ) => void;
  prefetch: (item: TmdbSearchResult) => void;
  isSaved: (item: TmdbSearchResult, fallback: boolean) => boolean;
}

export const DiscoverTitleOverlayContext =
  React.createContext<DiscoverTitleOverlayContextValue | null>(null);

export function useDiscoverTitleOverlay() {
  return React.useContext(DiscoverTitleOverlayContext);
}
