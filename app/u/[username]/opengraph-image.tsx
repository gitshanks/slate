import { ImageResponse } from "next/og";
import {
  OG,
  OG_SIZE,
  OgEyebrow,
  OgFooter,
  OgPoster,
  OgRoot,
} from "@/lib/og-design";
import { getPublicProfile, profileAvatarUrl } from "@/lib/profiles";
import { siteOrigin } from "@/lib/site-url";
import { fetchTitlesByStatusForOwner } from "@/lib/title-filters";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/types";

export const alt = "A shared slate on slate";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 3600;

const STRIP_COUNT = 5;

function interleave(shelves: TitleRow[][]) {
  const longest = Math.max(0, ...shelves.map((shelf) => shelf.length));
  const titles: TitleRow[] = [];
  for (let index = 0; index < longest; index += 1) {
    for (const shelf of shelves) {
      const title = shelf[index];
      if (title) titles.push(title);
    }
  }
  return titles;
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const origin = siteOrigin();
  const profile = await getPublicProfile(username).catch(() => null);

  if (!profile) {
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
            <OgEyebrow>SLATE · SHARED PROFILE</OgEyebrow>
            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 800,
                letterSpacing: -2,
                color: OG.ink,
              }}
            >
              This slate isn&apos;t shared.
            </div>
            <OgFooter left="slate" />
          </div>
        </OgRoot>
      ),
      size,
    );
  }

  const [want, watching, watched] = await Promise.all([
    fetchTitlesByStatusForOwner(profile.id, "want"),
    fetchTitlesByStatusForOwner(profile.id, "watching"),
    fetchTitlesByStatusForOwner(profile.id, "watched"),
  ]);
  const titles = interleave([want.titles, watching.titles, watched.titles]);
  const total = want.titles.length + watching.titles.length + watched.titles.length;
  const strip = titles.slice(0, STRIP_COUNT);
  const remaining = total - strip.length;
  const avatar = profileAvatarUrl(profile, origin);
  const initial = profile.display_name.slice(0, 1).toLocaleUpperCase();

  return new ImageResponse(
    (
      <OgRoot>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 26,
            width: "100%",
            height: "100%",
            padding: "56px 72px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 116,
                height: 116,
                borderRadius: 58,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.2)",
                backgroundColor: "#1c1f1d",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 800,
                color: OG.accent,
              }}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt=""
                  width={116}
                  height={116}
                  style={{ display: "flex", objectFit: "cover" }}
                />
              ) : (
                initial
              )}
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <OgEyebrow>
                @{profile.username} · SHARED SLATE
              </OgEyebrow>
              <div
                style={{
                  display: "flex",
                  fontSize:
                    profile.display_name.length > 22
                      ? 52
                      : profile.display_name.length > 14
                        ? 64
                        : 76,
                  fontWeight: 800,
                  letterSpacing: -2,
                  lineHeight: 1,
                  color: OG.ink,
                }}
              >
                {profile.display_name}&rsquo;s slate
              </div>
              <div style={{ display: "flex", fontSize: 26, color: OG.muted }}>
                {total === 0
                  ? "Waiting for its first title"
                  : `${total} title${total === 1 ? "" : "s"} · ${want.titles.length} up next · ${watching.titles.length} watching · ${watched.titles.length} watched`}
              </div>
            </div>
          </div>

          {strip.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
              {strip.map((title) => (
                <OgPoster
                  key={title.id}
                  src={posterUrl(title.poster_path, "w342")}
                  width={132}
                  height={198}
                  title={title.title}
                />
              ))}
              {remaining > 0 ? (
                <div
                  style={{
                    display: "flex",
                    width: 132,
                    height: 198,
                    borderRadius: 20,
                    border: "1px solid rgba(173,235,179,0.35)",
                    backgroundColor: "rgba(173,235,179,0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 30,
                    fontWeight: 800,
                    color: OG.accent,
                  }}
                >
                  +{remaining}
                </div>
              ) : null}
            </div>
          ) : null}

          <OgFooter left="slate" right={origin.replace(/^https?:\/\//, "")} />
        </div>
      </OgRoot>
    ),
    size,
  );
}
