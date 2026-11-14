"use client";

import * as React from "react";
import type {
  SharedLinkCandidate,
  SharedLinkResolution,
} from "@/lib/shared-link-resolver";

/** What the importer needs to come back to after a title card closes. */
export interface LinkPreviewSnapshot {
  resolution: SharedLinkResolution;
  selected: string[];
}

export interface LinkPreviewOptions {
  snapshot: LinkPreviewSnapshot;
  /** Called when the card closes while the importer stayed mounted. */
  onClose: (savedFromCard: boolean) => void;
}

export type LinkPreviewHandler = (
  candidate: SharedLinkCandidate,
  options: LinkPreviewOptions,
) => void;

export const LinkPreviewContext = React.createContext<LinkPreviewHandler | null>(
  null,
);

export function useLinkPreview(): LinkPreviewHandler | null {
  return React.useContext(LinkPreviewContext);
}
