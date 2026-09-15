"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Mouse,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { useDiscoverTitleOverlay } from "@/components/discover-title-overlay-context";
import {
  addTitle,
  loadMorePreviews,
  syncPreviewFeedback,
} from "@/lib/actions";
import {
  neutralPreviewPreferences,
  type PreviewFeedbackPayload,
  type PreviewFeedbackStat,
  type PreviewLoadContext,
  type PreviewMediaType,
  type PreviewPreferenceWeights,
} from "@/lib/preview-feedback-types";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import type { TmdbPreviewBatch, TmdbPreviewItem } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { PreviewSlide, type SavedRecord } from "@/components/previews/preview-slide";
import { PreviewBackdrop } from "@/components/previews/preview-backdrop";
import { YouTubePreview, type YouTubePlayerHandle } from "@/components/previews/youtube-preview";
import { titleFor } from "@/lib/preview-display";

interface PreviewsFeedProps {
  items: TmdbPreviewItem[];
  attemptedKeys: string[];
  lists: { id: string; name: string }[];
  playerOrigin?: string;
  /** Opaque account id used only to keep browser learning account-scoped. */
  profileKey?: string;
  /** A server-created seed keeps the first deck and later batches coherent. */
  sessionSeed?: string;
  initialPreferences?: PreviewPreferenceWeights;
  /** Render the same feed inside the landing page, using public catalogue data. */
  publicPreview?: {
    saveHref: string;
    active: boolean;
    nextBatchIndex?: number;
    /** Let the surrounding landing section own the shared ambient artwork. */
    onBackdropChange?: (src: string | null) => void;
  };
}

async function loadPublicPreviews(exclusions: string[], context: PreviewLoadContext) {
  const query = new URLSearchParams({
    seed: context.sessionSeed,
    batch: String(context.batchIndex),
    exclude: exclusions.slice(-240).join(","),
  });
  const response = await fetch(`/api/public/previews?${query}`);
  if (!response.ok) throw new Error("Previews unavailable");
  return response.json() as Promise<TmdbPreviewBatch & {
    feedbackAccepted?: boolean;
    preferences?: PreviewPreferenceWeights;
  }>;
}

const PREVIEW_LOAD_AHEAD = 12;
const PREVIEW_MAX_RENDERED = 48;
const PREVIEW_KEEP_BEHIND = 12;
const PREVIEW_HISTORY_LIMIT = 240;
const PREVIEW_REPLAY_GAP = 36;
const PREVIEW_LOAD_RETRY_MS = 1_800;
const PREVIEW_MAX_AUTOMATIC_RETRIES = 3;
const PREVIEW_MOBILE_LANDING_LIMIT = 3;
const PREVIEW_MOBILE_QUERY = "(max-width: 767px)";
const PREVIEW_DESKTOP_HINT_KEY = "slate:previews-desktop-scroll-hint";
const PREVIEW_LEDGER_PREFIX = "slate:previews-learning:v1";
const PREVIEW_RECENT_COOKIE = "slate_preview_recent_v1";
const PREVIEW_LEDGER_LIMIT = 500;
const PREVIEW_SERVER_EXPOSURE_LIMIT = 240;
const PREVIEW_COOKIE_EXPOSURE_LIMIT = 96;
const PREVIEW_LEDGER_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1_000;
const PREVIEW_HARD_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;
const PREVIEW_SOFT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1_000;
const PREVIEW_FAST_SKIP_MS = 2_000;
const PREVIEW_MEANINGFUL_VIEW_MS = 5_000;
const PREVIEW_FEEDBACK_SYNC_THRESHOLD = 16;
const PREVIEW_SESSION_STORAGE_PREFIX = "slate:previews-session:v1";
const PREVIEW_SESSION_INACTIVITY_TTL_MS = 5 * 60 * 1_000;
const PREVIEW_ITEM_KEY_PATTERN = /^(?:movie|tv):[1-9]\d*$/;

interface PreviewExposure {
  key: string;
  lastSeenAt: number;
  viewCount: number;
  score: number;
}

interface PreviewLearningState {
  version: 1;
  exposures: PreviewExposure[];
  preferences: PreviewPreferenceWeights;
}

interface PreviewFeedSessionSnapshot {
  version: 1;
  profileKey: string;
  departedAt: number;
  items: TmdbPreviewItem[];
  attemptedKeys: string[];
  archivedItems: TmdbPreviewItem[];
  activeItemKey: string;
  batchIndex: number;
  sessionSeed: string;
  sessionId: string;
  sessionStartedAt: string;
  archiveCursor: number;
  catalogueExhausted: boolean;
  playbackEnabled: boolean;
  pausedItemKey: string | null;
  soundEnabled: boolean;
  failedVideoKeys: string[];
  savedEntries: [string, SavedRecord][];
}

// This cache makes ordinary in-app back-and-forth navigation restore before
// the first client paint. sessionStorage covers reloads in the same tab; it is
// intentionally not localStorage so closing the tab/app starts a fresh deck.
const previewFeedSessionMemory = new Map<
  string,
  PreviewFeedSessionSnapshot
>();

interface PreviewFeedbackAccumulator {
  impressions: number;
  events: PreviewFeedbackPayload["events"];
  source: Record<string, PreviewFeedbackStat>;
  genres: Record<string, PreviewFeedbackStat>;
  mediaTypes: Record<PreviewMediaType, PreviewFeedbackStat>;
  /** Batch-local deltas; the server adds these to its persisted lifetime row. */
  exposures: Map<string, PreviewFeedbackExposureDelta>;
}

interface PreviewFeedbackExposureDelta {
  key: string;
  lastSeenAt: number;
  viewCount: number;
  score: number;
}

function clampPreference(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function safePreference(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampPreference(value)
    : 0;
}

function normalizePreferences(
  preferences?: Partial<PreviewPreferenceWeights> | null,
): PreviewPreferenceWeights {
  const genres = Object.fromEntries(
    Object.entries(preferences?.genre ?? {})
      .filter(([genre]) => /^[1-9]\d{0,5}$/.test(genre))
      .map(([genre, value]) => [genre, safePreference(value)] as const)
      .filter(([, value]) => value !== 0)
      .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
      .slice(0, 32),
  );
  return {
    source: {
      library: safePreference(preferences?.source?.library),
      trending: safePreference(preferences?.source?.trending),
      now_playing: safePreference(preferences?.source?.now_playing),
    },
    genre: genres,
    mediaType: {
      movie: safePreference(preferences?.mediaType?.movie),
      tv: safePreference(preferences?.mediaType?.tv),
    },
  };
}

function mergePreferences(
  serverPreferences?: PreviewPreferenceWeights,
  localPreferences?: PreviewPreferenceWeights,
) {
  const server = normalizePreferences(serverPreferences);
  const local = normalizePreferences(localPreferences);
  if (!preferencesHaveSignal(local)) return server;
  if (!preferencesHaveSignal(server)) return local;
  const genreKeys = new Set([
    ...Object.keys(server.genre),
    ...Object.keys(local.genre),
  ]);
  const genre: Record<string, number> = {};
  for (const key of genreKeys) {
    genre[key] = clampPreference(
      (server.genre[key] ?? 0) * 0.6 + (local.genre[key] ?? 0) * 0.4,
    );
  }
  return normalizePreferences({
    source: {
      library: clampPreference(
        server.source.library * 0.6 + local.source.library * 0.4,
      ),
      trending: clampPreference(
        server.source.trending * 0.6 + local.source.trending * 0.4,
      ),
      now_playing: clampPreference(
        server.source.now_playing * 0.6 + local.source.now_playing * 0.4,
      ),
    },
    genre,
    mediaType: {
      movie: clampPreference(
        server.mediaType.movie * 0.6 + local.mediaType.movie * 0.4,
      ),
      tv: clampPreference(
        server.mediaType.tv * 0.6 + local.mediaType.tv * 0.4,
      ),
    },
  } satisfies PreviewPreferenceWeights);
}

function newFeedbackAccumulator(): PreviewFeedbackAccumulator {
  return {
    impressions: 0,
    events: {
      meaningfulViews: 0,
      fastSkips: 0,
      unmutes: 0,
      details: 0,
      saves: 0,
      listIntents: 0,
    },
    source: {},
    genres: {},
    mediaTypes: {
      movie: { views: 0, score: 0 },
      tv: { views: 0, score: 0 },
    },
    exposures: new Map(),
  };
}

function feedbackMetric(
  metrics: Record<string, PreviewFeedbackStat>,
  key: string,
) {
  return (metrics[key] ??= { views: 0, score: 0 });
}

function boundedFeedbackStat(
  stat: PreviewFeedbackStat | undefined,
): PreviewFeedbackStat {
  const views = Math.max(0, Math.min(2_000, Math.trunc(stat?.views ?? 0)));
  return {
    views,
    score: Math.max(-views, Math.min(views, stat?.score ?? 0)),
  };
}

function preferencesHaveSignal(preferences: PreviewPreferenceWeights) {
  return (
    Object.values(preferences.source).some((value) => value !== 0) ||
    Object.values(preferences.genre).some((value) => value !== 0) ||
    Object.values(preferences.mediaType).some((value) => value !== 0)
  );
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string) {
  return hashString(seed) / 4_294_967_295;
}

function sanitizeExposure(value: unknown): PreviewExposure | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PreviewExposure>;
  if (
    typeof candidate.key !== "string" ||
    !/^(?:movie|tv):[1-9]\d*$/.test(candidate.key) ||
    typeof candidate.lastSeenAt !== "number" ||
    !Number.isFinite(candidate.lastSeenAt)
  ) {
    return null;
  }
  return {
    key: candidate.key,
    lastSeenAt: candidate.lastSeenAt,
    viewCount: Math.max(1, Math.min(10_000, Number(candidate.viewCount) || 1)),
    score: Math.max(-20, Math.min(20, Number(candidate.score) || 0)),
  };
}

function readLearningState(storageKey: string): PreviewLearningState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as
      | Partial<PreviewLearningState>
      | null;
    const cutoff = Date.now() - PREVIEW_LEDGER_MAX_AGE_MS;
    const exposures = Array.isArray(parsed?.exposures)
      ? parsed.exposures
          .map(sanitizeExposure)
          .filter(
            (entry): entry is PreviewExposure =>
              Boolean(entry && entry.lastSeenAt >= cutoff),
          )
          .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
          .slice(0, PREVIEW_LEDGER_LIMIT)
      : [];
    return {
      version: 1,
      exposures,
      preferences: normalizePreferences(parsed?.preferences),
    };
  } catch {
    return {
      version: 1,
      exposures: [],
      preferences: neutralPreviewPreferences(),
    };
  }
}

function writeRecentCookie(profileKey: string, exposures: PreviewExposure[]) {
  const hardCooldownCutoff = Date.now() - PREVIEW_HARD_COOLDOWN_MS;
  const keys = exposures
    .filter((entry) => entry.lastSeenAt >= hardCooldownCutoff)
    .slice()
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, PREVIEW_COOKIE_EXPOSURE_LIMIT)
    .map((entry) => entry.key);
  const value = encodeURIComponent(
    JSON.stringify({ version: 1, profileKey, keys }),
  );
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PREVIEW_RECENT_COOKIE}=${value}; Max-Age=7776000; Path=/previews; SameSite=Lax${secure}`;
}

interface KeyHistory {
  order: string[];
  keys: Set<string>;
}

function rememberHistoryKeys(history: KeyHistory, keys: readonly string[]) {
  for (const key of keys) {
    if (history.keys.has(key)) {
      const previousIndex = history.order.indexOf(key);
      if (previousIndex >= 0) history.order.splice(previousIndex, 1);
    } else {
      history.keys.add(key);
    }
    history.order.push(key);
  }
  while (history.order.length > PREVIEW_HISTORY_LIMIT) {
    const expired = history.order.shift();
    if (expired) history.keys.delete(expired);
  }
}

function createKeyHistory(keys: readonly string[]): KeyHistory {
  const history: KeyHistory = { order: [], keys: new Set() };
  rememberHistoryKeys(history, keys);
  return history;
}

function rememberArchiveItems(
  archive: Map<string, TmdbPreviewItem>,
  items: readonly TmdbPreviewItem[],
) {
  for (const item of items) {
    const key = itemKey(item);
    archive.delete(key);
    archive.set(key, item);
  }
  while (archive.size > PREVIEW_HISTORY_LIMIT) {
    const oldestKey = archive.keys().next().value;
    if (typeof oldestKey !== "string") break;
    archive.delete(oldestKey);
  }
}

// TMDB's stable genre IDs. Kept client-local so the feed never imports the
// server-only AI search module simply to render one concise genre label.
function itemKey(item: Pick<TmdbPreviewItem, "id" | "media_type">) {
  return `${item.media_type}:${item.id}`;
}

function itemKeyAt(items: readonly TmdbPreviewItem[], index: number) {
  const item = items[index];
  return item ? itemKey(item) : null;
}

function previewSessionStorageKey(profileKey: string) {
  return `${PREVIEW_SESSION_STORAGE_PREFIX}:${encodeURIComponent(profileKey)}`;
}

function isPreviewItem(value: unknown): value is TmdbPreviewItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TmdbPreviewItem>;
  return (
    typeof item.id === "number" &&
    Number.isInteger(item.id) &&
    item.id > 0 &&
    (item.media_type === "movie" || item.media_type === "tv") &&
    (item.source === "library" ||
      item.source === "trending" ||
      item.source === "now_playing") &&
    typeof item.videoKey === "string" &&
    item.videoKey.length > 0
  );
}

function normalizePreviewSession(
  value: unknown,
  profileKey: string,
): PreviewFeedSessionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PreviewFeedSessionSnapshot>;
  const departedAt = candidate.departedAt;
  if (
    candidate.version !== 1 ||
    candidate.profileKey !== profileKey ||
    typeof departedAt !== "number" ||
    !Number.isFinite(departedAt) ||
    departedAt > Date.now() + 60_000 ||
    Date.now() - departedAt > PREVIEW_SESSION_INACTIVITY_TTL_MS ||
    !Array.isArray(candidate.items)
  ) {
    return null;
  }

  const seenItems = new Set<string>();
  const items = candidate.items
    .filter(isPreviewItem)
    .filter((item) => {
      const key = itemKey(item);
      if (seenItems.has(key)) return false;
      seenItems.add(key);
      return true;
    })
    .slice(0, PREVIEW_MAX_RENDERED);
  if (items.length === 0) return null;

  const attemptedKeys = Array.isArray(candidate.attemptedKeys)
    ? candidate.attemptedKeys
        .filter(
          (key): key is string =>
            typeof key === "string" && PREVIEW_ITEM_KEY_PATTERN.test(key),
        )
        .slice(-PREVIEW_HISTORY_LIMIT)
    : [];
  const seenArchive = new Set<string>();
  const archivedItems = Array.isArray(candidate.archivedItems)
    ? candidate.archivedItems
        .filter(isPreviewItem)
        .filter((item) => {
          const key = itemKey(item);
          if (seenArchive.has(key)) return false;
          seenArchive.add(key);
          return true;
        })
        .slice(-PREVIEW_HISTORY_LIMIT)
    : items;
  const savedEntries: [string, SavedRecord][] = Array.isArray(
    candidate.savedEntries,
  )
    ? candidate.savedEntries
        .filter((entry): entry is [string, SavedRecord] => {
          if (!Array.isArray(entry) || entry.length !== 2) return false;
          const [key, record] = entry;
          return (
            typeof key === "string" &&
            PREVIEW_ITEM_KEY_PATTERN.test(key) &&
            Boolean(record) &&
            typeof record === "object" &&
            typeof record.id === "string" &&
            (record.status === "want" ||
              record.status === "watching" ||
              record.status === "watched" ||
              record.status === "dropped")
          );
        })
        .slice(-PREVIEW_HISTORY_LIMIT)
    : [];
  const queueKeys = new Set(items.map(itemKey));
  const requestedActiveKey =
    typeof candidate.activeItemKey === "string"
      ? candidate.activeItemKey
      : "";
  const activeItemKey = queueKeys.has(requestedActiveKey)
    ? requestedActiveKey
    : itemKey(items[0]);

  return {
    version: 1,
    profileKey,
    departedAt,
    items,
    attemptedKeys: [...new Set([...attemptedKeys, ...items.map(itemKey)])],
    archivedItems: archivedItems.length > 0 ? archivedItems : items,
    activeItemKey,
    batchIndex:
      typeof candidate.batchIndex === "number" &&
      Number.isInteger(candidate.batchIndex)
        ? Math.max(1, Math.min(10_000, candidate.batchIndex))
        : 1,
    sessionSeed:
      typeof candidate.sessionSeed === "string" ? candidate.sessionSeed : "",
    sessionId:
      typeof candidate.sessionId === "string" ? candidate.sessionId : "",
    sessionStartedAt:
      typeof candidate.sessionStartedAt === "string"
        ? candidate.sessionStartedAt
        : new Date(departedAt).toISOString(),
    archiveCursor:
      typeof candidate.archiveCursor === "number" &&
      Number.isInteger(candidate.archiveCursor)
        ? Math.max(0, candidate.archiveCursor)
        : 0,
    catalogueExhausted: candidate.catalogueExhausted === true,
    playbackEnabled: candidate.playbackEnabled === true,
    pausedItemKey:
      typeof candidate.pausedItemKey === "string" &&
      queueKeys.has(candidate.pausedItemKey)
        ? candidate.pausedItemKey
        : null,
    soundEnabled: candidate.soundEnabled !== false,
    failedVideoKeys: Array.isArray(candidate.failedVideoKeys)
      ? candidate.failedVideoKeys
          .filter(
            (key): key is string =>
              typeof key === "string" && key.length > 0 && key.length <= 128,
          )
          .slice(-PREVIEW_HISTORY_LIMIT)
      : [],
    savedEntries,
  };
}

function readInMemoryPreviewSession(profileKey: string) {
  if (typeof window === "undefined") return null;
  const snapshot = normalizePreviewSession(
    previewFeedSessionMemory.get(profileKey),
    profileKey,
  );
  if (!snapshot) previewFeedSessionMemory.delete(profileKey);
  return snapshot;
}

function readStoredPreviewSession(profileKey: string) {
  if (typeof window === "undefined") return null;
  const storageKey = previewSessionStorageKey(profileKey);
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const snapshot = raw
      ? normalizePreviewSession(JSON.parse(raw), profileKey)
      : null;
    if (!snapshot && raw) window.sessionStorage.removeItem(storageKey);
    return snapshot;
  } catch {
    // Some private-browsing configurations disable sessionStorage. The
    // in-memory snapshot still preserves ordinary client-side navigation.
    return null;
  }
}

function writePreviewSession(snapshot: PreviewFeedSessionSnapshot) {
  if (typeof window === "undefined") return;
  previewFeedSessionMemory.set(snapshot.profileKey, snapshot);
  try {
    window.sessionStorage.setItem(
      previewSessionStorageKey(snapshot.profileKey),
      JSON.stringify(snapshot),
    );
  } catch {
    // The bounded in-memory copy remains available if storage is unavailable
    // or the browser has an unusually small per-tab quota.
  }
}

function exposurePenalty(item: TmdbPreviewItem, exposure?: PreviewExposure) {
  if (!exposure) return item.recentlyExposed ? 4 : 0;
  const age = Math.max(0, Date.now() - exposure.lastSeenAt);
  if (age <= PREVIEW_HARD_COOLDOWN_MS) return 4;
  if (age >= PREVIEW_SOFT_COOLDOWN_MS) return 0;
  return (
    1.4 *
    (1 -
      (age - PREVIEW_HARD_COOLDOWN_MS) /
        (PREVIEW_SOFT_COOLDOWN_MS - PREVIEW_HARD_COOLDOWN_MS))
  );
}

function preferenceScore(
  item: TmdbPreviewItem,
  preferences: PreviewPreferenceWeights,
) {
  const genreIds = item.genre_ids?.slice(0, 3) ?? [];
  const genreScore =
    genreIds.length > 0
      ? genreIds.reduce(
          (sum, genreId) => sum + (preferences.genre[String(genreId)] ?? 0),
          0,
        ) / genreIds.length
      : 0;
  return (
    preferences.source[item.source] * 0.48 +
    preferences.mediaType[item.media_type] * 0.22 +
    genreScore * 0.3
  );
}

/**
 * A small client-side MMR pass adapts only unseen cards. The next three stay
 * fixed, which lets learning react during the session without moving a target
 * out from under a swipe or keyboard action.
 */
function rankPreviewItems(
  candidates: TmdbPreviewItem[],
  precedingItems: TmdbPreviewItem[],
  preferences: PreviewPreferenceWeights,
  exposures: Map<string, PreviewExposure>,
  seed: string,
) {
  const remaining = [...candidates];
  const selected: TmdbPreviewItem[] = [];

  while (remaining.length > 0) {
    const context = [...precedingItems.slice(-4), ...selected.slice(-4)];
    let winningIndex = 0;
    let winningScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const key = itemKey(item);
      const last = context.at(-1);
      const sameSourceCount = context.filter(
        (candidate) => candidate.source === item.source,
      ).length;
      const sameMediaCount = context.filter(
        (candidate) => candidate.media_type === item.media_type,
      ).length;
      const primaryGenreId = item.genre_ids?.[0];
      const sameGenreCount = primaryGenreId
        ? context.filter(
            (candidate) => candidate.genre_ids?.[0] === primaryGenreId,
          ).length
        : 0;
      const relevance = preferenceScore(item, preferences);
      const exploration = seededUnit(`${seed}:${key}`) * 0.42;
      const ratingConfidence = Math.min(
        0.18,
        Math.max(0, ((item.vote_average ?? 0) - 6) / 20),
      );
      const redundancy =
        sameSourceCount * 0.14 +
        sameGenreCount * 0.2 +
        Math.max(0, sameMediaCount - 2) * 0.12 +
        (last?.source === item.source ? 0.08 : 0);
      const score =
        relevance +
        exploration +
        ratingConfidence -
        redundancy -
        exposurePenalty(item, exposures.get(key));

      if (score > winningScore) {
        winningIndex = index;
        winningScore = score;
      }
    }

    selected.push(remaining.splice(winningIndex, 1)[0]);
  }

  return selected;
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function subscribeToMobileViewport(onChange: () => void) {
  const query = window.matchMedia(PREVIEW_MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(PREVIEW_MOBILE_QUERY).matches;
}

function getServerMobileViewportSnapshot() {
  return false;
}

function useMobileViewport() {
  return React.useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getServerMobileViewportSnapshot,
  );
}

function useDesktopScrollHint() {
  const [visible, setVisible] = React.useState(false);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    try {
      window.sessionStorage.setItem(PREVIEW_DESKTOP_HINT_KEY, "seen");
    } catch {
      // Private browsing can make sessionStorage unavailable. The hint still
      // works for the current render and simply returns next time.
    }
  }, []);

  React.useEffect(() => {
    const finePointer = window.matchMedia(
      "(min-width: 64rem) and (hover: hover) and (pointer: fine)",
    );
    let alreadySeen = false;
    try {
      alreadySeen =
        window.sessionStorage.getItem(PREVIEW_DESKTOP_HINT_KEY) === "seen";
    } catch {
      // See the storage note in dismiss().
    }
    if (!finePointer.matches || alreadySeen) return;

    const frame = window.requestAnimationFrame(() => setVisible(true));
    const timer = window.setTimeout(dismiss, 6_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [dismiss]);

  return { dismiss, visible };
}

function useBlockingOverlayOpen() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const selector = [
      ".smart-search-inline-results",
      '[role="dialog"][data-state="open"]',
      '[role="menu"][data-state="open"]',
    ].join(",");
    const update = () => setOpen(Boolean(document.querySelector(selector)));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => observer.disconnect();
  }, []);

  return open;
}

function useAvailableFeedHeight(hostRef: React.RefObject<HTMLDivElement | null>, embedded = false) {
  const [height, setHeight] = React.useState<number | null>(null);
  const [usableHeight, setUsableHeight] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const parentRect = host.parentElement?.getBoundingClientRect();
        // The app shell uses a stable small-viewport-height track on phones.
        // Measure that track instead of visualViewport: mobile Safari moves
        // and resizes the visual viewport while its chrome collapses, which
        // otherwise changes every snap point underneath an active gesture.
        // At md+ the shell becomes document-flow layout, so its parent height
        // is no longer a reliable viewport boundary; keep the immersive feed
        // pinned to the layout viewport there.
        const useStableAppTrack = window.matchMedia(
          "(max-width: 767px)",
        ).matches;
        const nextHeight = Math.max(
          0,
          Math.floor(
            (embedded || useStableAppTrack) && parentRect && parentRect.height > 0
              ? (embedded ? host.parentElement!.clientHeight : parentRect.height)
              : document.documentElement.clientHeight - rect.top,
          ),
        );
        const hostBottom = rect.top + nextHeight;
        const dock = embedded ? null : document.getElementById("app-bottom-nav");
        const dockRect = dock?.getBoundingClientRect();
        const dockIsVisible = Boolean(
          dockRect && dockRect.height > 0 && dockRect.top > rect.top,
        );
        const dockClearance = dockIsVisible
          ? Math.max(8, hostBottom - dockRect!.top + 8)
          : 12;
        // The preview artwork is the page background, so let it continue all
        // the way behind the floating dock. Each slide reserves its own
        // interactive clearance; clipping the host at dock.top created the
        // full-width black shelf visible beneath the feed.
        host.style.setProperty(
          "--preview-dock-clearance",
          `${Math.ceil(dockClearance)}px`,
        );
        setHeight(nextHeight);
        setUsableHeight(
          Math.max(0, nextHeight - Math.ceil(dockClearance)),
        );
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (host.parentElement) observer.observe(host.parentElement);
    const dock = document.getElementById("app-bottom-nav");
    if (dock) observer.observe(dock);
    window.addEventListener("resize", measure);
    window.addEventListener("slate:demo-banner-dismiss", measure);
    window.visualViewport?.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("slate:demo-banner-dismiss", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [hostRef, embedded]);

  return { height, usableHeight };
}

function useFloatingPlayerGeometry({
  hostRef,
  scrollerRef,
  playerShellRef,
  desktopNavigationRef,
  activeIndex,
  navigationIndex,
  visible,
  frameHeight,
  capturePlayerGestures = false,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  playerShellRef: React.RefObject<HTMLDivElement | null>;
  desktopNavigationRef: React.RefObject<HTMLDivElement | null>;
  activeIndex: number | null;
  navigationIndex: number;
  visible: boolean;
  frameHeight: number | null;
  capturePlayerGestures?: boolean;
}) {
  React.useLayoutEffect(() => {
    const host = hostRef.current;
    const scroller = scrollerRef.current;
    const shell = playerShellRef.current;
    const desktopNavigation = desktopNavigationRef.current;
    if (!host || !scroller || !shell) return;
    const interactivePlayer = window.matchMedia(
      "(min-width: 48rem) and (hover: hover) and (pointer: fine)",
    );
    let frame = 0;

    const update = () => {
      frame = 0;
      const target =
        activeIndex == null
          ? null
          : scroller.querySelector<HTMLElement>(
              `[data-preview-player-index="${activeIndex}"]`,
            );
      const navigationTarget = scroller.querySelector<HTMLElement>(
        `[data-preview-player-index="${navigationIndex}"]`,
      );
      const hostRect = host.getBoundingClientRect();
      // The landing section scales as it enters. Convert viewport geometry
      // back to local coordinates so the shared iframe is scaled only once.
      const scaleX = hostRect.width / (host.offsetWidth || 1) || 1;
      const scaleY = hostRect.height / (host.offsetHeight || 1) || 1;
      const hostHeight = hostRect.height / scaleY;

      if (desktopNavigation) {
        if (!navigationTarget) {
          desktopNavigation.style.visibility = "hidden";
        } else {
          const targetRect = navigationTarget.getBoundingClientRect();
          const navigationBounds = capturePlayerGestures
            ? scroller.getBoundingClientRect()
            : hostRect;
          const navigationWidth = desktopNavigation.offsetWidth;
          const navigationHeight = desktopNavigation.offsetHeight;
          const navigationGap = 8;
          const rightRoom = (navigationBounds.right - targetRect.right) / scaleX;
          const leftRoom = (targetRect.left - navigationBounds.left) / scaleX;
          let navigationLeft: number | null = null;

          if (rightRoom >= navigationWidth + navigationGap) {
            navigationLeft =
              (targetRect.right - hostRect.left) / scaleX + navigationGap;
          } else if (leftRoom >= navigationWidth + navigationGap) {
            navigationLeft =
              (targetRect.left - hostRect.left) / scaleX - navigationWidth - navigationGap;
          }

          // Compact desktop layouts still need an explicit navigation option
          // when there is no ambient space beside the video.
          const compactNavigation = capturePlayerGestures && navigationLeft == null;
          if (compactNavigation) {
            navigationLeft = (navigationBounds.right - hostRect.left) / scaleX - navigationWidth - 12;
          }

          if (navigationLeft == null) {
            desktopNavigation.style.visibility = "hidden";
          } else {
            // Keep the desktop controls still while the snap surface moves
            // beneath them. Following the outgoing slide during wheel travel
            // makes the controls drift, then jump when the next slide wins.
            const navigationTop = compactNavigation ? 12 : Math.max(
              12,
              Math.min(
                hostHeight - navigationHeight - 12,
                hostHeight * 0.4 - navigationHeight / 2,
              ),
            );
            desktopNavigation.style.transform = `translate3d(${navigationLeft}px, ${navigationTop}px, 0)`;
            desktopNavigation.style.visibility = "visible";
          }
        }
      }

      if (!visible || !target) {
        shell.style.opacity = "0";
        shell.style.pointerEvents = "none";
        shell.style.visibility = "hidden";
        return;
      }
      const targetRect = target.getBoundingClientRect();
      shell.style.width = `${targetRect.width / scaleX}px`;
      shell.style.height = `${targetRect.height / scaleY}px`;
      shell.style.transform = `translate3d(${(targetRect.left - hostRect.left) / scaleX}px, ${(targetRect.top - hostRect.top) / scaleY}px, 0)`;
      shell.style.opacity = "1";
      // A cross-origin iframe consumes touch gestures before the snapping feed
      // can see them. On touch-first devices Slate's controls live below the
      // player, so let the full trailer frame remain a reliable swipe surface.
      // The embedded landing feed also needs wheel/trackpad gestures over the
      // video itself. Its Slate controls handle play, pause, and sound.
      shell.style.pointerEvents =
        !capturePlayerGestures && interactivePlayer.matches ? "auto" : "none";
      shell.style.visibility = "visible";
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    if (desktopNavigation) observer.observe(desktopNavigation);
    if (activeIndex != null) {
      const target = scroller.querySelector<HTMLElement>(
        `[data-preview-player-index="${activeIndex}"]`,
      );
      if (target) observer.observe(target);
    }
    const navigationTarget = scroller.querySelector<HTMLElement>(
      `[data-preview-player-index="${navigationIndex}"]`,
    );
    if (navigationTarget) observer.observe(navigationTarget);
    scroller.addEventListener("scroll", schedule, { passive: true });
    interactivePlayer.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener("scroll", schedule);
      interactivePlayer.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [
    activeIndex,
    desktopNavigationRef,
    frameHeight,
    hostRef,
    navigationIndex,
    playerShellRef,
    scrollerRef,
    visible,
    capturePlayerGestures,
  ]);
}

export function PreviewsFeed({
  items: initialItems,
  attemptedKeys: initialAttemptedKeys,
  lists,
  playerOrigin,
  profileKey = "local",
  sessionSeed: initialSessionSeed,
  initialPreferences,
  publicPreview,
}: PreviewsFeedProps) {
  const isPublicPreview = Boolean(publicPreview);
  const isMobileViewport = useMobileViewport();
  const finitePreviewLimit = isPublicPreview && isMobileViewport
    ? PREVIEW_MOBILE_LANDING_LIMIT
    : null;
  const finitePreviewLimitRef = React.useRef(finitePreviewLimit);
  React.useLayoutEffect(() => {
    finitePreviewLimitRef.current = finitePreviewLimit;
  }, [finitePreviewLimit]);
  const surfaceActive = publicPreview?.active ?? true;
  const overlay = useDiscoverTitleOverlay();
  const [memorySession] = React.useState(() =>
    isPublicPreview ? null : readInMemoryPreviewSession(profileKey),
  );
  const initialFeedItems = memorySession?.items ?? initialItems;
  const initialActiveIndex = memorySession
    ? Math.max(
        0,
        initialFeedItems.findIndex(
          (item) => itemKey(item) === memorySession.activeItemKey,
        ),
      )
    : 0;
  const [items, setItems] = React.useState(initialFeedItems);
  // Keep the randomized backing deck intact when a phone rotates or the
  // viewport widens. Only the mobile landing surface has a finite boundary.
  const visibleItems = React.useMemo(
    () => finitePreviewLimit === null ? items : items.slice(0, finitePreviewLimit),
    [finitePreviewLimit, items],
  );
  const hostRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const playerShellRef = React.useRef<HTMLDivElement>(null);
  const desktopNavigationRef = React.useRef<HTMLDivElement>(null);
  const youtubePlayerRef = React.useRef<YouTubePlayerHandle>(null);
  const audibleAutoplayFallbackAttemptedRef = React.useRef(false);
  const itemsRef = React.useRef(items);
  const activeIndexRef = React.useRef(initialActiveIndex);
  const lastPlaybackItemKeyRef = React.useRef(
    itemKeyAt(initialFeedItems, initialActiveIndex),
  );
  const attemptedHistoryRef = React.useRef<KeyHistory | null>(null);
  const playableArchiveRef = React.useRef<Map<string, TmdbPreviewItem> | null>(
    null,
  );
  const archiveCursorRef = React.useRef(memorySession?.archiveCursor ?? 0);
  const catalogueExhaustedRef = React.useRef(
    memorySession?.catalogueExhausted ?? false,
  );
  const loadingMoreRef = React.useRef(false);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFailureCountRef = React.useRef(0);
  const pendingScrollTopRef = React.useRef<number | null>(null);
  const restoreScrollItemKeyRef = React.useRef(
    memorySession?.activeItemKey ?? null,
  );
  const restoredSessionRef = React.useRef<PreviewFeedSessionSnapshot | null>(
    memorySession,
  );
  const skipInitialRerankRef = React.useRef(Boolean(memorySession));
  const sessionSeedRef = React.useRef(
    memorySession?.sessionSeed || initialSessionSeed || "",
  );
  const sessionIdRef = React.useRef(
    memorySession?.sessionId || initialSessionSeed || "",
  );
  const sessionStartedAtRef = React.useRef(
    memorySession?.sessionStartedAt || new Date().toISOString(),
  );
  // The server-rendered opening deck owns batch zero.
  const batchIndexRef = React.useRef(memorySession?.batchIndex ?? publicPreview?.nextBatchIndex ?? 1);
  const exposureLedgerRef = React.useRef(new Map<string, PreviewExposure>());
  const preferencesRef = React.useRef(
    normalizePreferences(initialPreferences),
  );
  const feedbackRef = React.useRef<PreviewFeedbackAccumulator>(
    newFeedbackAccumulator(),
  );
  // In-flight is separate from the one optional dedicated request. Successful
  // load-more piggybacks may keep draining later aggregates at no added
  // Function invocation cost.
  const feedbackSyncStartedRef = React.useRef(false);
  const feedbackDedicatedSyncUsedRef = React.useRef(false);
  const pendingFeedbackPayloadRef = React.useRef<PreviewFeedbackPayload | null>(
    null,
  );
  const activeVisitRef = React.useRef<{
    item: TmdbPreviewItem;
    startedAt: number;
  } | null>(null);
  const signalledKeysRef = React.useRef(new Set<string>());
  const persistenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const rerankTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollIdleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scrollInProgressRef = React.useRef(false);
  const rerankRequestedRef = React.useRef(false);
  const rerankFutureRef = React.useRef<() => void>(() => undefined);
  const syncRemainingFeedbackRef = React.useRef<() => void>(() => undefined);
  const learningReadyRef = React.useRef(false);
  const learningStorageKey = React.useMemo(
    () => `${PREVIEW_LEDGER_PREFIX}:${encodeURIComponent(profileKey)}`,
    [profileKey],
  );
  // Tail reranks preserve membership. Key the observer by the set instead of
  // array order so moving unseen cards never disconnects every target.
  const observedItemMembership = React.useMemo(
    () => visibleItems.map(itemKey).sort().join("|"),
    [visibleItems],
  );
  if (!attemptedHistoryRef.current) {
    attemptedHistoryRef.current = createKeyHistory([
      ...(memorySession?.attemptedKeys ?? initialAttemptedKeys),
      ...initialFeedItems.map(itemKey),
    ]);
  }
  if (!playableArchiveRef.current) {
    playableArchiveRef.current = new Map();
    rememberArchiveItems(
      playableArchiveRef.current,
      memorySession?.archivedItems ?? initialFeedItems,
    );
  }
  const { height: frameHeight, usableHeight: usableFrameHeight } =
    useAvailableFeedHeight(hostRef, isPublicPreview);
  const reducedMotion = useReducedMotion();
  const {
    dismiss: dismissDesktopScrollHint,
    visible: desktopScrollHintVisible,
  } = useDesktopScrollHint();
  const blockingOverlayOpen = useBlockingOverlayOpen();
  const [activeIndex, setActiveIndex] = React.useState(initialActiveIndex);
  const [activePlayerIndex, setActivePlayerIndex] = React.useState<
    number | null
  >(null);
  const [pageVisible, setPageVisible] = React.useState(true);
  const initialItemPaused =
    memorySession?.pausedItemKey ===
    itemKeyAt(initialFeedItems, initialActiveIndex);
  const [playbackEnabled, setPlaybackEnabled] = React.useState(
    initialItemPaused ? false : (memorySession?.playbackEnabled ?? false),
  );
  const playbackEnabledRef = React.useRef(playbackEnabled);
  const pausedItemKeyRef = React.useRef(memorySession?.pausedItemKey ?? null);
  const automaticPlaybackAllowedRef = React.useRef(false);
  const [soundEnabled, setSoundEnabled] = React.useState(
    memorySession?.soundEnabled ?? !isPublicPreview,
  );
  const soundEnabledRef = React.useRef(soundEnabled);
  const [playerReady, setPlayerReady] = React.useState(false);
  const [playerCanPlay, setPlayerCanPlay] = React.useState(false);
  const [visibleVideoKey, setVisibleVideoKey] = React.useState<string | null>(
    null,
  );
  const [failedVideoKeys, setFailedVideoKeys] = React.useState<Set<string>>(
    () => new Set(memorySession?.failedVideoKeys ?? []),
  );
  const failedVideoKeysRef = React.useRef(
    new Set(memorySession?.failedVideoKeys ?? []),
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loadRevision, setLoadRevision] = React.useState(0);
  const [saved, setSaved] = React.useState<Map<string, SavedRecord>>(
    () => new Map(memorySession?.savedEntries ?? []),
  );
  const savedRef = React.useRef(saved);
  const pendingSaves = React.useRef(new Map<string, Promise<string>>());
  const visibleActiveIndex = Math.max(0, Math.min(activeIndex, visibleItems.length - 1));
  const playbackIndex = Math.max(0, Math.min(
    activePlayerIndex ?? visibleActiveIndex,
    visibleItems.length - 1,
  ));
  const playbackItem = visibleItems[playbackIndex] ?? null;
  const playbackFailed = Boolean(
    playbackItem && failedVideoKeys.has(playbackItem.videoKey),
  );
  const playerShellVisible = Boolean(
    playbackItem &&
      !playbackFailed &&
      activePlayerIndex != null &&
      pageVisible &&
      surfaceActive &&
      !menuOpen &&
      !blockingOverlayOpen &&
      !overlay?.hasSelection &&
      visibleVideoKey === playbackItem.videoKey,
  );
  const playerShouldPlay = Boolean(
    playerShellVisible && playerCanPlay && playbackEnabled,
  );

  // A normal client transition is restored from module memory during render.
  // A same-tab reload can only read sessionStorage after hydration, so apply
  // that snapshot in a layout effect before the restored slide is painted.
  React.useLayoutEffect(() => {
    if (isPublicPreview) return;
    if (restoredSessionRef.current) return;
    const snapshot = readStoredPreviewSession(profileKey);
    if (!snapshot) return;

    const nextActiveIndex = Math.max(
      0,
      snapshot.items.findIndex(
        (item) => itemKey(item) === snapshot.activeItemKey,
      ),
    );
    restoredSessionRef.current = snapshot;
    skipInitialRerankRef.current = true;
    restoreScrollItemKeyRef.current = snapshot.activeItemKey;
    sessionSeedRef.current = snapshot.sessionSeed || sessionSeedRef.current;
    sessionIdRef.current = snapshot.sessionId || sessionIdRef.current;
    sessionStartedAtRef.current = snapshot.sessionStartedAt;
    batchIndexRef.current = snapshot.batchIndex;
    archiveCursorRef.current = snapshot.archiveCursor;
    catalogueExhaustedRef.current = snapshot.catalogueExhausted;
    attemptedHistoryRef.current = createKeyHistory(snapshot.attemptedKeys);
    playableArchiveRef.current = new Map();
    rememberArchiveItems(
      playableArchiveRef.current,
      snapshot.archivedItems,
    );

    const nextFailedVideoKeys = new Set(snapshot.failedVideoKeys);
    const nextSaved = new Map(snapshot.savedEntries);
    itemsRef.current = snapshot.items;
    activeIndexRef.current = nextActiveIndex;
    failedVideoKeysRef.current = nextFailedVideoKeys;
    savedRef.current = nextSaved;
    pausedItemKeyRef.current = snapshot.pausedItemKey;
    playbackEnabledRef.current = snapshot.pausedItemKey === snapshot.activeItemKey
      ? false
      : snapshot.playbackEnabled;
    soundEnabledRef.current = snapshot.soundEnabled;
    setItems(snapshot.items);
    setActiveIndex(nextActiveIndex);
    setActivePlayerIndex(null);
    setFailedVideoKeys(nextFailedVideoKeys);
    setSaved(nextSaved);
    setPlaybackEnabled(
      snapshot.pausedItemKey === snapshot.activeItemKey
        ? false
        : snapshot.playbackEnabled,
    );
    setSoundEnabled(snapshot.soundEnabled);
  }, [profileKey, isPublicPreview]);

  const persistPreviewSession = React.useCallback(() => {
    if (isPublicPreview) return;
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) return;
    const currentIndex = Math.max(
      0,
      Math.min(currentItems.length - 1, activeIndexRef.current),
    );
    const activeItem = currentItems[currentIndex] ?? currentItems[0];
    const attemptedHistory = attemptedHistoryRef.current;
    const archive = playableArchiveRef.current;
    writePreviewSession({
      version: 1,
      profileKey,
      // This is deliberately stamped only at a route/app departure, rather
      // than extended by background timers while somebody is still browsing.
      departedAt: Date.now(),
      items: currentItems,
      attemptedKeys:
        attemptedHistory?.order ?? currentItems.map((item) => itemKey(item)),
      archivedItems: archive ? Array.from(archive.values()) : currentItems,
      activeItemKey: itemKey(activeItem),
      batchIndex: batchIndexRef.current,
      sessionSeed: sessionSeedRef.current,
      sessionId: sessionIdRef.current,
      sessionStartedAt: sessionStartedAtRef.current,
      archiveCursor: archiveCursorRef.current,
      catalogueExhausted: catalogueExhaustedRef.current,
      playbackEnabled: playbackEnabledRef.current,
      pausedItemKey: pausedItemKeyRef.current,
      soundEnabled: soundEnabledRef.current,
      failedVideoKeys: Array.from(failedVideoKeysRef.current),
      savedEntries: Array.from(savedRef.current.entries()),
    });
  }, [profileKey, isPublicPreview]);

  const persistPreviewSessionRef = React.useRef(persistPreviewSession);
  React.useEffect(() => {
    persistPreviewSessionRef.current = persistPreviewSession;
  }, [persistPreviewSession]);

  React.useEffect(
    () => () => {
      persistPreviewSessionRef.current();
    },
    [],
  );

  const persistLearningNow = React.useCallback(() => {
    if (isPublicPreview) return;
    if (!learningReadyRef.current) return;
    const exposures = Array.from(exposureLedgerRef.current.values())
      .filter(
        (entry) => entry.lastSeenAt >= Date.now() - PREVIEW_LEDGER_MAX_AGE_MS,
      )
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, PREVIEW_LEDGER_LIMIT);
    exposureLedgerRef.current = new Map(
      exposures.map((entry) => [entry.key, entry]),
    );
    const state: PreviewLearningState = {
      version: 1,
      exposures,
      preferences: preferencesRef.current,
    };
    try {
      window.localStorage.setItem(learningStorageKey, JSON.stringify(state));
      writeRecentCookie(profileKey, exposures);
    } catch {
      // Storage can be disabled in private browsing. Session learning still
      // works from refs and never blocks browsing.
    }
  }, [learningStorageKey, profileKey, isPublicPreview]);

  const scheduleLearningPersistence = React.useCallback(() => {
    if (persistenceTimerRef.current) return;
    persistenceTimerRef.current = setTimeout(() => {
      persistenceTimerRef.current = null;
      persistLearningNow();
    }, 500);
  }, [persistLearningNow]);

  const scheduleFutureRerank = React.useCallback(() => {
    rerankRequestedRef.current = true;
    if (scrollInProgressRef.current || rerankTimerRef.current) return;
    rerankTimerRef.current = setTimeout(() => {
      rerankTimerRef.current = null;
      if (scrollInProgressRef.current || !rerankRequestedRef.current) return;
      rerankRequestedRef.current = false;
      rerankFutureRef.current();
    }, 120);
  }, []);

  const recordImpression = React.useCallback(
    (item: TmdbPreviewItem) => {
      if (!learningReadyRef.current) return;
      const key = itemKey(item);
      const existing = exposureLedgerRef.current.get(key);
      const now = Date.now();
      const exposure: PreviewExposure = {
        key,
        lastSeenAt: now,
        viewCount: Math.min(10_000, (existing?.viewCount ?? 0) + 1),
        score: existing?.score ?? 0,
      };
      exposureLedgerRef.current.set(key, exposure);

      const feedback = feedbackRef.current;
      feedback.impressions = Math.min(2_000, feedback.impressions + 1);
      feedbackMetric(feedback.source, item.source).views += 1;
      feedback.mediaTypes[item.media_type].views += 1;
      for (const genreId of item.genre_ids?.slice(0, 3) ?? []) {
        feedbackMetric(feedback.genres, String(genreId)).views += 1;
      }
      const delta = feedback.exposures.get(key);
      feedback.exposures.set(key, {
        key,
        lastSeenAt: now,
        viewCount: Math.min(2_000, (delta?.viewCount ?? 0) + 1),
        score: delta?.score ?? 0,
      });
      scheduleLearningPersistence();
    },
    [scheduleLearningPersistence],
  );

  const recordSignal = React.useCallback(
    (
      item: TmdbPreviewItem,
      event: keyof PreviewFeedbackPayload["events"],
      score: number,
      once = false,
    ) => {
      if (!learningReadyRef.current) return;
      const key = itemKey(item);
      const signalKey = `${event}:${key}`;
      if (once && signalledKeysRef.current.has(signalKey)) return;
      if (once) signalledKeysRef.current.add(signalKey);

      const feedback = feedbackRef.current;
      // A snapshot can rotate while this title is still active. If its dwell
      // or explicit action lands afterward, give the new aggregate a bounded
      // denominator instead of either dropping the signal or submitting an
      // invalid score-without-view payload.
      if (!feedback.exposures.has(key)) {
        feedback.impressions = Math.min(2_000, feedback.impressions + 1);
        feedbackMetric(feedback.source, item.source).views += 1;
        feedback.mediaTypes[item.media_type].views += 1;
        for (const genreId of item.genre_ids?.slice(0, 3) ?? []) {
          feedbackMetric(feedback.genres, String(genreId)).views += 1;
        }
        feedback.exposures.set(key, {
          key,
          lastSeenAt: Date.now(),
          viewCount: 1,
          score: 0,
        });
      }
      feedback.events[event] = Math.min(2_000, feedback.events[event] + 1);
      feedbackMetric(feedback.source, item.source).score += score;
      feedback.mediaTypes[item.media_type].score += score;
      for (const genreId of item.genre_ids?.slice(0, 3) ?? []) {
        feedbackMetric(feedback.genres, String(genreId)).score += score;
      }
      const feedbackExposure = feedback.exposures.get(key)!;
      feedback.exposures.set(key, {
        ...feedbackExposure,
        lastSeenAt: Date.now(),
        score: Math.max(
          -feedbackExposure.viewCount,
          Math.min(feedbackExposure.viewCount, feedbackExposure.score + score),
        ),
      });

      const exposure = exposureLedgerRef.current.get(key);
      if (exposure) {
        exposureLedgerRef.current.set(key, {
          ...exposure,
          score: Math.max(-20, Math.min(20, exposure.score + score)),
        });
      }

      const preferences = preferencesRef.current;
      preferences.source[item.source] = clampPreference(
        preferences.source[item.source] + score * 0.08,
      );
      preferences.mediaType[item.media_type] = clampPreference(
        preferences.mediaType[item.media_type] + score * 0.045,
      );
      for (const genreId of item.genre_ids?.slice(0, 3) ?? []) {
        const genreKey = String(genreId);
        preferences.genre[genreKey] = clampPreference(
          (preferences.genre[genreKey] ?? 0) + score * 0.055,
        );
      }
      scheduleLearningPersistence();
      scheduleFutureRerank();
    },
    [scheduleFutureRerank, scheduleLearningPersistence],
  );

  const finishActiveVisit = React.useCallback(() => {
    const visit = activeVisitRef.current;
    if (!visit) return;
    activeVisitRef.current = null;
    const duration = Math.max(0, Date.now() - visit.startedAt);
    if (duration < PREVIEW_FAST_SKIP_MS) {
      recordSignal(visit.item, "fastSkips", -0.3);
    } else if (duration >= PREVIEW_MEANINGFUL_VIEW_MS) {
      recordSignal(visit.item, "meaningfulViews", 0.3);
    }
  }, [recordSignal]);

  const startActiveVisit = React.useCallback(
    (item: TmdbPreviewItem, countImpression: boolean) => {
      activeVisitRef.current = { item, startedAt: Date.now() };
      if (countImpression) recordImpression(item);
    },
    [recordImpression],
  );

  const buildFeedbackPayload = React.useCallback(() => {
    if (isPublicPreview) return null;
    if (pendingFeedbackPayloadRef.current) {
      return pendingFeedbackPayloadRef.current;
    }
    const feedback = feedbackRef.current;
    if (feedback.impressions === 0) return null;

    const genres = Object.fromEntries(
      Object.entries(feedback.genres)
        .sort((a, b) => b[1].views - a[1].views)
        .slice(0, 32)
        .map(([key, stat]) => [key, boundedFeedbackStat(stat)]),
    );
    const exposures = Array.from(feedback.exposures.values())
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, PREVIEW_SERVER_EXPOSURE_LIMIT)
      .map((entry) => ({
        key: entry.key,
        lastSeenAt: new Date(entry.lastSeenAt).toISOString(),
        viewCount: entry.viewCount,
        score: Math.max(
          -entry.viewCount,
          Math.min(entry.viewCount, entry.score),
        ),
      }));
    const payload: PreviewFeedbackPayload = {
      batchId: randomId(),
      sessionId: sessionIdRef.current,
      startedAt: sessionStartedAtRef.current,
      sentAt: new Date().toISOString(),
      impressions: Math.min(2_000, feedback.impressions),
      events: { ...feedback.events },
      source: {
        library: boundedFeedbackStat(feedback.source.library),
        trending: boundedFeedbackStat(feedback.source.trending),
        now_playing: boundedFeedbackStat(feedback.source.now_playing),
      },
      genres,
      mediaTypes: {
        movie: boundedFeedbackStat(feedback.mediaTypes.movie),
        tv: boundedFeedbackStat(feedback.mediaTypes.tv),
      },
      exposures,
    };
    // Freeze exactly this aggregate for idempotent retry. New impressions and
    // signals immediately enter a fresh accumulator while the request is in
    // flight, so accepting the snapshot can never erase later activity.
    pendingFeedbackPayloadRef.current = payload;
    feedbackRef.current = newFeedbackAccumulator();
    return payload;
  }, [isPublicPreview]);

  const acceptFeedbackSnapshot = React.useCallback(
    (serverPreferences?: PreviewPreferenceWeights) => {
      pendingFeedbackPayloadRef.current = null;
      feedbackSyncStartedRef.current = false;
      if (serverPreferences) {
        preferencesRef.current = mergePreferences(
          serverPreferences,
          preferencesRef.current,
        );
      }
      scheduleLearningPersistence();
    },
    [scheduleLearningPersistence],
  );

  const syncRemainingFeedback = React.useCallback(() => {
    if (isPublicPreview) return;
    if (
      feedbackSyncStartedRef.current ||
      feedbackDedicatedSyncUsedRef.current
    ) {
      return;
    }
    const payload = buildFeedbackPayload();
    if (!payload) return;
    // This is the one dedicated feedback request permitted for a short
    // session. Long sessions normally send the same aggregate on load-more.
    feedbackSyncStartedRef.current = true;
    feedbackDedicatedSyncUsedRef.current = true;
    void syncPreviewFeedback(payload)
      .then((result) => {
        if (result.persisted || result.duplicate) {
          acceptFeedbackSnapshot(result.preferences);
        } else {
          // Persistence is optional during a rolling migration. Keep the
          // frozen idempotent payload available for a later load-more, but do
          // not spend another dedicated Function request this session.
          feedbackSyncStartedRef.current = false;
        }
      })
      .catch(() => {
        // The batch id makes retry idempotent if the server committed but the
        // response was interrupted. Retain the frozen payload and let a later
        // load-more or lifecycle boundary retry it.
        feedbackSyncStartedRef.current = false;
        feedbackDedicatedSyncUsedRef.current = false;
      });
  }, [acceptFeedbackSnapshot, buildFeedbackPayload, isPublicPreview]);

  React.useEffect(() => {
    syncRemainingFeedbackRef.current = syncRemainingFeedback;
  }, [syncRemainingFeedback]);

  React.useEffect(() => {
    const fallbackSessionId = randomId();
    if (!sessionSeedRef.current) sessionSeedRef.current = fallbackSessionId;
    if (!sessionIdRef.current) sessionIdRef.current = fallbackSessionId;

    const localState = isPublicPreview
      ? { exposures: [], preferences: neutralPreviewPreferences() }
      : readLearningState(learningStorageKey);
    exposureLedgerRef.current = new Map(
      localState.exposures.map((entry) => [entry.key, entry]),
    );
    preferencesRef.current = mergePreferences(
      initialPreferences,
      localState.preferences,
    );

    learningReadyRef.current = true;
    persistLearningNow();
    rerankFutureRef.current();
  }, [initialPreferences, learningStorageKey, persistLearningNow, isPublicPreview]);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const settleScroll = () => {
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
      scrollInProgressRef.current = false;
      if (rerankRequestedRef.current) scheduleFutureRerank();
    };
    const onScroll = () => {
      scrollInProgressRef.current = true;
      if (rerankTimerRef.current) {
        clearTimeout(rerankTimerRef.current);
        rerankTimerRef.current = null;
      }
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
      }
      // `scrollend` is available in current Safari/Chromium; this fallback
      // also covers older WebKit and interrupted programmatic scrolling.
      scrollIdleTimerRef.current = setTimeout(settleScroll, 180);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("scrollend", settleScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("scrollend", settleScroll);
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
      scrollInProgressRef.current = false;
    };
  }, [scheduleFutureRerank]);

  React.useEffect(() => {
    const item = itemsRef.current[activeIndex];
    if (!item || !pageVisible || !surfaceActive) return;
    const current = activeVisitRef.current;
    if (current && itemKey(current.item) === itemKey(item)) return;
    finishActiveVisit();
    startActiveVisit(item, true);
  }, [activeIndex, finishActiveVisit, pageVisible, startActiveVisit, surfaceActive]);

  React.useEffect(() => {
    if (
      feedbackRef.current.impressions >= PREVIEW_FEEDBACK_SYNC_THRESHOLD &&
      !feedbackSyncStartedRef.current
    ) {
      syncRemainingFeedback();
    }
  }, [activeIndex, syncRemainingFeedback]);

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    activeIndexRef.current = activeIndex;
    const activeItem = itemsRef.current[activeIndex];
    if (!activeItem) return;
    const activeItemKey = itemKey(activeItem);
    if (lastPlaybackItemKeyRef.current === activeItemKey) return;
    lastPlaybackItemKeyRef.current = activeItemKey;
    if (pausedItemKeyRef.current === activeItemKey) return;
    // Pause is scoped to the trailer on screen. Moving to another trailer is
    // an explicit request to consume that item, so clear the old pause and let
    // the new card autoplay when device preferences permit it.
    pausedItemKeyRef.current = null;
    if (automaticPlaybackAllowedRef.current) {
      playbackEnabledRef.current = true;
      setPlaybackEnabled(true);
    }
  }, [activeIndex, items]);

  React.useEffect(() => {
    playbackEnabledRef.current = playbackEnabled;
  }, [playbackEnabled]);

  React.useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const previousPublicLayoutRef = React.useRef({ finitePreviewLimit, frameHeight });
  React.useLayoutEffect(() => {
    if (!isPublicPreview) return;
    const previous = previousPublicLayoutRef.current;
    previousPublicLayoutRef.current = { finitePreviewLimit, frameHeight };
    if (previous.finitePreviewLimit === finitePreviewLimit &&
      previous.frameHeight === frameHeight) return;

    // A desktop visitor may be beyond the mobile limit when narrowing the
    // window. Restore a real visible snap target before paint, without
    // remounting the persistent player or discarding the fetched tail.
    const nextIndex = Math.max(0, Math.min(
      activeIndexRef.current,
      visibleItems.length - 1,
    ));
    const nextItem = visibleItems[nextIndex];
    if (!nextItem) return;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    setActivePlayerIndex((current) => current === null ? null : nextIndex);
    restoreScrollItemKeyRef.current = itemKey(nextItem);
    pendingScrollTopRef.current = null;
  }, [finitePreviewLimit, frameHeight, isPublicPreview, visibleItems]);

  React.useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const restoreItemKey = restoreScrollItemKeyRef.current;
    if (restoreItemKey) {
      const restoreIndex = visibleItems.findIndex(
        (item) => itemKey(item) === restoreItemKey,
      );
      const target =
        restoreIndex >= 0
          ? scroller.querySelector<HTMLElement>(
              `[data-preview-index="${restoreIndex}"]`,
            )
          : null;
      if (target && scroller.clientHeight > 0) {
        const previousBehavior = scroller.style.scrollBehavior;
        scroller.style.scrollBehavior = "auto";
        scroller.scrollTop = target.offsetTop;
        scroller.style.scrollBehavior = previousBehavior;
        restoreScrollItemKeyRef.current = null;
        pendingScrollTopRef.current = null;
      }
      return;
    }

    const nextScrollTop = pendingScrollTopRef.current;
    if (nextScrollTop == null) return;
    pendingScrollTopRef.current = null;
    const previousBehavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = "auto";
    scroller.scrollTop = nextScrollTop;
    scroller.style.scrollBehavior = previousBehavior;
  }, [frameHeight, visibleItems]);

  useFloatingPlayerGeometry({
    hostRef,
    scrollerRef,
    playerShellRef,
    desktopNavigationRef,
    activeIndex: activePlayerIndex,
    navigationIndex: visibleActiveIndex,
    visible: playerShellVisible,
    frameHeight,
    capturePlayerGestures: isPublicPreview,
  });

  // YouTube requires scripted playback to begin only after the real player is
  // visible. Geometry is committed in the layout effect above; wait one paint
  // before allowing playVideo so the iframe is never started as hidden media.
  React.useEffect(() => {
    setPlayerCanPlay(false);
    if (!playerShellVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const shell = playerShellRef.current;
      if (shell?.style.visibility === "visible") setPlayerCanPlay(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [playerShellVisible, playbackItem?.videoKey]);

  React.useEffect(() => {
    if (reducedMotion === null) return;
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData,
    );
    const canAutoplay = reducedMotion === false && !saveData;
    automaticPlaybackAllowedRef.current = canAutoplay;
    const activeItem = itemsRef.current[activeIndexRef.current];
    const activeItemPaused = Boolean(
      activeItem && pausedItemKeyRef.current === itemKey(activeItem),
    );
    const nextPlaybackEnabled = canAutoplay && !activeItemPaused;
    playbackEnabledRef.current = nextPlaybackEnabled;
    setPlaybackEnabled(nextPlaybackEnabled);
  }, [reducedMotion]);

  const handleAutoplayBlocked = React.useCallback(() => {
    if (isPublicPreview && (!surfaceActive || overlay?.hasSelection)) {
      youtubePlayerRef.current?.pause();
      return;
    }
    if (!audibleAutoplayFallbackAttemptedRef.current) {
      audibleAutoplayFallbackAttemptedRef.current = true;
      youtubePlayerRef.current?.mute();
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      youtubePlayerRef.current?.play();
      playbackEnabledRef.current = true;
      setPlaybackEnabled(true);
      return;
    }
    playbackEnabledRef.current = false;
    setPlaybackEnabled(false);
    toast.message("Tap Play to continue previews");
  }, [isPublicPreview, surfaceActive, overlay?.hasSelection]);

  const handlePlaybackError = React.useCallback((videoKey: string) => {
    if (failedVideoKeysRef.current.has(videoKey)) return;
    const next = new Set(failedVideoKeysRef.current);
    next.add(videoKey);
    failedVideoKeysRef.current = next;
    setFailedVideoKeys(next);
    if (!isPublicPreview) toast.error("This trailer cannot play here. You can still open it on YouTube.");
  }, [isPublicPreview]);

  React.useEffect(() => {
    if (!isPublicPreview || !surfaceActive || !playbackItem || playbackFailed ||
      visibleVideoKey === playbackItem.videoKey) return;
    const timeout = window.setTimeout(() => handlePlaybackError(playbackItem.videoKey), 12_000);
    return () => window.clearTimeout(timeout);
  }, [isPublicPreview, surfaceActive, playbackItem, playbackFailed, visibleVideoKey, handlePlaybackError]);

  React.useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible" && surfaceActive;
      if (!visible) {
        youtubePlayerRef.current?.pause();
        finishActiveVisit();
        persistLearningNow();
        syncRemainingFeedbackRef.current();
      } else if (
        automaticPlaybackAllowedRef.current &&
        itemKeyAt(itemsRef.current, activeIndexRef.current) !== null &&
        pausedItemKeyRef.current !==
          itemKeyAt(itemsRef.current, activeIndexRef.current) &&
        !menuOpen &&
        !blockingOverlayOpen &&
        !overlay?.hasSelection
      ) {
        // Page lifecycle pauses are temporary. Reassert the playback intent on
        // return even when a bfcache freeze prevented the hidden-state React
        // commit from reaching the persistent YouTube player.
        playbackEnabledRef.current = true;
        setPlaybackEnabled(true);
        window.requestAnimationFrame(() => {
          if (
            document.visibilityState === "visible" &&
            surfaceActive &&
            automaticPlaybackAllowedRef.current &&
            itemKeyAt(itemsRef.current, activeIndexRef.current) !== null &&
            pausedItemKeyRef.current !==
              itemKeyAt(itemsRef.current, activeIndexRef.current)
          ) {
            youtubePlayerRef.current?.play();
          }
        });
      }
      setPageVisible(visible);
    };
    const onPageHide = () => {
      youtubePlayerRef.current?.pause();
      finishActiveVisit();
      persistLearningNow();
      persistPreviewSessionRef.current();
      syncRemainingFeedbackRef.current();
      setPageVisible(false);
    };
    const onPageShow = () => onVisibility();
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [
    blockingOverlayOpen,
    finishActiveVisit,
    menuOpen,
    overlay?.hasSelection,
    persistLearningNow,
    surfaceActive,
  ]);

  React.useEffect(() => {
    if (
      !pageVisible ||
      menuOpen ||
      blockingOverlayOpen ||
      overlay?.hasSelection ||
      !automaticPlaybackAllowedRef.current ||
      itemKeyAt(itemsRef.current, activeIndexRef.current) === null ||
      pausedItemKeyRef.current ===
        itemKeyAt(itemsRef.current, activeIndexRef.current)
    ) {
      return;
    }
    // Menus and title details temporarily suspend the shared iframe. Closing
    // them should resume unless Pause was an explicit user choice. This effect
    // intentionally does not depend on playbackEnabled, avoiding retry loops
    // when a browser rejects autoplay.
    playbackEnabledRef.current = true;
    setPlaybackEnabled(true);
  }, [blockingOverlayOpen, menuOpen, overlay?.hasSelection, pageVisible]);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const players = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-preview-player-index]"),
    );
    const visibility = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(entry.target, entry.intersectionRatio);
        });
        const visible = Array.from(visibility.entries())
          .filter(([, ratio]) => ratio >= 0.6)
          .sort((a, b) => b[1] - a[1])[0];
        if (!visible) {
          setActivePlayerIndex(null);
          return;
        }
        const next = Number(
          (visible[0] as HTMLElement).dataset.previewPlayerIndex ?? "0",
        );
        if (Number.isFinite(next) &&
          (finitePreviewLimitRef.current === null || next < finitePreviewLimitRef.current)) {
          activeIndexRef.current = next;
          setActiveIndex(next);
          setActivePlayerIndex(next);
        }
      },
      { root: scroller, threshold: [0, 0.6, 0.75, 0.9, 1] },
    );
    players.forEach((player) => observer.observe(player));
    return () => observer.disconnect();
  }, [frameHeight, observedItemMembership]);

  const commitFeedItems = React.useCallback(
    (nextItems: TmdbPreviewItem[], removeFromStart: number) => {
      if (removeFromStart > 0) {
        const scroller = scrollerRef.current;
        if (scroller) {
          pendingScrollTopRef.current = Math.max(
            0,
            scroller.scrollTop - removeFromStart * scroller.clientHeight,
          );
        }
        const nextActiveIndex = Math.max(
          0,
          activeIndexRef.current - removeFromStart,
        );
        activeIndexRef.current = nextActiveIndex;
        setActiveIndex(nextActiveIndex);
        setActivePlayerIndex((current) =>
          current == null ? null : Math.max(0, current - removeFromStart),
        );
      }
      itemsRef.current = nextItems;
      setItems(nextItems);
    },
    [],
  );

  const rerankFutureItems = React.useCallback(() => {
    if (!learningReadyRef.current || finitePreviewLimitRef.current !== null) return;
    const currentItems = itemsRef.current;
    // Index + 1 is the active card, so +4 protects the active card and the
    // next three interaction targets from live personalization changes.
    const movableStart = Math.min(
      currentItems.length,
      activeIndexRef.current + 4,
    );
    if (currentItems.length - movableStart < 2) return;
    const fixed = currentItems.slice(0, movableStart);
    const ranked = rankPreviewItems(
      currentItems.slice(movableStart),
      fixed.slice(-4),
      preferencesRef.current,
      exposureLedgerRef.current,
      `${sessionSeedRef.current}:tail:${batchIndexRef.current}`,
    );
    if (
      ranked.every(
        (item, index) =>
          itemKey(item) === itemKey(currentItems[movableStart + index]),
      )
    ) {
      return;
    }
    commitFeedItems([...fixed, ...ranked], 0);
  }, [commitFeedItems]);

  React.useEffect(() => {
    rerankFutureRef.current = rerankFutureItems;
    if (skipInitialRerankRef.current) {
      // The snapshot already contains the exact order the person left. New
      // interactions may rerank its distant tail later, but returning alone
      // must not silently replace their next trailer.
      skipInitialRerankRef.current = false;
      return;
    }
    if (learningReadyRef.current) rerankFutureItems();
  }, [rerankFutureItems]);

  const appendPreviewItems = React.useCallback(
    (incoming: TmdbPreviewItem[]) => {
      const currentItems = itemsRef.current;
      const existingKeys = new Set(currentItems.map(itemKey));
      const unique = incoming.filter((item) => {
        const key = itemKey(item);
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });
      if (unique.length === 0) return 0;

      const rankedUnique = rankPreviewItems(
        unique,
        currentItems.slice(-4),
        preferencesRef.current,
        exposureLedgerRef.current,
        `${sessionSeedRef.current}:batch:${batchIndexRef.current}`,
      );
      const expanded = [...currentItems, ...rankedUnique];
      const overflow = Math.max(0, expanded.length - PREVIEW_MAX_RENDERED);
      const safelyRemovable = Math.max(
        0,
        activeIndexRef.current - PREVIEW_KEEP_BEHIND,
      );
      // A desktop request can finish after the viewport narrows. Keep its
      // new titles in the backing tail without shifting the visible sequence.
      const removeFromStart = finitePreviewLimitRef.current === null
        ? Math.min(overflow, safelyRemovable)
        : 0;
      commitFeedItems(expanded.slice(removeFromStart), removeFromStart);
      return rankedUnique.length;
    },
    [commitFeedItems],
  );

  const replayArchivedPreviews = React.useCallback(() => {
    if (finitePreviewLimitRef.current !== null) return 0;
    const archive = playableArchiveRef.current;
    if (!archive) return 0;
    const savedKeys = new Set(savedRef.current.keys());
    const available = Array.from(archive.entries())
      .filter(
        ([key, item]) =>
          !savedKeys.has(key) && !failedVideoKeysRef.current.has(item.videoKey),
      )
      .sort(
        ([leftKey], [rightKey]) =>
          (exposureLedgerRef.current.get(leftKey)?.lastSeenAt ?? 0) -
          (exposureLedgerRef.current.get(rightKey)?.lastSeenAt ?? 0),
      );
    const replayCount = Math.min(24, Math.max(0, available.length - 1));
    if (replayCount === 0) return 0;

    // Preserve as much of a 36-title visual gap as the archive permits, then
    // free older DOM entries so a small catalogue can still rotate forever.
    const replayGap = Math.min(
      PREVIEW_REPLAY_GAP,
      Math.max(1, available.length - replayCount),
    );
    const currentItems = itemsRef.current;
    const desiredRemoval = Math.max(0, currentItems.length - replayGap);
    const removeFromStart = Math.min(
      desiredRemoval,
      Math.max(0, activeIndexRef.current),
    );
    if (removeFromStart > 0) {
      commitFeedItems(currentItems.slice(removeFromStart), removeFromStart);
    }

    const currentKeys = new Set(itemsRef.current.map(itemKey));
    const start = archiveCursorRef.current % available.length;
    const replayItems: TmdbPreviewItem[] = [];
    let scanned = 0;
    while (scanned < available.length && replayItems.length < replayCount) {
      const [key, item] = available[(start + scanned) % available.length];
      if (!currentKeys.has(key)) replayItems.push(item);
      scanned += 1;
    }
    archiveCursorRef.current = (start + scanned) % available.length;
    return appendPreviewItems(replayItems);
  }, [appendPreviewItems, commitFeedItems]);

  const schedulePreviewRetry = React.useCallback((delay: number) => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    const limit = finitePreviewLimitRef.current;
    if (limit !== null && itemsRef.current.length >= limit) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setLoadRevision((revision) => revision + 1);
    }, delay);
  }, []);

  const requestMorePreviews = React.useCallback(async () => {
    const attemptedHistory = attemptedHistoryRef.current;
    if (!attemptedHistory || loadingMoreRef.current) return;
    const limit = finitePreviewLimitRef.current;
    if (limit !== null && itemsRef.current.length >= limit) return;
    if (catalogueExhaustedRef.current) {
      replayArchivedPreviews();
      return;
    }
    loadingMoreRef.current = true;
    let piggybackedFeedback: PreviewFeedbackPayload | undefined;

    try {
      const hardCooldownCutoff = Date.now() - PREVIEW_HARD_COOLDOWN_MS;
      const exposureKeys = Array.from(exposureLedgerRef.current.values())
        .filter((entry) => entry.lastSeenAt >= hardCooldownCutoff)
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
        .slice(0, PREVIEW_SERVER_EXPOSURE_LIMIT)
        .map((entry) => entry.key);
      const feedback = feedbackSyncStartedRef.current
        ? undefined
        : (buildFeedbackPayload() ?? undefined);
      piggybackedFeedback = feedback;
      if (feedback) feedbackSyncStartedRef.current = true;
      const requestBatchIndex = batchIndexRef.current;
      const context: PreviewLoadContext = {
        sessionSeed: sessionSeedRef.current,
        batchIndex: requestBatchIndex,
        exposureKeys,
        preferences: normalizePreferences(preferencesRef.current),
        feedback,
      };
      const batch = await (isPublicPreview
        ? loadPublicPreviews(attemptedHistory.order, context)
        : loadMorePreviews(attemptedHistory.order, context));
      if (feedback && batch.feedbackAccepted) {
        acceptFeedbackSnapshot(batch.preferences);
      } else if (feedback) {
        feedbackSyncStartedRef.current = false;
      }
      rememberHistoryKeys(attemptedHistory, batch.attemptedKeys);
      if (playableArchiveRef.current) {
        rememberArchiveItems(playableArchiveRef.current, batch.items);
      }
      const appendedCount = appendPreviewItems(batch.items);
      batchIndexRef.current = Math.min(10_000, requestBatchIndex + 1);
      loadFailureCountRef.current = 0;

      const currentLimit = finitePreviewLimitRef.current;
      if (currentLimit !== null && itemsRef.current.length >= currentLimit) return;
      if (appendedCount > 0) {
        return;
      } else if (batch.attemptedKeys.length === 0) {
        catalogueExhaustedRef.current = true;
        replayArchivedPreviews();
      } else {
        schedulePreviewRetry(PREVIEW_LOAD_RETRY_MS);
      }
    } catch {
      if (piggybackedFeedback) feedbackSyncStartedRef.current = false;
      loadFailureCountRef.current += 1;
      if (loadFailureCountRef.current <= PREVIEW_MAX_AUTOMATIC_RETRIES) {
        const retryDelay = Math.min(
          15_000,
          PREVIEW_LOAD_RETRY_MS * 2 ** (loadFailureCountRef.current - 1),
        );
        schedulePreviewRetry(retryDelay);
      }
    } finally {
      loadingMoreRef.current = false;
    }
  }, [
    acceptFeedbackSnapshot,
    appendPreviewItems,
    buildFeedbackPayload,
    replayArchivedPreviews,
    schedulePreviewRetry,
    isPublicPreview,
  ]);

  React.useEffect(() => {
    if (finitePreviewLimit !== null && items.length >= finitePreviewLimit) {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      return;
    }
    if (
      !pageVisible || !surfaceActive ||
      items.length === 0 ||
      activeIndex < Math.max(0, items.length - PREVIEW_LOAD_AHEAD)
    ) {
      return;
    }
    void requestMorePreviews();
  }, [activeIndex, finitePreviewLimit, items, loadRevision, pageVisible, requestMorePreviews, surfaceActive]);

  React.useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (persistenceTimerRef.current) {
        clearTimeout(persistenceTimerRef.current);
      }
      if (rerankTimerRef.current) clearTimeout(rerankTimerRef.current);
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
      }
    },
    [],
  );

  const rememberSaved = React.useCallback(
    (key: string, record: SavedRecord) => {
      const next = new Map(savedRef.current);
      next.set(key, record);
      savedRef.current = next;
      setSaved(next);
    },
    [],
  );

  const ensureSaved = React.useCallback(
    (item: TmdbPreviewItem) => {
      const key = itemKey(item);
      const existing = savedRef.current.get(key);
      if (existing) return Promise.resolve(existing.id);
      const inFlight = pendingSaves.current.get(key);
      if (inFlight) return inFlight;

      const request = addTitle({
        tmdbId: item.id,
        mediaType: item.media_type,
        status: "want",
      })
        .then((row) => {
          if (!row?.id) throw new Error("Title could not be added");
          const record = { id: row.id, status: row.status ?? "want" };
          rememberSaved(key, record);
          overlay?.markSaved(item, record);
          recordSignal(item, "saves", 1, true);
          return row.id;
        })
        .finally(() => pendingSaves.current.delete(key));

      pendingSaves.current.set(key, request);
      return request;
    },
    [overlay, recordSignal, rememberSaved],
  );

  const moveTo = React.useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollerRef.current;
      if (!scroller || visibleItems.length === 0) return;
      const clamped = Math.max(0, Math.min(visibleItems.length - 1, index));
      const target = scroller.querySelector<HTMLElement>(
        `[data-preview-index="${clamped}"]`,
      );
      if (isPublicPreview && target) {
        scroller.scrollTo({
          top: target.offsetTop,
          behavior: behavior === "smooth" && reducedMotion === false ? "smooth" : "instant",
        });
        return;
      }
      target?.scrollIntoView({
        block: "start",
        behavior:
          behavior === "smooth" && reducedMotion === false ? "smooth" : "auto",
      });
    },
    [visibleItems.length, reducedMotion, isPublicPreview],
  );

  const ambientItem = visibleItems[visibleActiveIndex] ?? visibleItems[0];
  const ambientBackdrop = ambientItem
    ? backdropUrl(ambientItem.backdrop_path, "w300") ??
      posterUrl(ambientItem.poster_path)
    : null;
  const onBackdropChange = publicPreview?.onBackdropChange;
  React.useEffect(() => {
    onBackdropChange?.(ambientBackdrop);
  }, [ambientBackdrop, onBackdropChange]);

  if (items.length === 0) {
    return (
      <div
        data-previews-feed={isPublicPreview ? undefined : true}
        className="flex h-full min-h-[28rem] items-center justify-center bg-[#050608] px-5 text-center text-white"
      >
        <div className="max-w-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/60">
            <Play className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            No previews are playable right now
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/55">
            We could not find an embeddable trailer in this batch. The poster rails are still ready to browse.
          </p>
          <Link
            href="/discover"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Browse Discover
          </Link>
        </div>
      </div>
    );
  }

  if (usableFrameHeight !== null && usableFrameHeight < 364) {
    return (
      <div
        data-previews-feed={isPublicPreview ? undefined : true}
        className="flex min-h-0 w-full items-center justify-center bg-[#050608] px-6 text-center"
        style={{ height: `${frameHeight}px` }}
      >
        <p className="text-xs leading-5 text-white/55">
          Rotate your device to keep previews and their controls visible.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      data-previews-feed={isPublicPreview ? undefined : true}
      data-public-previews={isPublicPreview ? true : undefined}
      className={cn("group/previews relative min-h-0 w-full", !onBackdropChange && "bg-[#050608]", isPublicPreview ? "overflow-clip" : "overflow-hidden")}
      style={frameHeight ? { height: `${frameHeight}px` } : { height: "100%" }}
    >
      {!onBackdropChange && <PreviewBackdrop src={ambientBackdrop} priority={visibleActiveIndex === 0} />}
      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Trailer previews"
        aria-describedby="preview-feed-instructions"
        aria-keyshortcuts="ArrowDown ArrowUp PageDown PageUp Home End J K"
        tabIndex={0}
        onWheelCapture={dismissDesktopScrollHint}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          if (target !== event.currentTarget) return;
          const key = event.key.toLowerCase();
          const hasCommandModifier = event.metaKey || event.ctrlKey || event.altKey;
          if (
            event.key === "ArrowDown" ||
            event.key === "PageDown" ||
            (key === "j" && !hasCommandModifier)
          ) {
            if (finitePreviewLimit !== null && visibleActiveIndex === visibleItems.length - 1) return;
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(visibleActiveIndex + 1, "auto");
          } else if (
            event.key === "ArrowUp" ||
            event.key === "PageUp" ||
            (key === "k" && !hasCommandModifier)
          ) {
            if (finitePreviewLimit !== null && visibleActiveIndex === 0) return;
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(visibleActiveIndex - 1, "auto");
          } else if (event.key === "Home") {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(0, "auto");
          } else if (event.key === "End") {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(visibleItems.length - 1, "auto");
          }
        }}
        className={cn(
          "relative z-10 h-full min-h-0 touch-pan-y snap-y snap-mandatory overflow-x-hidden overflow-y-auto scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
          finitePreviewLimit === null ? "overscroll-y-contain" : "overscroll-y-auto",
          isPublicPreview && "mx-[clamp(24px,3vw,48px)]",
        )}
      >
        <p id="preview-feed-instructions" className="sr-only">
          Swipe or scroll up and down. On a keyboard, use the Up and Down arrow
          keys, Page Up and Page Down, or J and K.
          {!isPublicPreview && " Previous and next preview buttons are also available."}
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Now showing {titleFor(visibleItems[visibleActiveIndex])}
        </p>
        {visibleItems.map((item, index) => {
          const key = itemKey(item);
          const record = overlay?.savedRecord(item) ?? saved.get(key);
          return (
            <PreviewSlide
              key={key}
              item={item}
              index={index}
              selected={index === visibleActiveIndex}
              playerVisible={
                index === activePlayerIndex && playerShellVisible
              }
              playbackFailed={failedVideoKeys.has(item.videoKey)}
              playerReady={playerReady && !failedVideoKeys.has(item.videoKey)}
              playbackEnabled={playbackEnabled && pageVisible}
              soundEnabled={soundEnabled}
              saveHref={publicPreview?.saveHref}
              account={isPublicPreview ? undefined : {
                lists,
                savedRecord: record,
                ensureSaved: () => ensureSaved(item),
                onStatusChange: (status) => {
                  const current = savedRef.current.get(key);
                  const next = current
                    ? { ...current, status }
                    : record
                      ? { ...record, status }
                      : null;
                  if (!next) return;
                  rememberSaved(key, next);
                  overlay?.markSaved(item, next);
                },
                onListIntent: () => recordSignal(item, "listIntents", 0.85, true),
                onMenuOpenChange: setMenuOpen,
              }}
              onEnablePlayback={() => {
                youtubePlayerRef.current?.play();
                pausedItemKeyRef.current = null;
                playbackEnabledRef.current = true;
                setPlaybackEnabled(true);
              }}
              onTogglePlayback={() => {
                if (playbackEnabled) {
                  youtubePlayerRef.current?.pause();
                  pausedItemKeyRef.current = key;
                  playbackEnabledRef.current = false;
                  setPlaybackEnabled(false);
                } else {
                  youtubePlayerRef.current?.play();
                  pausedItemKeyRef.current = null;
                  playbackEnabledRef.current = true;
                  setPlaybackEnabled(true);
                }
              }}
              onToggleSound={() => {
                if (soundEnabled) {
                  youtubePlayerRef.current?.mute();
                  soundEnabledRef.current = false;
                  setSoundEnabled(false);
                } else {
                  youtubePlayerRef.current?.unmuteAndPlay();
                  recordSignal(item, "unmutes", 0.55, true);
                  soundEnabledRef.current = true;
                  setSoundEnabled(true);
                  pausedItemKeyRef.current = null;
                  playbackEnabledRef.current = true;
                  setPlaybackEnabled(true);
                }
              }}
              onDetail={() => {
                recordSignal(item, "details", 0.7, true);
              }}
            />
          );
        })}
      </div>
        {!isPublicPreview ? <div className="preview-feed-a11y-navigation pointer-events-none right-4 z-[80] flex gap-2 opacity-0 transition-opacity focus-within:opacity-100 fixed bottom-[calc(7rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => {
              dismissDesktopScrollHint();
              moveTo(activeIndex - 1);
            }}
            className="pointer-events-none inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-lg focus:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:hidden"
          >
            Previous preview
          </button>
          <button
            type="button"
            disabled={activeIndex === items.length - 1}
            onClick={() => {
              dismissDesktopScrollHint();
              moveTo(activeIndex + 1);
            }}
            className="pointer-events-none inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-lg focus:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:hidden"
          >
            Next preview
          </button>
        </div> : null}
      <div
        ref={desktopNavigationRef}
        className={cn(
          "pointer-events-none invisible absolute left-0 top-0 z-40 w-12 flex-col items-stretch gap-2 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [backface-visibility:hidden]",
          isPublicPreview ? "hidden md:flex" : "preview-desktop-navigation",
          isPublicPreview || desktopScrollHintVisible
            ? "opacity-100"
            : "opacity-0 group-hover/previews:opacity-70 focus-within:opacity-100",
        )}
        role="group"
        aria-label="Preview navigation"
      >
        {!isPublicPreview && desktopScrollHintVisible ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[-2.5rem] flex min-h-7 w-24 -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-black/30 px-2 py-1 text-center text-[9px] font-medium leading-tight text-white/60"
            aria-hidden
          >
            <Mouse className="h-3 w-3 shrink-0" />
            <span>Scroll to browse</span>
          </div>
        ) : null}
        <button
          type="button"
          disabled={visibleActiveIndex === 0}
          onClick={() => {
            dismissDesktopScrollHint();
            moveTo(visibleActiveIndex - 1);
          }}
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/55 transition-[background-color,border-color,color,transform] duration-150 hover:border-white/15 hover:bg-black/35 hover:text-white/85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-20 motion-reduce:active:scale-100"
          aria-label="Previous preview"
          title="Previous preview (K or Up Arrow)"
        >
          <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          disabled={visibleActiveIndex === visibleItems.length - 1}
          onClick={() => {
            dismissDesktopScrollHint();
            moveTo(visibleActiveIndex + 1);
          }}
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/55 transition-[background-color,border-color,color,transform] duration-150 hover:border-white/15 hover:bg-black/35 hover:text-white/85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-20 motion-reduce:active:scale-100"
          aria-label="Next preview"
          title="Next preview (J or Down Arrow)"
        >
          <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>
      {playbackItem ? (
        <div
          ref={playerShellRef}
          className="pointer-events-none invisible absolute left-0 top-0 z-20 overflow-hidden rounded-2xl bg-black opacity-0 will-change-transform"
        >
          <YouTubePreview
            ref={youtubePlayerRef}
            videoKey={playbackItem.videoKey}
            title={`${titleFor(playbackItem)} trailer`}
            soundEnabled={soundEnabled}
            shouldPlay={playerShouldPlay}
            playerOrigin={playerOrigin}
            onAutoplayBlocked={handleAutoplayBlocked}
            onPlayerReady={() => setPlayerReady(true)}
            onPlaybackError={handlePlaybackError}
            onVideoVisible={setVisibleVideoKey}
          />
        </div>
      ) : null}
    </div>
  );
}
