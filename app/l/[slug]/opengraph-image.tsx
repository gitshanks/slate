import { ImageResponse } from "next/og";
import { siteOrigin } from "@/lib/site-url";
import { getSlateListExtras } from "@/lib/slate-list-content";
import { getSlateList } from "@/lib/slate-lists";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";

export const alt = "A list made by Slate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 3600;

function nameSize(text: string) {
  if (text.length > 40) return 60;
  if (text.length > 28) return 72;
  if (text.length > 18) return 84;
  return 96;
}

/**
 * The card a /l/<slug> link shows when it is pasted into a DM, Threads or X:
 * the list's still across the whole card, its name over it, and the first
 * few posters in rank order, so the link reads as the list before anyone taps.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const origin = siteOrigin().replace(/^https?:\/\//, "");
  const found = await getSlateList(slug).catch(() => null);
  const extras = getSlateListExtras(slug);
  const titles = found?.titles ?? [];
  const name = found?.list.name ?? "Lists by Slate";
  const hero = backdropUrl(
    extras.hero ?? titles.find((title) => title.backdrop_path)?.backdrop_path,
    "w1280",
  );
  const strip = titles.filter((title) => title.poster_path).slice(0, 4);
  const count = titles.length;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        color: "#f4f3ed",
        background: "#080a09",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {hero ? (
         
        <img
          src={hero}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            objectFit: "cover",
            objectPosition: extras.heroPosition ?? "50% 35%",
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          background:
            "linear-gradient(90deg, rgba(8,10,9,0.94) 0%, rgba(8,10,9,0.78) 46%, rgba(8,10,9,0.25) 100%)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          background: "linear-gradient(180deg, rgba(8,10,9,0) 55%, rgba(8,10,9,0.85) 100%)",
        }}
      />

      {strip.map((title, index) => (
        <div
          key={title.id}
          style={{
            display: "flex",
            position: "absolute",
            left: 760 + index * 92,
            top: 150 + index * 26,
            width: 168,
            height: 252,
            overflow: "hidden",
            borderRadius: 10,
            background: "#101b18",
            boxShadow: "0 24px 56px rgba(0,0,0,.5)",
          }}
        >
          { }
          <img
            src={posterUrl(title.poster_path, "w342")!}
            alt=""
            width={168}
            height={252}
            style={{ display: "flex", objectFit: "cover" }}
          />
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
          padding: "56px 72px 48px",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#b4e6bd", letterSpacing: -1 }}>
          slate
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 640 }}>
          <div
            style={{
              display: "flex",
              fontSize: nameSize(name),
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1,
            }}
          >
            {name}
          </div>
          {count > 0 ? (
            <div style={{ display: "flex", fontSize: 26, color: "#c5cec7" }}>
              {count} {count === 1 ? "title" : "titles"}, picked by Slate
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22 }}>
          <span style={{ display: "flex", color: "#b4e6bd", fontWeight: 700 }}>Add to your slate</span>
          <span style={{ display: "flex", color: "#8d988f" }}>
            {origin}/l/{slug}
          </span>
        </div>
      </div>
    </div>,
    size,
  );
}
