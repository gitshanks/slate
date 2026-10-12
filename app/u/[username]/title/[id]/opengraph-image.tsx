import { ImageResponse } from "next/og";
import { getPublicProfileTitle } from "@/lib/public-profile-library";
import { siteOrigin } from "@/lib/site-url";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import { formatRuntime, formatYear } from "@/lib/utils";

export const alt = "A title on a shared slate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 3600;

function titleSize(text: string) {
  if (text.length > 48) return 62;
  if (text.length > 34) return 74;
  if (text.length > 23) return 86;
  return 100;
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username, id } = await params;
  const origin = siteOrigin().replace(/^https?:\/\//, "");
  const record = await getPublicProfileTitle(username, id).catch(() => null);

  if (!record) {
    return new ImageResponse(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          width: "100%",
          height: "100%",
          padding: "72px 80px",
          color: "#f4f3ed",
          background: "#07100e",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#b4e6bd", fontSize: 28 }}>slate</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700 }}>
          This title isn&apos;t shared.
        </div>
      </div>,
      size,
    );
  }

  const { profile, title } = record;
  const backdrop = backdropUrl(title.backdrop_path, "w1280");
  const poster = posterUrl(title.poster_path, "w500");
  const status =
    title.status === "watching"
      ? "Watching"
      : title.status === "watched"
        ? "Watched"
        : "Up next";
  const meta = [
    title.media_type === "movie" ? "Film" : "Series",
    formatYear(title.release_date),
    formatRuntime(title.runtime),
    title.genres?.[0]?.name,
  ].filter(Boolean);
  const note = title.review?.trim().replace(/\s+/g, " ").slice(0, 112);

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
            "linear-gradient(90deg, rgba(5,9,8,.97) 0%, rgba(5,9,8,.88) 40%, rgba(5,9,8,.18) 100%), linear-gradient(0deg, rgba(5,9,8,.8) 0%, transparent 58%)",
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
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 14 }}>
          <span style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#b4e6bd", letterSpacing: -1.2 }}>slate</span>
          <span style={{ display: "flex", fontSize: 21, color: "#d2d5d2" }}>on {profile.display_name}&rsquo;s slate</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 17, width: 700, marginTop: -8 }}>
          <div style={{ display: "flex", fontSize: titleSize(title.title), fontWeight: 700, letterSpacing: -4, lineHeight: 0.98 }}>
            {title.title}
          </div>
          <div style={{ display: "flex", fontSize: 25, color: "#b4e6bd" }}>
            {status}{meta.length ? `　/　${meta.join("　/　")}` : ""}
          </div>
          {note ? (
            <div style={{ display: "flex", maxWidth: 640, fontSize: 21, lineHeight: 1.25, color: "#d2d5d2" }}>
              “{note}{title.review && title.review.trim().length > 112 ? "…" : ""}”
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", fontSize: 19, color: "#c3cbc5" }}>
          A good one, kept. <span style={{ color: "#728078" }}>　{origin}</span>
        </div>
      </div>
    </div>,
    size,
  );
}
