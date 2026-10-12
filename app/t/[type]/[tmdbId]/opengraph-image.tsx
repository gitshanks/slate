import { ImageResponse } from "next/og";
import { getSharedTitle } from "@/lib/shared-title-data";
import { siteOrigin } from "@/lib/site-url";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";

export const alt = "A recommendation worth passing on · slate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

function titleSize(text: string) {
  if (text.length > 48) return 62;
  if (text.length > 34) return 74;
  if (text.length > 23) return 86;
  return 100;
}

export default async function Image({
  params,
}: {
  params: Promise<{ type: string; tmdbId: string }>;
}) {
  const { type, tmdbId } = await params;
  const origin = siteOrigin().replace(/^https?:\/\//, "");
  const title = await getSharedTitle(type, tmdbId).catch(() => null);
  const name = title?.title || "Something good to watch";
  const backdrop = backdropUrl(title?.backdrop_path, "w1280");
  const poster = posterUrl(title?.poster_path, "w500");
  const meta = title
    ? [
        title.media_type === "movie" ? "Film" : "Series",
        title.release_date?.slice(0, 4),
        title.genres?.[0]?.name,
      ].filter(Boolean)
    : [];
  const synopsis = title?.overview?.replace(/\s+/g, " ").slice(0, 118);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#07100e",
        color: "#f4f3ed",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          width={1200}
          height={630}
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            objectFit: "cover",
            opacity: 0.72,
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(5,9,8,.97) 0%, rgba(5,9,8,.88) 40%, rgba(5,9,8,.18) 100%), linear-gradient(0deg, rgba(5,9,8,.75) 0%, transparent 55%)",
        }}
      />
      {poster ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 72,
            top: 52,
            width: 310,
            height: 474,
            overflow: "hidden",
            borderRadius: 8,
            background: "#111a17",
            boxShadow: "0 28px 70px rgba(0,0,0,.48)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            width={310}
            height={474}
            style={{ display: "flex", objectFit: "cover" }}
          />
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "52px 72px 42px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -1.2,
          }}
        >
          <span style={{ display: "flex", color: "#b4e6bd" }}>slate</span>
          <span style={{ display: "flex", color: "#a4aaa6", fontSize: 20 }}>
            recommends
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            width: 700,
            marginTop: -8,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: titleSize(name),
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 0.98,
              maxWidth: 700,
            }}
          >
            {name}
          </div>
          {meta.length ? (
            <div style={{ display: "flex", fontSize: 26, color: "#b4e6bd" }}>
              {meta.join("   /   ")}
            </div>
          ) : null}
          {synopsis ? (
            <div
              style={{
                display: "flex",
                maxWidth: 650,
                fontSize: 22,
                lineHeight: 1.28,
                color: "#d2d5d2",
              }}
            >
              {synopsis}
              {title?.overview && title.overview.length > 118 ? "…" : ""}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", fontSize: 19, color: "#c3cbc5" }}>
          A good one, passed on. <span style={{ color: "#728078" }}>　{origin}</span>
        </div>
      </div>
    </div>,
    size,
  );
}
