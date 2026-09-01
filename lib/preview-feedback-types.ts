export const PREVIEW_SOURCES = [
  "library",
  "trending",
  "now_playing",
] as const;

export type PreviewSource = (typeof PREVIEW_SOURCES)[number];
export type PreviewMediaType = "movie" | "tv";

/**
 * Preference deltas consumed by the preview ranker. Zero is neutral and every
 * value is bounded to [-1, 1]. Genre keys are TMDB numeric genre ids.
 */
export interface PreviewPreferenceWeights {
  source: Record<PreviewSource, number>;
  genre: Record<string, number>;
  mediaType: Record<PreviewMediaType, number>;
}

export interface PreviewFeedbackStat {
  views: number;
  /** Sum of bounded per-view scores, so this must stay within +/- views. */
  score: number;
}

export interface PreviewExposureSummary {
  key: string;
  lastSeenAt: string;
  viewCount: number;
  /** Sum of bounded per-view scores, so this must stay within +/- viewCount. */
  score: number;
}

export interface PreviewFeedbackEvents {
  meaningfulViews: number;
  fastSkips: number;
  unmutes: number;
  details: number;
  saves: number;
  listIntents: number;
}

/**
 * One bounded aggregate collected in memory and sent at most once when that
 * aggregate is drained. It is deliberately not a raw swipe/event stream.
 */
export interface PreviewFeedbackPayload {
  sessionId: string;
  batchId: string;
  startedAt: string;
  sentAt: string;
  impressions: number;
  events: PreviewFeedbackEvents;
  source: Record<PreviewSource, PreviewFeedbackStat>;
  genres: Record<string, PreviewFeedbackStat>;
  mediaTypes: Record<PreviewMediaType, PreviewFeedbackStat>;
  exposures: PreviewExposureSummary[];
}

/** Context supplied only when the client requests another 24-title deck. */
export interface PreviewLoadContext {
  sessionSeed: string;
  batchIndex: number;
  exposureKeys: string[];
  preferences: PreviewPreferenceWeights;
  /** Optional dirty aggregate piggybacked to avoid another Function request. */
  feedback?: PreviewFeedbackPayload;
}

export interface PreviewFeedbackSyncResult {
  /** False only when the additive migration has not reached this deployment. */
  persisted: boolean;
  duplicate: boolean;
  preferences: PreviewPreferenceWeights;
}

export interface PreviewFeedbackProfile {
  preferences: PreviewPreferenceWeights;
  /** Newest-first, bounded cross-device cooldown window. */
  exposureKeys: string[];
}

export function neutralPreviewPreferences(): PreviewPreferenceWeights {
  return {
    source: { library: 0, trending: 0, now_playing: 0 },
    genre: {},
    mediaType: { movie: 0, tv: 0 },
  };
}
