import { ImageResponse } from "next/og";
import {
  OG,
  OG_SIZE,
  OgEyebrow,
  OgFooter,
  OgPoster,
  OgRoot,
  headlineSize,
} from "@/lib/og-design";
import { getSharedTitle } from "@/lib/shared-title-data";
import { siteOrigin } from "@/lib/site-url";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";

export const alt = "A recommendation worth passing on · slate";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({
  params,
}: {
  params: Promise<{ type: string; tmdbId: string }>;
}) {
  const { type, tmdbId } = await params;
  const origin = siteOrigin();
  const title = await getSharedTitle(type, tmdbId).catch(() => null);
  const backdrop = backdropUrl(title?.backdrop_path, "w1280");
  const poster = posterUrl(title?.poster_path, "w342");
  const name = title?.title || "Something good to watch";
  const meta = title
    ? [
        title.media_type === "movie" ? "Film" : "Series",
        title.release_date?.slice(0, 4),
        title.genres?.[0]?.name,
      ].filter(Boolean)
    : [];

  return new ImageResponse(
    (
      <OgRoot>
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
              left: 0,
              top: 0,
              objectFit: "cover",
              opacity: 0.38,
            }}
          />
        ) : null}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            background:
              "linear-gradient(90deg, rgba(8,10,9,0.94) 0%, rgba(8,10,9,0.78) 45%, rgba(8,10,9,0.35) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 280,
            background:
              "linear-gradient(0deg, rgba(8,10,9,0.9) 0%, rgba(8,10,9,0) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 56,
            width: "100%",
            height: "100%",
            padding: "56px 72px",
          }}
        >
          <OgPoster src={poster} width={264} height={396} title={name} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 20,
              width: 700,
            }}
          >
            <OgEyebrow>SLATE · WORTH PASSING ON</OgEyebrow>
            <div
              style={{
                display: "flex",
                fontSize: headlineSize(name),
                fontWeight: 800,
                letterSpacing: -2,
                lineHeight: 1.04,
                color: OG.ink,
              }}
            >
              {name}
            </div>
            {meta.length > 0 ? (
              <div style={{ display: "flex", fontSize: 26, color: OG.muted }}>
                {meta.join("  ·  ")}
              </div>
            ) : null}
            <div style={{ display: "flex", fontSize: 26, color: "#d4d4d8" }}>
              Watch it. Keep it. Pass it on.
            </div>
            <OgFooter
              left="slate"
              right={origin.replace(/^https?:\/\//, "")}
            />
          </div>
        </div>
      </OgRoot>
    ),
    size,
  );
}
