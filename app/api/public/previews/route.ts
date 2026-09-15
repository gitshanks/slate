import { randomUUID } from "node:crypto";
import { getPreviewFeedBatch } from "@/lib/tmdb";

export const runtime = "nodejs";

// Public catalogue data only. Upstream TMDB requests keep the same cache
// lifetimes as the app; each visitor gets their own reproducible session shuffle.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const seed = query.get("seed") ?? randomUUID();
  const batch = Number(query.get("batch") ?? "0");
  const exclusions = (query.get("exclude") ?? "").split(",").filter(Boolean);
  if (
    !/^[a-zA-Z0-9:_-]{1,128}$/.test(seed) ||
    !Number.isInteger(batch) ||
    batch < 0 ||
    batch > 10_000 ||
    exclusions.length > 96 ||
    exclusions.some((key) => !/^(movie|tv):[1-9]\d{0,9}$/.test(key))
  ) {
    return Response.json({ error: "Invalid preview request" }, { status: 400 });
  }

  const result = await getPreviewFeedBatch(new Set(exclusions), {
    includeLibrary: false,
    sessionSeed: seed,
    batchIndex: batch,
    targetSize: 8,
    lookupLimit: 24,
    waveSize: 8,
  });
  return Response.json(result, {
    // Do not give different sessions a cached ordering; catalogue/video fetches
    // inside getPreviewFeedBatch remain shared and cached independently.
    headers: { "Cache-Control": "no-store" },
  });
}
