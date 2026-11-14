"use client";

import * as React from "react";
import type { SharedLinkCandidate } from "@/lib/shared-link-resolver";

export interface LinkPreviewOptions {
  /** Called when the card closes, with whether the title was added from it. */
  onClose: (savedFromCard: boolean) => void;
}

/** Opens a title's card on top of the link results it was found in. */
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
