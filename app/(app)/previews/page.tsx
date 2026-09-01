import { createHash, randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { DiscoverTitleOverlayProvider } from "@/components/discover-title-overlay";
import { PreviewsFeed } from "@/components/previews-feed";
import { getLibraryClient, getLibraryOwnerId } from "@/lib/library-db";
import { getAllLibraryTitleKeys } from "@/lib/library-title-keys";
import { getPreviewFeedbackProfile } from "@/lib/preview-feedback";
import { getPreviewFeedBatch } from "@/lib/tmdb";

export const metadata: Metadata = {
  title: "Previews · slate",
  description: "Swipe through trailers picked from your taste and what is popular now.",
};

const PREVIEW_RECENT_COOKIE = "slate_preview_recent_v1";
const PREVIEW_KEY_PATTERN = /^(?:movie|tv):[1-9]\d*$/;

function recentPreviewKeys(raw: string | undefined, profileKey: string): string[] {
  if (!raw) return [];
  const candidates = [raw];
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) candidates.unshift(decoded);
  } catch {
    // A malformed optional cookie should never block the feed.
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        version?: unknown;
        profileKey?: unknown;
        keys?: unknown;
      };
      if (
        parsed.version !== 1 ||
        parsed.profileKey !== profileKey ||
        !Array.isArray(parsed.keys)
      ) {
        continue;
      }
      return [...new Set(parsed.keys)]
        .filter(
          (key): key is string =>
            typeof key === "string" && PREVIEW_KEY_PATTERN.test(key),
        )
        .slice(-96);
    } catch {
      // Try the alternative encoded/raw representation above.
    }
  }
  return [];
}

export default async function PreviewsPage() {
  const [requestHeaders, cookieStore, ownerId, db] = await Promise.all([
    headers(),
    cookies(),
    getLibraryOwnerId(),
    getLibraryClient(),
  ]);
  const forwardedHost =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const host = forwardedHost.split(",")[0]?.trim() ?? "";
  const forwardedProtocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https";
  const playerOrigin = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)
    ? `${protocol}://${host}`
    : undefined;
  const [savedKeys, listsResult, feedbackProfile] = await Promise.all([
    getAllLibraryTitleKeys(db),
    db.from("lists").select("id, name").order("name"),
    getPreviewFeedbackProfile(),
  ]);

  if (listsResult.error) throw new Error(listsResult.error.message);
  const profileKey = createHash("sha256")
    .update(ownerId, "utf8")
    .digest("hex")
    .slice(0, 24);
  const browserExposureKeys = recentPreviewKeys(
    cookieStore.get(PREVIEW_RECENT_COOKIE)?.value,
    profileKey,
  );
  const exposureKeys = [
    ...new Set([...feedbackProfile.exposureKeys, ...browserExposureKeys]),
  ];
  const sessionSeed = randomUUID();
  const feedOptions = {
    sessionSeed,
    batchIndex: 0,
    adaptiveWeights: feedbackProfile.preferences,
    softExcludedKeys: new Set(exposureKeys),
  } as const;
  const batch = await getPreviewFeedBatch(savedKeys, feedOptions);
  const lists = (listsResult.data ?? []).map((list) => ({
    id: String(list.id),
    name: String(list.name),
  }));

  return (
    <DiscoverTitleOverlayProvider>
      <PreviewsFeed
        items={batch.items}
        attemptedKeys={batch.attemptedKeys}
        lists={lists}
        playerOrigin={playerOrigin}
        profileKey={profileKey}
        sessionSeed={sessionSeed}
        initialPreferences={feedbackProfile.preferences}
      />
    </DiscoverTitleOverlayProvider>
  );
}
