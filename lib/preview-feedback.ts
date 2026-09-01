import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLibraryClient } from "@/lib/library-db";
import {
  PREVIEW_SOURCES,
  neutralPreviewPreferences,
  type PreviewExposureSummary,
  type PreviewFeedbackEvents,
  type PreviewFeedbackPayload,
  type PreviewFeedbackProfile,
  type PreviewFeedbackStat,
  type PreviewFeedbackSyncResult,
  type PreviewLoadContext,
  type PreviewMediaType,
  type PreviewPreferenceWeights,
  type PreviewSource,
} from "@/lib/preview-feedback-types";

const PREVIEW_KEY_PATTERN = /^(?:movie|tv):[1-9]\d*$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const GENRE_ID_PATTERN = /^[1-9]\d{0,5}$/;

const MAX_BATCH_IMPRESSIONS = 2_000;
const MAX_EXPOSURE_VIEW_COUNT = 10_000;
const MAX_FEEDBACK_GENRES = 32;
const MAX_FEEDBACK_EXPOSURES = 240;
const MAX_LOAD_EXPOSURES = 240;
const MAX_BATCH_IDS = 16;
const MAX_STORED_EXPOSURES = 240;
const MAX_STORED_TOTAL = Number.MAX_SAFE_INTEGER;
const MAX_PERSIST_ATTEMPTS = 8;
const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_FEEDBACK_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 15 * 60 * 1_000;
const HARD_EXPOSURE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;
const STORED_EXPOSURE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1_000;

const EVENT_KEYS: readonly (keyof PreviewFeedbackEvents)[] = [
  "meaningfulViews",
  "fastSkips",
  "unmutes",
  "details",
  "saves",
  "listIntents",
];

const MEDIA_TYPES: readonly PreviewMediaType[] = ["movie", "tv"];

interface StoredExposure {
  key: string;
  lastSeenAt: string;
  viewCount: number;
  /** Normalized EMA in [-1, 1], unlike the submitted aggregate sum. */
  score: number;
}

interface StoredTotals {
  sessions: number;
  batches: number;
  impressions: number;
  events: PreviewFeedbackEvents;
}

interface PreviewFeedbackRow {
  revision?: unknown;
  source_weights?: unknown;
  genre_weights?: unknown;
  media_type_weights?: unknown;
  recent_exposures?: unknown;
  totals?: unknown;
  recent_batch_ids?: unknown;
  last_session_id?: unknown;
}

interface FeedbackReadResult {
  available: boolean;
  row: PreviewFeedbackRow | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundedWeight(value: number): number {
  return Math.round(clamp(value, -1, 1) * 10_000) / 10_000;
}

function boundedInteger(value: unknown, label: string, max: number): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max) {
    throw new Error(`Invalid ${label}`);
  }
  return Number(value);
}

function boundedWeight(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -1 || value > 1) {
    throw new Error(`Invalid ${label}`);
  }
  return roundedWeight(value);
}

function boundedId(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function normalizedTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 40) {
    throw new Error(`Invalid ${label}`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${label}`);
  return new Date(timestamp).toISOString();
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`Invalid ${label}`);
  }
}

function validateAggregateStat(
  value: unknown,
  label: string,
): PreviewFeedbackStat {
  if (!isRecord(value)) throw new Error(`Invalid ${label}`);
  assertOnlyKeys(value, new Set(["views", "score"]), label);
  const views = boundedInteger(value.views, `${label} views`, MAX_BATCH_IMPRESSIONS);
  const score = value.score;
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < -views ||
    score > views
  ) {
    throw new Error(`Invalid ${label} score`);
  }
  return { views, score: Math.round(score * 10_000) / 10_000 };
}

function validateFixedStats<K extends string>(
  value: unknown,
  keys: readonly K[],
  label: string,
): Record<K, PreviewFeedbackStat> {
  if (!isRecord(value)) throw new Error(`Invalid ${label}`);
  assertOnlyKeys(value, new Set(keys), label);
  return Object.fromEntries(
    keys.map((key) => [
      key,
      value[key] == null
        ? { views: 0, score: 0 }
        : validateAggregateStat(value[key], `${label} ${key}`),
    ]),
  ) as Record<K, PreviewFeedbackStat>;
}

function validateGenreStats(value: unknown): Record<string, PreviewFeedbackStat> {
  if (!isRecord(value)) throw new Error("Invalid preview genre feedback");
  const entries = Object.entries(value);
  if (entries.length > MAX_FEEDBACK_GENRES) {
    throw new Error("Too many preview genre signals");
  }
  const result: Record<string, PreviewFeedbackStat> = {};
  for (const [genreId, stat] of entries) {
    if (!GENRE_ID_PATTERN.test(genreId)) {
      throw new Error("Invalid preview genre id");
    }
    result[genreId] = validateAggregateStat(stat, `genre ${genreId}`);
  }
  return result;
}

function validateEvents(value: unknown): PreviewFeedbackEvents {
  if (!isRecord(value)) throw new Error("Invalid preview feedback events");
  assertOnlyKeys(value, new Set(EVENT_KEYS), "preview feedback events");
  return Object.fromEntries(
    EVENT_KEYS.map((key) => [
      key,
      boundedInteger(value[key], `preview ${key}`, MAX_BATCH_IMPRESSIONS),
    ]),
  ) as unknown as PreviewFeedbackEvents;
}

function validateExposure(value: unknown): PreviewExposureSummary {
  if (!isRecord(value)) throw new Error("Invalid preview exposure");
  assertOnlyKeys(
    value,
    new Set(["key", "lastSeenAt", "viewCount", "score"]),
    "preview exposure",
  );
  if (typeof value.key !== "string" || !PREVIEW_KEY_PATTERN.test(value.key)) {
    throw new Error("Invalid preview exposure key");
  }
  const viewCount = boundedInteger(
    value.viewCount,
    "preview exposure count",
    MAX_EXPOSURE_VIEW_COUNT,
  );
  if (viewCount < 1) throw new Error("Invalid preview exposure count");
  if (
    typeof value.score !== "number" ||
    !Number.isFinite(value.score) ||
    value.score < -viewCount ||
    value.score > viewCount
  ) {
    throw new Error("Invalid preview exposure score");
  }
  return {
    key: value.key,
    lastSeenAt: normalizedTimestamp(value.lastSeenAt, "preview exposure time"),
    viewCount,
    score: Math.round(value.score * 10_000) / 10_000,
  };
}

export function validatePreviewFeedbackPayload(
  value: unknown,
): PreviewFeedbackPayload {
  if (!isRecord(value)) throw new Error("Invalid preview feedback");
  assertOnlyKeys(
    value,
    new Set([
      "sessionId",
      "batchId",
      "startedAt",
      "sentAt",
      "impressions",
      "events",
      "source",
      "genres",
      "mediaTypes",
      "exposures",
    ]),
    "preview feedback",
  );

  const startedAt = normalizedTimestamp(value.startedAt, "preview session start");
  const sentAt = normalizedTimestamp(value.sentAt, "preview feedback time");
  const startedMs = Date.parse(startedAt);
  const sentMs = Date.parse(sentAt);
  const now = Date.now();
  if (
    startedMs > sentMs + MAX_CLOCK_SKEW_MS ||
    sentMs - startedMs > MAX_SESSION_AGE_MS ||
    sentMs < now - MAX_FEEDBACK_AGE_MS ||
    sentMs > now + MAX_CLOCK_SKEW_MS
  ) {
    throw new Error("Invalid preview feedback time range");
  }

  if (!Array.isArray(value.exposures) || value.exposures.length > MAX_FEEDBACK_EXPOSURES) {
    throw new Error("Invalid preview exposure summary");
  }
  const exposures = value.exposures.map(validateExposure);
  if (new Set(exposures.map(({ key }) => key)).size !== exposures.length) {
    throw new Error("Duplicate preview exposure");
  }
  if (
    exposures.some(({ lastSeenAt }) => {
      const exposureMs = Date.parse(lastSeenAt);
      return (
        exposureMs > sentMs + MAX_CLOCK_SKEW_MS ||
        exposureMs < sentMs - STORED_EXPOSURE_MAX_AGE_MS
      );
    })
  ) {
    throw new Error("Invalid preview exposure time range");
  }

  return {
    sessionId: boundedId(value.sessionId, "preview session id"),
    batchId: boundedId(value.batchId, "preview feedback batch id"),
    startedAt,
    sentAt,
    impressions: boundedInteger(
      value.impressions,
      "preview impression count",
      MAX_BATCH_IMPRESSIONS,
    ),
    events: validateEvents(value.events),
    source: validateFixedStats(value.source, PREVIEW_SOURCES, "preview source feedback"),
    genres: validateGenreStats(value.genres),
    mediaTypes: validateFixedStats(
      value.mediaTypes,
      MEDIA_TYPES,
      "preview media feedback",
    ),
    exposures,
  };
}

function validatePreferenceWeights(value: unknown): PreviewPreferenceWeights {
  if (!isRecord(value)) throw new Error("Invalid preview preferences");
  assertOnlyKeys(
    value,
    new Set(["source", "genre", "mediaType"]),
    "preview preferences",
  );
  if (!isRecord(value.source) || !isRecord(value.genre) || !isRecord(value.mediaType)) {
    throw new Error("Invalid preview preferences");
  }
  const sourceValue = value.source;
  const genreValue = value.genre;
  const mediaTypeValue = value.mediaType;
  assertOnlyKeys(sourceValue, new Set(PREVIEW_SOURCES), "preview source preferences");
  assertOnlyKeys(mediaTypeValue, new Set(MEDIA_TYPES), "preview media preferences");

  const genreEntries = Object.entries(genreValue);
  if (genreEntries.length > MAX_FEEDBACK_GENRES) {
    throw new Error("Too many preview genre preferences");
  }
  const genre: Record<string, number> = {};
  for (const [genreId, weight] of genreEntries) {
    if (!GENRE_ID_PATTERN.test(genreId)) throw new Error("Invalid preview genre preference");
    genre[genreId] = boundedWeight(weight, `preview genre ${genreId} preference`);
  }

  return {
    source: Object.fromEntries(
      PREVIEW_SOURCES.map((source) => [
        source,
        boundedWeight(sourceValue[source] ?? 0, `preview source ${source} preference`),
      ]),
    ) as Record<PreviewSource, number>,
    genre,
    mediaType: Object.fromEntries(
      MEDIA_TYPES.map((mediaType) => [
        mediaType,
        boundedWeight(
          mediaTypeValue[mediaType] ?? 0,
          `preview media ${mediaType} preference`,
        ),
      ]),
    ) as Record<PreviewMediaType, number>,
  };
}

export function validatePreviewLoadContext(value: unknown): PreviewLoadContext {
  if (!isRecord(value)) throw new Error("Invalid preview load context");
  assertOnlyKeys(
    value,
    new Set([
      "sessionSeed",
      "batchIndex",
      "exposureKeys",
      "preferences",
      "feedback",
    ]),
    "preview load context",
  );
  if (!Array.isArray(value.exposureKeys) || value.exposureKeys.length > MAX_LOAD_EXPOSURES) {
    throw new Error("Invalid preview exposure keys");
  }
  if (
    value.exposureKeys.some(
      (key) => typeof key !== "string" || !PREVIEW_KEY_PATTERN.test(key),
    )
  ) {
    throw new Error("Invalid preview exposure key");
  }

  return {
    sessionSeed: boundedId(value.sessionSeed, "preview session seed"),
    batchIndex: boundedInteger(value.batchIndex, "preview batch index", 10_000),
    exposureKeys: [...new Set(value.exposureKeys)],
    preferences: validatePreferenceWeights(value.preferences),
    feedback:
      value.feedback == null
        ? undefined
        : validatePreviewFeedbackPayload(value.feedback),
  };
}

function readWeightMap(
  value: unknown,
  allowedKeys?: ReadonlySet<string>,
): Record<string, number> {
  if (!isRecord(value)) return {};
  const entries: Array<[string, number]> = [];
  for (const [key, raw] of Object.entries(value)) {
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (!allowedKeys && !GENRE_ID_PATTERN.test(key)) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    entries.push([key, roundedWeight(raw)]);
  }
  return Object.fromEntries(entries);
}

function preferencesFromRow(row: PreviewFeedbackRow | null): PreviewPreferenceWeights {
  const neutral = neutralPreviewPreferences();
  if (!row) return neutral;
  const source = readWeightMap(row.source_weights, new Set(PREVIEW_SOURCES));
  const mediaType = readWeightMap(row.media_type_weights, new Set(MEDIA_TYPES));
  const genres = Object.entries(readWeightMap(row.genre_weights))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, MAX_FEEDBACK_GENRES);
  return {
    source: {
      library: source.library ?? 0,
      trending: source.trending ?? 0,
      now_playing: source.now_playing ?? 0,
    },
    genre: Object.fromEntries(genres),
    mediaType: {
      movie: mediaType.movie ?? 0,
      tv: mediaType.tv ?? 0,
    },
  };
}

function readStoredExposures(value: unknown): StoredExposure[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: StoredExposure[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.key !== "string") continue;
    if (!PREVIEW_KEY_PATTERN.test(entry.key) || seen.has(entry.key)) continue;
    if (typeof entry.lastSeenAt !== "string" || !Number.isFinite(Date.parse(entry.lastSeenAt))) {
      continue;
    }
    if (!Number.isInteger(entry.viewCount) || Number(entry.viewCount) < 1) continue;
    if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) continue;
    seen.add(entry.key);
    result.push({
      key: entry.key,
      lastSeenAt: new Date(entry.lastSeenAt).toISOString(),
      viewCount: clamp(Number(entry.viewCount), 1, MAX_EXPOSURE_VIEW_COUNT),
      score: roundedWeight(entry.score),
    });
    if (result.length >= MAX_STORED_EXPOSURES) break;
  }
  return result.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
}

function missingFeedbackTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  const expectedColumn =
    /\b(?:revision|source_weights|genre_weights|media_type_weights|recent_exposures|totals|recent_batch_ids|last_session_id|last_started_at|updated_at)\b/i;
  return (
    code === "42P01" ||
    (code === "42703" && expectedColumn.test(message)) ||
    /supabase is not configured/i.test(message) ||
    /preview_feedback/i.test(message) &&
      /does not exist|schema cache|could not find|unknown table/i.test(message)
  );
}

function feedbackRevision(row: PreviewFeedbackRow | null): number {
  const value = row?.revision;
  const revision =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : 0;
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function noRowsAffected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  return code === "PGRST116" || /(?:contains|returned?)\s+0 rows|row not found/i.test(message);
}

function uniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  return code === "23505" || /duplicate key|unique constraint/i.test(message);
}

async function readFeedbackRow(db: SupabaseClient): Promise<FeedbackReadResult> {
  const { data, error } = await db
    .from("preview_feedback")
    .select(
      "revision, source_weights, genre_weights, media_type_weights, recent_exposures, totals, recent_batch_ids, last_session_id",
    )
    .limit(1);
  if (error) {
    if (missingFeedbackTable(error)) return { available: false, row: null };
    throw new Error(error.message);
  }
  return {
    available: true,
    row:
      Array.isArray(data) && isRecord(data[0])
        ? (data[0] as PreviewFeedbackRow)
        : isRecord(data)
          ? (data as PreviewFeedbackRow)
          : null,
  };
}

export async function getPreviewFeedbackProfile(): Promise<PreviewFeedbackProfile> {
  const db = await getLibraryClient();
  const { row } = await readFeedbackRow(db);
  const hardCooldownCutoff = Date.now() - HARD_EXPOSURE_COOLDOWN_MS;
  return {
    preferences: preferencesFromRow(row),
    exposureKeys: readStoredExposures(row?.recent_exposures)
      .filter(({ lastSeenAt }) => Date.parse(lastSeenAt) >= hardCooldownCutoff)
      .map(({ key }) => key),
  };
}

/** One initial-render read; callers pass the result through later refills. */
export async function getPreviewPreferences(): Promise<PreviewPreferenceWeights> {
  return (await getPreviewFeedbackProfile()).preferences;
}

function nextEma(current: number, incoming: PreviewFeedbackStat): number {
  if (incoming.views === 0) return roundedWeight(current);
  const observed = clamp(incoming.score / incoming.views, -1, 1);
  const alpha = clamp(0.14 + incoming.views * 0.035, 0.14, 0.5);
  return roundedWeight(current * (1 - alpha) + observed * alpha);
}

function mergePreferences(
  current: PreviewPreferenceWeights,
  payload: PreviewFeedbackPayload,
): PreviewPreferenceWeights {
  const genre: Record<string, number> = { ...current.genre };
  for (const [genreId, stat] of Object.entries(payload.genres)) {
    genre[genreId] = nextEma(genre[genreId] ?? 0, stat);
  }
  const trimmedGenres = Object.entries(genre)
    .filter(([, weight]) => Math.abs(weight) >= 0.005)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, MAX_FEEDBACK_GENRES);
  return {
    source: {
      library: nextEma(current.source.library, payload.source.library),
      trending: nextEma(current.source.trending, payload.source.trending),
      now_playing: nextEma(current.source.now_playing, payload.source.now_playing),
    },
    genre: Object.fromEntries(trimmedGenres),
    mediaType: {
      movie: nextEma(current.mediaType.movie, payload.mediaTypes.movie),
      tv: nextEma(current.mediaType.tv, payload.mediaTypes.tv),
    },
  };
}

function mergeExposures(
  current: StoredExposure[],
  incoming: PreviewExposureSummary[],
): StoredExposure[] {
  const storageCutoff = Date.now() - STORED_EXPOSURE_MAX_AGE_MS;
  const byKey = new Map(
    current
      .filter(({ lastSeenAt }) => Date.parse(lastSeenAt) >= storageCutoff)
      .map((exposure) => [exposure.key, exposure]),
  );
  for (const exposure of incoming) {
    const previous = byKey.get(exposure.key);
    const incomingAverage = clamp(exposure.score / exposure.viewCount, -1, 1);
    if (!previous) {
      byKey.set(exposure.key, {
        key: exposure.key,
        lastSeenAt: exposure.lastSeenAt,
        viewCount: exposure.viewCount,
        score: roundedWeight(incomingAverage),
      });
      continue;
    }
    const combinedCount = Math.min(
      MAX_EXPOSURE_VIEW_COUNT,
      previous.viewCount + exposure.viewCount,
    );
    const score =
      (previous.score * previous.viewCount + incomingAverage * exposure.viewCount) /
      (previous.viewCount + exposure.viewCount);
    byKey.set(exposure.key, {
      key: exposure.key,
      lastSeenAt:
        Date.parse(exposure.lastSeenAt) >= Date.parse(previous.lastSeenAt)
          ? exposure.lastSeenAt
          : previous.lastSeenAt,
      viewCount: combinedCount,
      score: roundedWeight(score),
    });
  }
  return [...byKey.values()]
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .slice(0, MAX_STORED_EXPOSURES);
}

function emptyEvents(): PreviewFeedbackEvents {
  return {
    meaningfulViews: 0,
    fastSkips: 0,
    unmutes: 0,
    details: 0,
    saves: 0,
    listIntents: 0,
  };
}

function readTotals(value: unknown): StoredTotals {
  const record = isRecord(value) ? value : {};
  const events = isRecord(record.events) ? record.events : {};
  const safeTotal = (candidate: unknown): number =>
    typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0
      ? candidate
      : 0;
  return {
    sessions: safeTotal(record.sessions),
    batches: safeTotal(record.batches),
    impressions: safeTotal(record.impressions),
    events: Object.fromEntries(
      EVENT_KEYS.map((key) => [key, safeTotal(events[key])]),
    ) as unknown as PreviewFeedbackEvents,
  };
}

function saturatingAdd(a: number, b: number): number {
  return Math.min(MAX_STORED_TOTAL, a + b);
}

function mergeTotals(
  current: StoredTotals,
  payload: PreviewFeedbackPayload,
  isNewSession: boolean,
): StoredTotals {
  const events = emptyEvents();
  for (const key of EVENT_KEYS) {
    events[key] = saturatingAdd(current.events[key], payload.events[key]);
  }
  return {
    sessions: saturatingAdd(current.sessions, isNewSession ? 1 : 0),
    batches: saturatingAdd(current.batches, 1),
    impressions: saturatingAdd(current.impressions, payload.impressions),
    events,
  };
}

function readBatchIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.length <= 257)
    .slice(-MAX_BATCH_IDS);
}

export async function persistPreviewFeedback(
  db: SupabaseClient,
  payload: PreviewFeedbackPayload,
): Promise<PreviewFeedbackSyncResult> {
  const fingerprint = `${payload.sessionId}:${payload.batchId}`;

  // Each owner intentionally has one compact row, so use its monotonic
  // revision as an optimistic lock. A competing tab can win between our read
  // and write; the losing request rereads and merges its distinct batch into
  // that newer snapshot instead of silently overwriting it.
  for (let attempt = 0; attempt < MAX_PERSIST_ATTEMPTS; attempt += 1) {
    const current = await readFeedbackRow(db);
    const currentPreferences = preferencesFromRow(current.row);
    if (!current.available) {
      return { persisted: false, duplicate: false, preferences: currentPreferences };
    }

    const batchIds = readBatchIds(current.row?.recent_batch_ids);
    if (batchIds.includes(fingerprint)) {
      return { persisted: true, duplicate: true, preferences: currentPreferences };
    }

    const preferences = mergePreferences(currentPreferences, payload);
    const recentExposures = mergeExposures(
      readStoredExposures(current.row?.recent_exposures),
      payload.exposures,
    );
    const previousSessionId =
      typeof current.row?.last_session_id === "string"
        ? current.row.last_session_id
        : null;
    const totals = mergeTotals(
      readTotals(current.row?.totals),
      payload,
      previousSessionId !== payload.sessionId,
    );
    const revision = feedbackRevision(current.row);
    const nextRow = {
      revision: revision + 1,
      source_weights: preferences.source,
      genre_weights: preferences.genre,
      media_type_weights: preferences.mediaType,
      recent_exposures: recentExposures,
      totals,
      recent_batch_ids: [...batchIds, fingerprint].slice(-MAX_BATCH_IDS),
      last_session_id: payload.sessionId,
      last_started_at: payload.startedAt,
      updated_at: payload.sentAt,
    };

    if (current.row) {
      const { error } = await db
        .from("preview_feedback")
        .update(nextRow)
        .eq("revision", revision)
        .select("revision")
        .single();
      if (!error) {
        return { persisted: true, duplicate: false, preferences };
      }
      if (missingFeedbackTable(error)) {
        return { persisted: false, duplicate: false, preferences: currentPreferences };
      }
      if (noRowsAffected(error)) continue;
      throw new Error(error.message);
    }

    const { error } = await db
      .from("preview_feedback")
      .insert(nextRow)
      .select("revision")
      .single();
    if (!error) {
      return { persisted: true, duplicate: false, preferences };
    }
    if (missingFeedbackTable(error)) {
      return { persisted: false, duplicate: false, preferences: currentPreferences };
    }
    if (uniqueConflict(error)) continue;
    throw new Error(error.message);
  }

  throw new Error("Preview feedback was busy. Please try again.");
}
