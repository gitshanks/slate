import { ImageResponse } from "next/og";
import { getSharedTitle } from "@/lib/shared-title-data";
import { posterUrl } from "@/lib/tmdb-image";

export const alt = "A recommendation worth passing on · slate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ type: string; tmdbId: string }> }) {
  const { type, tmdbId } = await params;
  const title = await getSharedTitle(type, tmdbId).catch(() => null);
  const poster = posterUrl(title?.poster_path, "w342");
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a0a0b", color: "#fafafa", padding: 64, gap: 64, alignItems: "center", fontFamily: "sans-serif" }}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" width={288} height={432} style={{ borderRadius: 16, objectFit: "cover" }} />
      ) : <div style={{ width: 180, height: 260, borderRadius: 16, background: "#1c1c20", display: "flex", alignItems: "center", justifyContent: "center", color: "#adebb3", fontSize: 36 }}>slate</div>}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24 }}>
        <div style={{ display: "flex", color: "#adebb3", fontSize: 30, letterSpacing: -1 }}>slate</div>
        <div style={{ display: "flex", fontSize: (title?.title.length ?? 0) > 45 ? 48 : 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.08 }}>{title?.title || "Something good to watch"}</div>
        {title ? <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa" }}>{[title.media_type === "movie" ? "Film" : "Series", title.release_date?.slice(0, 4)].filter(Boolean).join(" · ")}</div> : null}
        <div style={{ display: "flex", marginTop: 14, fontSize: 25, color: "#d4d4d8" }}>Watch it. Keep it. Pass it on.</div>
      </div>
    </div>, size,
  );
}
