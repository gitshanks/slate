// Shared design language for every social preview image (site, profile,
// profile titles, shared titles). Satori-compatible: flexbox, absolute
// positioning and linear gradients only — no blur, filters or grid.

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  bg: "#080a09",
  ink: "#fafafa",
  accent: "#adebb3",
  muted: "#a1a1aa",
  faint: "#71717a",
  card: "#141715",
  line: "rgba(255,255,255,0.14)",
} as const;

const SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter, sans-serif";
const MONO =
  "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export function headlineSize(text: string, base = 76): number {
  const length = text.length;
  if (length > 56) return 50;
  if (length > 38) return 60;
  if (length > 24) return 68;
  return base;
}

/** Base canvas: near-black with an emerald wash up top and a vignette below. */
export function OgRoot({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: OG.bg,
        color: OG.ink,
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 330,
          background:
            "linear-gradient(180deg, rgba(173,235,179,0.13) 0%, rgba(173,235,179,0.03) 55%, rgba(173,235,179,0) 100%)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 260,
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
        }}
      />
      {children}
    </div>
  );
}

/** Small mono eyebrow label with an accent dot, e.g. "SLATE · SHARED PROFILE". */
export function OgEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        fontFamily: MONO,
        fontSize: 24,
        letterSpacing: 4,
        color: OG.accent,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: OG.accent,
        }}
      />
      <div style={{ display: "flex" }}>{children}</div>
    </div>
  );
}

/** Bottom brand strip shared by every card. */
export function OgFooter({
  left,
  right = "Save what you want to watch",
}: {
  left: string;
  right?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: -1,
          color: OG.ink,
        }}
      >
        {left}
        <span style={{ display: "flex", color: OG.accent }}>.</span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 24,
          color: OG.faint,
        }}
      >
        {right}
      </div>
    </div>
  );
}

/** The slate mark, drawn from the same geometry as the app icon. */
export function SlateMark({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "flex" }}
    >
      <path
        d="M319.403 270.794C367.908 270.322 712.806 265.78 735.053 273.273C739.246 274.684 741.603 280.796 742.986 284.65C745.757 292.367 746.953 300.776 747.51 308.921C749.033 331.171 751.17 466.548 743.615 477.686C735.838 489.152 712.386 487.47 700.528 487.837L457.693 487.954C426.551 488.089 305.708 492.691 284.404 481.457C267.046 458.041 281.724 362.932 276.035 330.415C273.72 317.179 274.744 289.757 284.764 279.715C294.907 269.548 305.902 271.08 319.403 270.794Z"
        fill="white"
      />
      <path
        d="M292.862 536.046C345.071 533.825 421.033 535.447 472.047 538.054C501.631 539.58 485.744 712.323 485.707 739.823C485.701 745.172 474.922 750.618 470.72 752.279C423.635 756.064 372.262 752.183 324.765 753.785C316.13 754.075 296.497 753.032 288.84 750.309C272.72 744.613 274.968 693.031 275.279 680.556C276.363 637.239 273.168 596.163 277.396 553.33C278.18 545.316 286.939 539.638 292.862 536.046Z"
        fill="white"
      />
      <path
        d="M557.542 536.656C585.381 535.731 720.348 531.873 737.175 540.533C741.135 542.577 742.895 547.264 744.103 551.372C749.672 570.255 751.73 731.324 743.568 742.588C739.19 748.625 733.939 750.765 726.879 752.251C693.892 753.408 576.302 758.635 552.101 750.65C547.062 748.991 542.155 746.792 539.87 741.758C533.081 726.772 531.468 558.355 538.848 546.377C543.018 539.627 550.36 538.084 557.542 536.656Z"
        fill="white"
      />
    </svg>
  );
}

/** Rounded poster frame used across profile and title cards. */
export function OgPoster({
  src,
  width,
  height,
  title,
}: {
  src: string | null;
  width: number;
  height: number;
  title?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        borderRadius: 20,
        overflow: "hidden",
        border: `1px solid ${OG.line}`,
        backgroundColor: OG.card,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={width}
          height={height}
          style={{ display: "flex", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            padding: 16,
            fontSize: 22,
            fontWeight: 700,
            color: OG.accent,
            textAlign: "center",
          }}
        >
          {title || "slate"}
        </div>
      )}
    </div>
  );
}
