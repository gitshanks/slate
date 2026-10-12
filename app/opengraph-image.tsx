import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgEyebrow, OgFooter, OgRoot, SlateMark } from "@/lib/og-design";

export const alt = "slate — save what you want to watch";
export const size = OG_SIZE;
export const contentType = "image/png";

const SHELVES = ["Up Next", "Watching", "Watched"];

export default function Image() {
  return new ImageResponse(
    (
      <OgRoot>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "72px 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 28,
              width: 640,
            }}
          >
            <OgEyebrow>SLATE · YOUR WATCHLIST</OgEyebrow>
            <div
              style={{
                display: "flex",
                fontSize: 84,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1.02,
                color: OG.ink,
              }}
            >
              Save what you want to watch.
            </div>
            <div style={{ display: "flex", fontSize: 28, color: OG.muted }}>
              Private by default. Shareable when you choose.
            </div>
            <div style={{ display: "flex", flexDirection: "row", gap: 14 }}>
              {SHELVES.map((shelf) => (
                <div
                  key={shelf}
                  style={{
                    display: "flex",
                    fontSize: 22,
                    fontWeight: 700,
                    color: OG.accent,
                    border: "1px solid rgba(173,235,179,0.35)",
                    backgroundColor: "rgba(173,235,179,0.08)",
                    borderRadius: 999,
                    padding: "10px 22px",
                  }}
                >
                  {shelf}
                </div>
              ))}
            </div>
            <OgFooter left="slate" />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 340,
              height: 340,
              borderRadius: 64,
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(160deg, rgba(173,235,179,0.22) 0%, rgba(173,235,179,0.04) 55%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <SlateMark size={220} />
          </div>
        </div>
      </OgRoot>
    ),
    size,
  );
}
