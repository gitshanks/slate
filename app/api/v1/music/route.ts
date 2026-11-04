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
const PLAYLIST_SECONDS = 24 * 60 * 60;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const UNAVAILABLE = new Set(["Deleted video", "Private video"]);
const COMMUNITY_SEARCHES = [
  "top hits playlist",
  "chill vibes playlist",
  "bollywood hits playlist",
  "workout music playlist",
  "classic rock playlist",
];
const PER_COMMUNITY_SEARCH = "5";

interface YoutubeItem {
  id: string | { videoId?: string; playlistId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    videoOwnerChannelTitle?: string;
    resourceId?: { videoId?: string };
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

async function youtubeItems(path: string, params: Record<string, string>, revalidate: number) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new NativeApiError(503, "configuration_error", "Music search isn't set up.");
  const url = new URL(`${YOUTUBE}/${path}`);
  url.searchParams.set("key", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const res = await fetch(url, { cache: "force-cache", next: { revalidate } });
  if (!res.ok) throw new Error(`YouTube ${res.status} ${path}`);
  const body = (await res.json()) as { items?: YoutubeItem[] };
  return body.items ?? [];
}

async function youtube(path: string, params: Record<string, string>, revalidate: number) {
  const items = await youtubeItems(path, params, revalidate);
  const tracks = items.flatMap((item) => {
    const videoId = item.snippet?.resourceId?.videoId
      ?? (typeof item.id === "string" ? item.id : item.id.videoId);
    if (!videoId || UNAVAILABLE.has(item.snippet?.title ?? "")) return [];
    return [{
      videoId,
      title: decodeEntities(item.snippet?.title ?? ""),
      channel: decodeEntities(item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle ?? "").replace(/ - Topic$/, ""),
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

// Five searches at 100 units each, once a week.
const cachedCommunity = unstable_cache(
  async () => {
    const found = await Promise.all(COMMUNITY_SEARCHES.map((query) =>
      youtubeItems("search", { part: "snippet", type: "playlist", maxResults: PER_COMMUNITY_SEARCH, q: query }, SEARCH_SECONDS)));
    const playlists = found.flat().flatMap((item) => {
      const id = typeof item.id === "string" ? null : item.id.playlistId;
      if (!id) return [];
      return [{
        id,
        title: decodeEntities(item.snippet?.title ?? ""),
        channel: decodeEntities(item.snippet?.channelTitle ?? ""),
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
      }];
    });
    if (playlists.length === 0) throw new Error("YouTube returned no playlists");
    return playlists;
  },
  ["music-community"],
  { revalidate: SEARCH_SECONDS },
);

const cachedPlaylist = unstable_cache(
  (id: string) => youtube("playlistItems", { part: "snippet", playlistId: id, maxResults: "50" }, PLAYLIST_SECONDS),
  ["music-playlist"],
  { revalidate: PLAYLIST_SECONDS },
);

/** The TV's Music page: a search with `q`, a public playlist, the list of those, or what's popular. */
export async function GET(request: Request) {
  try {
    await authenticateNativeRequest(request);
    const params = new URL(request.url).searchParams;
    if (params.has("playlists")) return apiData({ playlists: await cachedCommunity() });
    const playlist = params.get("playlist");
    if (playlist !== null) {
      if (!PLAYLIST_ID.test(playlist)) throw new NativeApiError(400, "bad_request", "That isn't a playlist.");
      return apiData({ tracks: await cachedPlaylist(playlist) });
    }
    const query = params.get("q")?.trim().toLowerCase() ?? "";
    if (query.length > 200) {
      throw new NativeApiError(400, "bad_request", "That search is too long.");
    }
    return apiData({ tracks: await (query ? cachedSearch(query) : cachedChart()) });
  } catch (error) {
    return apiError(error);
  }
}
