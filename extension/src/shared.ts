// Shared between popup, background, and content scripts. Kept deliberately
// dependency-free (no React, no DOM helpers) — content scripts run in
// sandboxed script contexts that don't get bundled with anything else.

/** A single row scraped from a service, ready to POST to Slate. */
export interface SlateRow {
  title: string;
  sourceText: string;
  date?: string;
  year?: number;
  mediaHint?: "movie" | "tv";
  isEpisode?: boolean;
}

export type ServiceId = "netflix" | "prime" | "hulu" | "disney";

export interface ServiceDef {
  id: ServiceId;
  label: string;
  /** Regex for `chrome.tabs.query` URL match — informs "on current tab?" check. */
  urlPattern: RegExp;
  /** URL the popup's "Open history" shortcut deep-links to. */
  historyUrl: string;
}

export const SERVICES: readonly ServiceDef[] = [
  {
    id: "netflix",
    label: "Netflix",
    urlPattern: /:\/\/(www\.)?netflix\.com\/viewingactivity/i,
    historyUrl: "https://www.netflix.com/viewingactivity",
  },
  {
    id: "prime",
    label: "Prime Video",
    urlPattern: /:\/\/(www\.)?(amazon\.com\/gp\/video\/library|primevideo\.com\/settings\/watch-history)/i,
    historyUrl: "https://www.amazon.com/gp/video/library",
  },
  {
    id: "hulu",
    label: "Hulu",
    urlPattern: /:\/\/(www\.)?hulu\.com\/.*watch-history/i,
    historyUrl: "https://www.hulu.com/account/watch-history",
  },
  {
    id: "disney",
    label: "Disney+",
    urlPattern: /:\/\/(www\.)?disneyplus\.com\/(watchlist|.*\/profile\/watch-history)/i,
    historyUrl: "https://www.disneyplus.com/watchlist",
  },
];

/** Keys we store in chrome.storage.local. */
export const STORAGE_KEYS = {
  slateUrl: "slate_url",
  slateToken: "slate_token",
  lastSync: "last_sync", // Record<ServiceId, { at: string; inserted: number }>
} as const;

/**
 * Messages between popup ↔ background. All messaging goes through the
 * background worker — content scripts only talk to the background via
 * `chrome.runtime.sendMessage` and never directly to the popup.
 */
export type RuntimeMessage =
  | { type: "SYNC_SERVICE"; service: ServiceId }
  | {
      type: "SYNC_RESULT";
      service: ServiceId;
      ok: boolean;
      inserted?: number;
      unmatchedCount?: number;
      error?: string;
    }
  | { type: "SCRAPE"; service: ServiceId }
  | { type: "SCRAPE_RESULT"; service: ServiceId; rows: SlateRow[]; error?: string };

export interface LastSyncRecord {
  at: string;
  inserted: number;
  unmatchedCount: number;
}
