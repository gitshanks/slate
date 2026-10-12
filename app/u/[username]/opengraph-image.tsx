import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/profiles";
import { siteOrigin } from "@/lib/site-url";
import { fetchTitlesByStatusForOwner } from "@/lib/title-filters";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/types";

export const alt = "A shared watchlist on slate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 3600;

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
  const origin = siteOrigin().replace(/^https?:\/\//, "");
  const profile = await getPublicProfile(username).catch(() => null);

  if (!profile) {
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
          This slate isn&apos;t shared.
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#aeb8b1" }}>
          {origin}
        </div>
      </div>,
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
  const strip = titles.slice(0, 3);
  const displayName = profile.display_name;
  const nameSize = displayName.length > 22 ? 48 : displayName.length > 15 ? 56 : 72;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        color: "#f4f3ed",
        background: "linear-gradient(135deg, #0b1713 0%, #07100e 58%, #101714 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {strip.map((title, index) => (
        <div
          key={title.id}
          style={{
            display: "flex",
            position: "absolute",
            left: 640 + index * 180,
            top: index === 1 ? 182 : 204,
            width: 176,
            height: 264,
            overflow: "hidden",
            borderRadius: 8,
            background: "#101b18",
            boxShadow: "0 24px 56px rgba(0,0,0,.38)",
          }}
        >
          {title.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl(title.poster_path, "w342")!}
              alt=""
              width={176}
              height={264}
              style={{ display: "flex", objectFit: "cover" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16, color: "#b4e6bd", textAlign: "center", fontSize: 18 }}>{title.title}</div>
          )}
        </div>
      ))}
      <div
        style={{
          display: "flex",
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "54px 72px 42px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              width: 86,
              height: 86,
              overflow: "hidden",
              borderRadius: 43,
              alignItems: "center",
              justifyContent: "center",
              color: "#b4e6bd",
              background: "#18231f",
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 23, color: "#b4e6bd" }}>slate</div>
            <div style={{ display: "flex", fontSize: 19, color: "#aeb8b1" }}>@{profile.username}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 540, marginTop: -10 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: nameSize, fontWeight: 700, letterSpacing: -3.5, lineHeight: 0.98 }}>
            <span style={{ display: "flex" }}>{displayName}&rsquo;s</span>
            <span style={{ display: "flex", color: "#b4e6bd" }}>slate</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 23, color: "#c5cec7" }}>
            <span style={{ display: "flex", color: "#b4e6bd", fontWeight: 700 }}>{total}</span>
            {total === 1 ? "title saved" : "titles saved"}
          </div>
          {total > 0 ? (
            <div style={{ display: "flex", fontSize: 18, color: "#9da9a1" }}>
              {want.titles.length} up next　/　{watching.titles.length} watching　/　{watched.titles.length} watched
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 20, color: "#9da9a1" }}>A watchlist, just getting started.</div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 19, color: "#c3cbc5" }}>
          A watchlist worth a look. <span style={{ color: "#728078" }}>　{origin}</span>
        </div>
      </div>
    </div>,
    size,
  );
}
