import { unstable_cache } from "next/cache";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YOUTUBE = "https://www.googleapis.com/youtube/v3";
const SEARCH_SECONDS = 7 * 24 * 60 * 60;
const CHART_SECONDS = 6 * 60 * 60;
const MUSIC_CATEGORY = "10";
const RESULTS = "24";
const CHART_REGION = "US";

interface YoutubeItem {
  id: string | { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string } };
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function youtube(path: string, params: Record<string, string>, revalidate: number) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new NativeApiError(503, "configuration_error", "Music search isn't set up.");
  const url = new URL(`${YOUTUBE}/${path}`);
  url.searchParams.set("key", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const res = await fetch(url, { cache: "force-cache", next: { revalidate } });
  if (!res.ok) throw new Error(`YouTube ${res.status} ${path}`);
  const body = (await res.json()) as { items?: YoutubeItem[] };
  const tracks = (body.items ?? []).flatMap((item) => {
    const videoId = typeof item.id === "string" ? item.id : item.id.videoId;
    if (!videoId) return [];
    return [{
      videoId,
      title: decodeEntities(item.snippet?.title ?? ""),
      channel: decodeEntities(item.snippet?.channelTitle ?? ""),
      thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
    }];
  });
  // Thrown rather than returned empty, so a failure isn't cached.
  if (tracks.length === 0) throw new Error("YouTube returned no tracks");
  return tracks;
}

// A search costs 100 of YouTube's 10,000 free daily units, so each is kept for a week.
const cachedSearch = unstable_cache(
  (query: string) =>
    youtube("search", {
      part: "snippet",
      type: "video",
      videoCategoryId: MUSIC_CATEGORY,
      videoEmbeddable: "true",
      maxResults: RESULTS,
      q: query,
    }, SEARCH_SECONDS),
  ["music-search"],
  { revalidate: SEARCH_SECONDS },
);

const cachedChart = unstable_cache(
  () =>
    youtube("videos", {
      part: "snippet",
      chart: "mostPopular",
      videoCategoryId: MUSIC_CATEGORY,
      regionCode: CHART_REGION,
      maxResults: RESULTS,
    }, CHART_SECONDS),
  ["music-chart"],
  { revalidate: CHART_SECONDS },
);

/** Songs for the TV's Music page: a search with `q`, otherwise what's popular. */
export async function GET(request: Request) {
  try {
    await authenticateNativeRequest(request);
    const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (query.length > 200) {
      throw new NativeApiError(400, "bad_request", "That search is too long.");
    }
    return apiData({ tracks: await (query ? cachedSearch(query) : cachedChart()) });
  } catch (error) {
    return apiError(error);
  }
}
