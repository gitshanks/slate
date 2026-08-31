import type { Metadata } from "next";
import { headers } from "next/headers";
import { DiscoverTitleOverlayProvider } from "@/components/discover-title-overlay";
import { PreviewsFeed } from "@/components/previews-feed";
import { getLibraryClient } from "@/lib/library-db";
import { getPreviewFeedBatch } from "@/lib/tmdb";

export const metadata: Metadata = {
  title: "Previews · slate",
  description: "Swipe through trailers picked from your taste and what is popular now.",
};

export default async function PreviewsPage() {
  const requestHeaders = await headers();
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
  const db = await getLibraryClient();
  const [savedResult, listsResult] = await Promise.all([
    db
      .from("titles")
      .select("tmdb_id, media_type")
      .order("updated_at", { ascending: false })
      .limit(1000),
    db.from("lists").select("id, name").order("name"),
  ]);

  if (savedResult.error) throw new Error(savedResult.error.message);
  if (listsResult.error) throw new Error(listsResult.error.message);

  const excludedKeys = new Set(
    (savedResult.data ?? []).map((row) =>
      `${row.media_type === "tv" ? "tv" : "movie"}:${Number(row.tmdb_id)}`,
    ),
  );
  const batch = await getPreviewFeedBatch(excludedKeys);
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
      />
    </DiscoverTitleOverlayProvider>
  );
}
