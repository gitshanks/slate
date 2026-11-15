"use client";

import * as React from "react";
import type { SharedLinkCandidate } from "@/lib/shared-link-resolver";

export interface LinkPreviewOptions {
  /** Called when the card closes, with whether the title was added from it. */
  onClose: (savedFromCard: boolean) => void;
}

export interface LinkPreview {
  /** Open a title's card on top of the link results it was found in. */
  open: (candidate: SharedLinkCandidate, options: LinkPreviewOptions) => void;
  /** Fetch a title's details ahead of time, so its card opens complete. */
  prefetch: (candidate: SharedLinkCandidate) => void;
}

export const LinkPreviewContext = React.createContext<LinkPreview | null>(null);

export function useLinkPreview(): LinkPreview | null {
  return React.useContext(LinkPreviewContext);
}
