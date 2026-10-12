import { ImageResponse } from "next/og";
import { SlateMark } from "@/lib/og-design";
import { posterUrl } from "@/lib/tmdb-image";
import { siteOrigin } from "@/lib/site-url";

export const alt = "slate — your personal watchlist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// One large catalogue image gives the site card a real subject and keeps OG
// rendering reliable for crawlers with strict image-fetch limits.
const HERO_POSTER = "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg";

export default function Image() {
  const origin = siteOrigin().replace(/^https?:\/\//, "");
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
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 0,
          top: 0,
          width: 520,
          height: 630,
          overflow: "hidden",
          background: "#101b18",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl(HERO_POSTER, "w500")!}
          alt=""
          width={520}
          height={630}
          style={{ display: "flex", objectFit: "cover" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          background:
            "linear-gradient(90deg, #07100e 0%, #07100e 34%, rgba(7,16,14,.88) 49%, rgba(7,16,14,.18) 100%), linear-gradient(0deg, rgba(7,16,14,.8) 0%, transparent 46%)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "60px 76px 48px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: -1.5,
          }}
        >
          <SlateMark size={34} />
          <span style={{ display: "flex" }}>slate<span style={{ display: "flex", color: "#b4e6bd" }}>.</span></span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            width: 540,
            marginTop: -8,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: -5,
              lineHeight: 0.98,
            }}
          >
            <span style={{ display: "flex" }}>Never lose</span>
            <span style={{ display: "flex", color: "#b4e6bd" }}>a good one.</span>
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 510,
              fontSize: 25,
              lineHeight: 1.35,
              color: "#c3cbc5",
            }}
          >
            The films and shows you mean to watch, all in one place.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            fontSize: 20,
            color: "#d7ddd8",
          }}
        >
          <span
            style={{
              display: "flex",
              width: 9,
              height: 9,
              borderRadius: 9,
              background: "#b4e6bd",
            }}
          />
          Private by default
          <span style={{ display: "flex", color: "#728078" }}>·</span>
          {origin}
        </div>
      </div>
    </div>,
    size,
  );
}
