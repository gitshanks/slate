"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  LoaderCircle,
  Mouse,
  Pause,
  Play,
  Plus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { AddTitleToListButton } from "@/components/add-title-to-list-button";
import { useDiscoverTitleOverlay } from "@/components/discover-title-overlay-context";
import { StatusPill } from "@/components/status-pill";
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
import type { TmdbPreviewItem, TmdbPreviewSource } from "@/lib/tmdb";
import type { TitleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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
}

interface SavedRecord {
  id: string;
  status: TitleStatus;
}

interface YouTubePlayerInstance {
  cueVideoById(videoId: string, startSeconds?: number): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
  getVideoData(): { video_id?: string };
  loadVideoById(videoId: string, startSeconds?: number): void;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  unMute(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayerInstance;
}

interface YouTubePlayerStateEvent extends YouTubePlayerEvent {
  data: number;
}

interface YouTubePlayerOptions {
  events: {
    onAutoplayBlocked?: () => void;
    onError?: () => void;
    onReady: (event: YouTubePlayerEvent) => void;
    onStateChange?: (event: YouTubePlayerStateEvent) => void;
  };
  host?: string;
  height?: number | string;
  playerVars: Record<string, number | string>;
  videoId: string;
  width?: number | string;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
}

interface YouTubePlayerHandle {
  mute(): void;
  pause(): void;
  play(): void;
  unmuteAndPlay(): void;
}

const YOUTUBE_PLAYER_STATE_ENDED = 0;

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SOURCE_LABELS: Record<TmdbPreviewSource, string> = {
  library: "Based on your library",
  trending: "Trending this week",
  now_playing: "Now playing",
};

const SOURCE_TONES: Record<TmdbPreviewSource, string> = {
  library: "text-emerald-200",
  trending: "text-amber-200",
  now_playing: "text-sky-200",
};

const PREVIEW_LOAD_AHEAD = 12;
const PREVIEW_MAX_RENDERED = 48;
const PREVIEW_KEEP_BEHIND = 12;
const PREVIEW_HISTORY_LIMIT = 240;
const PREVIEW_REPLAY_GAP = 36;
const PREVIEW_LOAD_RETRY_MS = 1_800;
const PREVIEW_MAX_AUTOMATIC_RETRIES = 3;
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
const MOVIE_GENRE_NAMES = new Map<number, string>([
  [28, "Action"],
  [12, "Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [14, "Fantasy"],
  [36, "History"],
  [27, "Horror"],
  [10402, "Music"],
  [9648, "Mystery"],
  [10749, "Romance"],
  [878, "Science Fiction"],
  [53, "Thriller"],
  [10752, "War"],
  [37, "Western"],
]);
const TV_GENRE_NAMES = new Map<number, string>([
  [10759, "Action & Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [10762, "Kids"],
  [9648, "Mystery"],
  [10764, "Reality"],
  [10765, "Sci-Fi & Fantasy"],
  [10766, "Soap"],
  [10767, "Talk"],
  [10768, "War & Politics"],
  [37, "Western"],
]);

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

function titleFor(item: TmdbPreviewItem) {
  return item.title || item.name || "Untitled";
}

function yearFor(item: TmdbPreviewItem) {
  const date = item.release_date || item.first_air_date || "";
  return date.slice(0, 4);
}

function primaryGenre(item: TmdbPreviewItem) {
  const genreId = item.genre_ids?.[0];
  if (!genreId) return null;
  const table = item.media_type === "movie" ? MOVIE_GENRE_NAMES : TV_GENRE_NAMES;
  const name = table.get(genreId);
  if (!name) return null;
  return name;
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

function useAvailableFeedHeight(hostRef: React.RefObject<HTMLDivElement | null>) {
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
            useStableAppTrack && parentRect && parentRect.height > 0
              ? parentRect.height
              : document.documentElement.clientHeight - rect.top,
          ),
        );
        const hostBottom = rect.top + nextHeight;
        const dock = document.getElementById("app-bottom-nav");
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
  }, [hostRef]);

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
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  playerShellRef: React.RefObject<HTMLDivElement | null>;
  desktopNavigationRef: React.RefObject<HTMLDivElement | null>;
  activeIndex: number | null;
  navigationIndex: number;
  visible: boolean;
  frameHeight: number | null;
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

      if (desktopNavigation) {
        if (!navigationTarget) {
          desktopNavigation.style.visibility = "hidden";
        } else {
          const hostRect = host.getBoundingClientRect();
          const targetRect = navigationTarget.getBoundingClientRect();
          const navigationWidth = desktopNavigation.offsetWidth;
          const navigationHeight = desktopNavigation.offsetHeight;
          const navigationGap = 8;
          const rightRoom = hostRect.right - targetRect.right;
          const leftRoom = targetRect.left - hostRect.left;
          let navigationLeft: number | null = null;

          if (rightRoom >= navigationWidth + navigationGap) {
            navigationLeft =
              targetRect.right - hostRect.left + navigationGap;
          } else if (leftRoom >= navigationWidth + navigationGap) {
            navigationLeft =
              targetRect.left - hostRect.left - navigationWidth - navigationGap;
          }

          if (navigationLeft == null) {
            desktopNavigation.style.visibility = "hidden";
          } else {
            // Keep the desktop controls still while the snap surface moves
            // beneath them. Following the outgoing slide during wheel travel
            // makes the controls drift, then jump when the next slide wins.
            const navigationTop = Math.max(
              12,
              Math.min(
                hostRect.height - navigationHeight - 12,
                hostRect.height * 0.4 - navigationHeight / 2,
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
      const hostRect = host.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      shell.style.width = `${targetRect.width}px`;
      shell.style.height = `${targetRect.height}px`;
      shell.style.transform = `translate3d(${targetRect.left - hostRect.left}px, ${targetRect.top - hostRect.top}px, 0)`;
      shell.style.opacity = "1";
      // A cross-origin iframe consumes touch gestures before the snapping feed
      // can see them. On touch-first devices Slate's controls live below the
      // player, so let the full trailer frame remain a reliable swipe surface.
      // Fine pointers keep direct YouTube interaction on desktop.
      shell.style.pointerEvents = interactivePlayer.matches ? "auto" : "none";
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
  ]);
}

const YouTubePreview = React.forwardRef<
  YouTubePlayerHandle,
  {
    videoKey: string;
    title: string;
    soundEnabled: boolean;
    shouldPlay: boolean;
    playerOrigin?: string;
    onAutoplayBlocked: () => void;
    onPlayerReady: () => void;
    onPlaybackError: (videoKey: string) => void;
    onVideoVisible: (videoKey: string) => void;
  }
>(function YouTubePreview(
  {
    videoKey,
    title,
    soundEnabled,
    shouldPlay,
    playerOrigin,
    onAutoplayBlocked,
    onPlayerReady,
    onPlaybackError,
    onVideoVisible,
  },
  forwardedRef,
) {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<YouTubePlayerInstance | null>(null);
  const readyRef = React.useRef(false);
  const loadedVideoRef = React.useRef(videoKey);
  const videoKeyRef = React.useRef(videoKey);
  const soundEnabledRef = React.useRef(soundEnabled);
  const shouldPlayRef = React.useRef(shouldPlay);
  const onAutoplayBlockedRef = React.useRef(onAutoplayBlocked);
  const onPlaybackErrorRef = React.useRef(onPlaybackError);
  const onPlayerReadyRef = React.useRef(onPlayerReady);
  const onVideoVisibleRef = React.useRef(onVideoVisible);
  const titleRef = React.useRef(title);
  const [apiReady, setApiReady] = React.useState(() =>
    Boolean(typeof window !== "undefined" && window.YT?.Player),
  );

  const syncPlayer = React.useCallback(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;

    if (soundEnabledRef.current) player.unMute();
    else player.mute();

    if (loadedVideoRef.current !== videoKeyRef.current) {
      // Cue first without playback. The parent reveals this exact keyed frame
      // after CUED, then a subsequent visible commit is allowed to play it.
      player.cueVideoById(videoKeyRef.current, 0);
      loadedVideoRef.current = videoKeyRef.current;
      return;
    } else if (shouldPlayRef.current) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, []);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      mute() {
        if (readyRef.current) playerRef.current?.mute();
      },
      pause() {
        // Keep the intent ref in sync immediately so an ENDED event racing the
        // user's pause (or pagehide) cannot start another loop iteration.
        shouldPlayRef.current = false;
        if (readyRef.current) playerRef.current?.pauseVideo();
      },
      play() {
        shouldPlayRef.current = true;
        if (readyRef.current) playerRef.current?.playVideo();
      },
      unmuteAndPlay() {
        // These calls intentionally happen inside the user's click stack so
        // WebKit can grant audio to this persistent media session.
        shouldPlayRef.current = true;
        if (readyRef.current) {
          playerRef.current?.unMute();
          playerRef.current?.playVideo();
        }
      },
    }),
    [],
  );

  React.useLayoutEffect(() => {
    videoKeyRef.current = videoKey;
    soundEnabledRef.current = soundEnabled;
    shouldPlayRef.current = shouldPlay;
    onAutoplayBlockedRef.current = onAutoplayBlocked;
    onPlayerReadyRef.current = onPlayerReady;
    onPlaybackErrorRef.current = onPlaybackError;
    onVideoVisibleRef.current = onVideoVisible;
    titleRef.current = title;
    syncPlayer();
    const iframe = mountRef.current?.querySelector("iframe");
    iframe?.setAttribute("title", title);
  }, [
    onAutoplayBlocked,
    onPlayerReady,
    onPlaybackError,
    onVideoVisible,
    soundEnabled,
    shouldPlay,
    syncPlayer,
    title,
    videoKey,
  ]);

  React.useEffect(() => {
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    const handleReady = () => {
      previousReady?.();
      setApiReady(Boolean(window.YT?.Player));
    };
    window.onYouTubeIframeAPIReady = handleReady;
    return () => {
      if (window.onYouTubeIframeAPIReady === handleReady) {
        window.onYouTubeIframeAPIReady = previousReady;
      }
    };
  }, []);

  React.useEffect(() => {
    const host = mountRef.current;
    const api = window.YT;
    if (!host || !apiReady || !api?.Player) return;
    const playerMount = document.createElement("div");
    playerMount.style.height = "100%";
    playerMount.style.width = "100%";
    host.replaceChildren(playerMount);

    const playerVars: Record<string, number | string> = {
      autoplay: 0,
      cc_load_policy: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      playsinline: 1,
      rel: 0,
    };
    if (playerOrigin) playerVars.origin = playerOrigin;

    playerRef.current = new api.Player(playerMount, {
      videoId: loadedVideoRef.current,
      host: "https://www.youtube-nocookie.com",
      height: "100%",
      width: "100%",
      playerVars,
      events: {
        onReady(event) {
          playerRef.current = event.target;
          readyRef.current = true;
          syncPlayer();
          onPlayerReadyRef.current();
          onVideoVisibleRef.current(loadedVideoRef.current);
          const iframe = event.target.getIframe();
          iframe.setAttribute("title", titleRef.current);
          iframe.setAttribute("tabindex", "-1");
        },
        onStateChange(event) {
          if (event.data === YOUTUBE_PLAYER_STATE_ENDED) {
            const endedVideoKey =
              event.target.getVideoData().video_id ?? loadedVideoRef.current;
            // The same iframe is reused across the feed, so an ENDED event
            // from the outgoing trailer must never restart beneath the next
            // slide. Menus, overlays, page visibility, and explicit Pause all
            // flow through shouldPlayRef and stop the loop as well.
            if (
              shouldPlayRef.current &&
              endedVideoKey === videoKeyRef.current &&
              endedVideoKey === loadedVideoRef.current
            ) {
              event.target.seekTo(0, true);
              event.target.playVideo();
            }
            return;
          }
          // 1 = playing, 3 = buffering. At either point the frame belongs to
          // the latest key and can replace its poster without flashing back.
          if (event.data === 1 || event.data === 3 || event.data === 5) {
            const visibleKey =
              event.target.getVideoData().video_id ?? loadedVideoRef.current;
            onVideoVisibleRef.current(visibleKey);
          }
        },
        onAutoplayBlocked() {
          onAutoplayBlockedRef.current();
        },
        onError() {
          onPlaybackErrorRef.current(loadedVideoRef.current);
        },
      },
    });

    return () => {
      const player = playerRef.current;
      readyRef.current = false;
      if (typeof player?.destroy === "function") player.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [apiReady, playerOrigin, syncPlayer]);

  return (
    <>
      <Script
        id="slate-youtube-iframe-api"
        src="https://www.youtube.com/iframe_api"
        strategy="afterInteractive"
        onReady={() => setApiReady(Boolean(window.YT?.Player))}
        onError={() => onAutoplayBlockedRef.current()}
      />
      <div ref={mountRef} className="h-full min-h-[200px] w-full bg-black" />
    </>
  );
});

function PreviewPlayer({
  item,
  index,
  playing,
  failed,
  priority,
  onPlay,
}: {
  item: TmdbPreviewItem;
  index: number;
  playing: boolean;
  failed: boolean;
  priority: boolean;
  onPlay: () => void;
}) {
  const name = titleFor(item);

  return (
    <div
      className="relative z-10 isolate flex h-full min-h-[12.5rem] w-full items-center justify-center overflow-hidden bg-transparent [container-type:size]"
    >
      <div
        data-preview-player-index={index}
        className={cn(
          "preview-player-frame relative z-10 bg-black",
          item.orientationHint === "portrait"
            ? "preview-player-portrait"
            : "preview-player-landscape",
        )}
      >
        {!playing && failed ? (
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.videoKey)}`}
            target="_blank"
            rel="noreferrer"
            className="group relative flex h-full min-h-[200px] w-full items-center justify-center overflow-hidden bg-black/35 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-label={`Watch ${name} trailer on YouTube`}
          >
            {posterUrl(item.poster_path) ? (
              <Image
                src={posterUrl(item.poster_path)!}
                alt=""
                fill
                sizes="(max-width: 767px) 80vw, 28rem"
                className="object-cover opacity-50"
                priority={priority}
              />
            ) : null}
            <span className="relative inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 text-xs font-semibold text-white shadow-xl">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Watch on YouTube
            </span>
          </a>
        ) : !playing ? (
          <button
            type="button"
            onClick={onPlay}
            className="group relative flex h-full min-h-[200px] w-full items-center justify-center overflow-hidden bg-black/35 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-label={`Play ${name} trailer`}
          >
            {posterUrl(item.poster_path) ? (
              <Image
                src={posterUrl(item.poster_path)!}
                alt=""
                fill
                sizes="(max-width: 767px) 80vw, 28rem"
                className="object-cover opacity-55 transition-opacity duration-200 group-hover:opacity-65 motion-reduce:transition-none"
                priority={priority}
              />
            ) : null}
            <span className="relative grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl">
              <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SaveControl({
  item,
  record,
  ensureSaved,
  onStatusChange,
  onMenuOpenChange,
}: {
  item: TmdbPreviewItem;
  record: SavedRecord | undefined;
  ensureSaved: () => Promise<string>;
  onStatusChange: (status: TitleStatus) => void;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = React.useTransition();

  if (record) {
    return (
      <StatusPill
        titleId={record.id}
        status={record.status}
        onStatusChange={onStatusChange}
        onOpenChange={onMenuOpenChange}
        triggerClassName="h-11 shrink-0 px-4 font-semibold"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await ensureSaved();
            toast.success(`${titleFor(item)} is in your library`);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not add title",
            );
          }
        });
      }}
      className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[0_12px_32px_-18px_hsl(var(--primary))] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 max-[359px]:w-11 max-[359px]:px-0 motion-reduce:active:scale-100"
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      <span className="max-[359px]:sr-only">
        {pending ? "Adding…" : "Up Next"}
      </span>
    </button>
  );
}

function PreviewSlide({
  item,
  index,
  selected,
  playerVisible,
  playbackFailed,
  playerReady,
  playbackEnabled,
  soundEnabled,
  lists,
  savedRecord,
  ensureSaved,
  onStatusChange,
  onEnablePlayback,
  onTogglePlayback,
  onToggleSound,
  onDetail,
  onListIntent,
  onMenuOpenChange,
}: {
  item: TmdbPreviewItem;
  index: number;
  selected: boolean;
  playerVisible: boolean;
  playbackFailed: boolean;
  playerReady: boolean;
  playbackEnabled: boolean;
  soundEnabled: boolean;
  lists: { id: string; name: string }[];
  savedRecord: SavedRecord | undefined;
  ensureSaved: () => Promise<string>;
  onStatusChange: (status: TitleStatus) => void;
  onEnablePlayback: () => void;
  onTogglePlayback: () => void;
  onToggleSound: () => void;
  onDetail: () => void;
  onListIntent: () => void;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const overlay = useDiscoverTitleOverlay();
  const name = titleFor(item);
  const year = yearFor(item);
  const genre = primaryGenre(item);
  const mediaLabel = item.media_type === "movie" ? "Film" : "Series";
  const anchorId = `preview-title-${item.media_type}-${item.id}`;
  const isSaved = Boolean(savedRecord);
  return (
    <article
      id={`preview-${index + 1}`}
      data-preview-index={index}
      role="group"
      aria-label={`${name} trailer`}
      aria-roledescription="slide"
      inert={selected ? undefined : true}
      className="preview-feed-slide relative isolate grid h-full min-h-full snap-start snap-always grid-rows-[minmax(12.5rem,1fr)_auto] gap-0 overflow-hidden pt-[max(0.5rem,env(safe-area-inset-top))] pb-[var(--preview-dock-clearance,0.5rem)]"
    >
      <PreviewPlayer
        item={item}
        index={index}
        playing={playerVisible}
        failed={playbackFailed}
        priority={index < 2}
        onPlay={onEnablePlayback}
      />

      <div className="preview-feed-info relative z-30 mx-auto h-fit min-h-0 w-full max-w-[64rem] min-w-0 self-end overflow-hidden px-4 pt-7 pb-2 text-white sm:px-6 md:px-8 md:pt-8">
        <div className="preview-feed-kicker flex items-start">
          <span
            className={cn(
              "inline-flex items-center font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.14em]",
              SOURCE_TONES[item.source],
            )}
          >
            {SOURCE_LABELS[item.source]}
          </span>
        </div>

        <h1 className="preview-feed-title mt-2 line-clamp-2 text-[clamp(1.4rem,5vw,2.25rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
          {name}
        </h1>

        <p className="preview-feed-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 sm:mt-2">
          {year ? <span>{year}</span> : null}
          {year ? <span aria-hidden>·</span> : null}
          <span>{mediaLabel}</span>
          {genre ? <span aria-hidden>·</span> : null}
          {genre ? <span>{genre}</span> : null}
          {item.vote_average ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.vote_average.toFixed(1)}</span>
            </>
          ) : null}
        </p>

        <div className="preview-feed-actions mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide sm:gap-2.5">
          <SaveControl
            item={item}
            record={savedRecord}
            ensureSaved={ensureSaved}
            onStatusChange={onStatusChange}
            onMenuOpenChange={onMenuOpenChange}
          />
          <AddTitleToListButton
            titleId={savedRecord?.id}
            ensureTitleId={ensureSaved}
            lists={lists}
            variant="icon"
            onOpenChange={(open) => {
              onMenuOpenChange(open);
              if (open) onListIntent();
            }}
          />
          <button
            id={anchorId}
            type="button"
            onPointerEnter={() => overlay?.prefetch(item)}
            onFocus={() => overlay?.prefetch(item)}
            onClick={() => {
              onDetail();
              overlay?.open(item, isSaved, anchorId);
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/85 text-foreground shadow-sm transition-[background-color,border-color,transform] duration-150 hover:border-primary/40 hover:bg-card active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:active:scale-100"
            aria-label={`View details for ${name}`}
            title="View details"
          >
            <Info className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!playerReady}
            onClick={onTogglePlayback}
            className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-45"
            aria-label={playbackEnabled ? "Pause previews" : "Play previews"}
            title={playbackEnabled ? "Pause previews" : "Play previews"}
          >
            {playbackEnabled ? (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            disabled={!playerReady}
            onClick={onToggleSound}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-45"
            aria-label={soundEnabled ? "Mute previews" : "Unmute previews"}
            title={soundEnabled ? "Mute previews" : "Unmute previews"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" aria-hidden />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export function PreviewsFeed({
  items: initialItems,
  attemptedKeys: initialAttemptedKeys,
  lists,
  playerOrigin,
  profileKey = "local",
  sessionSeed: initialSessionSeed,
  initialPreferences,
}: PreviewsFeedProps) {
  const overlay = useDiscoverTitleOverlay();
  const [memorySession] = React.useState(() =>
    readInMemoryPreviewSession(profileKey),
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
  const batchIndexRef = React.useRef(memorySession?.batchIndex ?? 1);
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
    () => items.map(itemKey).sort().join("|"),
    [items],
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
    useAvailableFeedHeight(hostRef);
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
    memorySession?.soundEnabled ?? true,
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
  const playbackIndex = activePlayerIndex ?? activeIndex;
  const playbackItem = items[playbackIndex] ?? null;
  const playbackFailed = Boolean(
    playbackItem && failedVideoKeys.has(playbackItem.videoKey),
  );
  const playerShellVisible = Boolean(
    playbackItem &&
      !playbackFailed &&
      activePlayerIndex != null &&
      pageVisible &&
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
  }, [profileKey]);

  const persistPreviewSession = React.useCallback(() => {
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
  }, [profileKey]);

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
  }, [learningStorageKey, profileKey]);

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
  }, []);

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
  }, [acceptFeedbackSnapshot, buildFeedbackPayload]);

  React.useEffect(() => {
    syncRemainingFeedbackRef.current = syncRemainingFeedback;
  }, [syncRemainingFeedback]);

  React.useEffect(() => {
    const fallbackSessionId = randomId();
    if (!sessionSeedRef.current) sessionSeedRef.current = fallbackSessionId;
    if (!sessionIdRef.current) sessionIdRef.current = fallbackSessionId;

    const localState = readLearningState(learningStorageKey);
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
  }, [initialPreferences, learningStorageKey, persistLearningNow]);

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
    if (!item || !pageVisible) return;
    const current = activeVisitRef.current;
    if (current && itemKey(current.item) === itemKey(item)) return;
    finishActiveVisit();
    startActiveVisit(item, true);
  }, [activeIndex, finishActiveVisit, pageVisible, startActiveVisit]);

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

  React.useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const restoreItemKey = restoreScrollItemKeyRef.current;
    if (restoreItemKey) {
      const restoreIndex = items.findIndex(
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
  }, [frameHeight, items]);

  useFloatingPlayerGeometry({
    hostRef,
    scrollerRef,
    playerShellRef,
    desktopNavigationRef,
    activeIndex: activePlayerIndex,
    navigationIndex: activeIndex,
    visible: playerShellVisible,
    frameHeight,
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
  }, []);

  const handlePlaybackError = React.useCallback((videoKey: string) => {
    if (failedVideoKeysRef.current.has(videoKey)) return;
    const next = new Set(failedVideoKeysRef.current);
    next.add(videoKey);
    failedVideoKeysRef.current = next;
    setFailedVideoKeys(next);
    toast.error("This trailer cannot play here. You can still open it on YouTube.");
  }, []);

  React.useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      if (!visible) {
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
        if (Number.isFinite(next)) {
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
    if (!learningReadyRef.current) return;
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
      const removeFromStart = Math.min(overflow, safelyRemovable);
      commitFeedItems(expanded.slice(removeFromStart), removeFromStart);
      return rankedUnique.length;
    },
    [commitFeedItems],
  );

  const replayArchivedPreviews = React.useCallback(() => {
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
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setLoadRevision((revision) => revision + 1);
    }, delay);
  }, []);

  const requestMorePreviews = React.useCallback(async () => {
    const attemptedHistory = attemptedHistoryRef.current;
    if (!attemptedHistory || loadingMoreRef.current) return;
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
      const batch = await loadMorePreviews(attemptedHistory.order, context);
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
  ]);

  React.useEffect(() => {
    if (
      !pageVisible ||
      items.length === 0 ||
      activeIndex < Math.max(0, items.length - PREVIEW_LOAD_AHEAD)
    ) {
      return;
    }
    void requestMorePreviews();
  }, [activeIndex, items, loadRevision, pageVisible, requestMorePreviews]);

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
      if (!scroller || items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const target = scroller.querySelector<HTMLElement>(
        `[data-preview-index="${clamped}"]`,
      );
      target?.scrollIntoView({
        block: "start",
        behavior:
          behavior === "smooth" && reducedMotion === false ? "smooth" : "auto",
      });
    },
    [items.length, reducedMotion],
  );

  if (items.length === 0) {
    return (
      <div
        data-previews-feed
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
        data-previews-feed
        className="flex min-h-0 w-full items-center justify-center bg-[#050608] px-6 text-center"
        style={{ height: `${frameHeight}px` }}
      >
        <p className="text-xs leading-5 text-white/55">
          Rotate your device to keep previews and their controls visible.
        </p>
      </div>
    );
  }

  const ambientItem = items[activeIndex] ?? items[0];
  const ambientBackdrop = ambientItem
    ? backdropUrl(ambientItem.backdrop_path, "w300") ??
      posterUrl(ambientItem.poster_path)
    : null;

  return (
    <div
      ref={hostRef}
      data-previews-feed
      className="group/previews relative min-h-0 w-full overflow-hidden bg-[#050608]"
      style={frameHeight ? { height: `${frameHeight}px` } : { height: "100%" }}
    >
      {ambientBackdrop ? (
        <Image
          key={ambientBackdrop}
          src={ambientBackdrop}
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none z-0 scale-125 object-cover opacity-45 blur-xl saturate-125"
          priority={activeIndex === 0}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,5,8,0.30),rgba(4,5,8,0.38)_46%,rgba(4,5,8,0.68)_86%,rgba(4,5,8,0.82))]" />
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
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(activeIndex + 1, "auto");
          } else if (
            event.key === "ArrowUp" ||
            event.key === "PageUp" ||
            (key === "k" && !hasCommandModifier)
          ) {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(activeIndex - 1, "auto");
          } else if (event.key === "Home") {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(0, "auto");
          } else if (event.key === "End") {
            event.preventDefault();
            dismissDesktopScrollHint();
            moveTo(items.length - 1, "auto");
          }
        }}
        className={cn(
          "relative z-10 h-full min-h-0 touch-pan-y snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        )}
      >
        <p id="preview-feed-instructions" className="sr-only">
          Swipe or scroll up and down. On a keyboard, use the Up and Down arrow
          keys, Page Up and Page Down, or J and K. Previous and next preview
          buttons are also available.
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Now showing {titleFor(items[activeIndex])}
        </p>
        <div className="preview-feed-a11y-navigation pointer-events-none fixed right-4 bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] z-[80] flex gap-2 opacity-0 transition-opacity focus-within:opacity-100">
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
        </div>
        {items.map((item, index) => {
          const key = itemKey(item);
          const record = overlay?.savedRecord(item) ?? saved.get(key);
          return (
            <PreviewSlide
              key={key}
              item={item}
              index={index}
              selected={index === activeIndex}
              playerVisible={
                index === activePlayerIndex && playerShellVisible
              }
              playbackFailed={failedVideoKeys.has(item.videoKey)}
              playerReady={playerReady && !failedVideoKeys.has(item.videoKey)}
              playbackEnabled={playbackEnabled && pageVisible}
              soundEnabled={soundEnabled}
              lists={lists}
              savedRecord={record}
              ensureSaved={() => ensureSaved(item)}
              onStatusChange={(status) => {
                const current = savedRef.current.get(key);
                const next = current
                  ? { ...current, status }
                  : record
                    ? { ...record, status }
                    : null;
                if (!next) return;
                rememberSaved(key, next);
                overlay?.markSaved(item, next);
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
              onDetail={() => recordSignal(item, "details", 0.7, true)}
              onListIntent={() =>
                recordSignal(item, "listIntents", 0.85, true)
              }
              onMenuOpenChange={setMenuOpen}
            />
          );
        })}
      </div>
      <div
        ref={desktopNavigationRef}
        className={cn(
          "preview-desktop-navigation pointer-events-none invisible absolute left-0 top-0 z-40 w-12 flex-col items-stretch gap-2 opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] [backface-visibility:hidden]",
          desktopScrollHintVisible
            ? "opacity-100"
            : "group-hover/previews:opacity-70 focus-within:opacity-100",
        )}
        role="group"
        aria-label="Preview navigation"
      >
        {desktopScrollHintVisible ? (
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
          disabled={activeIndex === 0}
          onClick={() => {
            dismissDesktopScrollHint();
            moveTo(activeIndex - 1);
          }}
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/55 transition-[background-color,border-color,color,transform] duration-150 hover:border-white/15 hover:bg-black/35 hover:text-white/85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-20 motion-reduce:active:scale-100"
          aria-label="Previous preview"
          title="Previous preview (K or Up Arrow)"
        >
          <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          disabled={activeIndex === items.length - 1}
          onClick={() => {
            dismissDesktopScrollHint();
            moveTo(activeIndex + 1);
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
          className="pointer-events-none invisible absolute left-0 top-0 z-20 bg-black opacity-0 will-change-transform"
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
