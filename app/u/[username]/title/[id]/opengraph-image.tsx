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
import { getPublicProfileTitle } from "@/lib/public-profile-library";
import { siteOrigin } from "@/lib/site-url";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import { formatRuntime, formatYear } from "@/lib/utils";

export const alt = "A title on a shared slate";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username, id } = await params;
  const origin = siteOrigin();
  const record = await getPublicProfileTitle(username, id).catch(() => null);

  if (!record) {
    return new ImageResponse(
      (
        <OgRoot>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 24,
              width: "100%",
              height: "100%",
              padding: "72px 80px",
            }}
          >
            <OgEyebrow>SLATE · SHARED TITLE</OgEyebrow>
            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 800,
                letterSpacing: -2,
                color: OG.ink,
              }}
            >
              This title isn&apos;t shared.
            </div>
            <OgFooter left="slate" />
          </div>
        </OgRoot>
      ),
      size,
    );
  }

  const { profile, title } = record;
  const backdrop = backdropUrl(title.backdrop_path, "w1280");
  const poster = posterUrl(title.poster_path, "w342");
  const shelf =
    title.status === "watching"
      ? "WATCHING"
      : title.status === "watched"
        ? "WATCHED"
        : "UP NEXT";
  const meta = [
    title.media_type === "movie" ? "Film" : "Series",
    formatYear(title.release_date),
    formatRuntime(title.runtime),
    title.genres?.[0]?.name,
  ].filter(Boolean);
  const note = title.review?.trim().replace(/\s+/g, " ").slice(0, 130);

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
          <OgPoster src={poster} width={264} height={396} title={title.title} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 20,
              width: 700,
            }}
          >
            <OgEyebrow>
              ON {profile.display_name.toLocaleUpperCase()}&rsquo;S SLATE ·{" "}
              {shelf}
            </OgEyebrow>
            <div
              style={{
                display: "flex",
                fontSize: headlineSize(title.title),
                fontWeight: 800,
                letterSpacing: -2,
                lineHeight: 1.04,
                color: OG.ink,
              }}
            >
              {title.title}
            </div>
            {meta.length > 0 ? (
              <div style={{ display: "flex", fontSize: 26, color: OG.muted }}>
                {meta.join("  ·  ")}
              </div>
            ) : null}
            {note ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 25,
                  fontStyle: "italic",
                  color: "#d4d4d8",
                }}
              >
                &ldquo;{note}
                {title.review && title.review.trim().length > 130 ? "…" : ""}&rdquo;
              </div>
            ) : null}
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
