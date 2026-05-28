import Image from "next/image";
import { backdropUrl } from "@/lib/tmdb";

/**
 * Cinematic header backdrop. Sized to FILL its relative parent (the title
 * header wrapper) rather than a fixed height, so the dark scrim always
 * covers exactly the header content — meta, title, chips, actions, overview
 * — no matter how long the title or synopsis runs. It extends up under the
 * translucent nav and breaks out to the full viewport width.
 *
 * The scrim is theme-INDEPENDENT (dark in both modes): a cinematic backdrop
 * is fundamentally a dark treatment; a light scrim just fogs the image. So
 * header text on top must be light in both themes (see the title page). The
 * bottom edge dissolves into the page background so the body below reads on
 * a clean surface in either theme.
 */
export function BackdropHero({
  path,
  alt,
}: {
  path: string | null;
  alt: string;
}) {
  const src = backdropUrl(path, "w1280");
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-16 bottom-0 left-1/2 -ml-[50vw] w-screen overflow-hidden"
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="h-full w-full bg-neutral-900" />
      )}

      {/* Left-weighted dark scrim for title legibility — theme-independent. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(8,8,11,0.92) 0%, rgba(8,8,11,0.74) 34%, rgba(8,8,11,0.42) 62%, rgba(8,8,11,0.16) 100%)",
        }}
      />
      {/* Slight top scrim so anything under the translucent nav stays legible. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(8,8,11,0.6) 0%, transparent 22%)",
        }}
      />
      {/* Dissolve the bottom edge into the page background (theme-aware) so the
          body content below reads on a clean surface in both themes. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.5) 12%, transparent 30%)",
        }}
      />
      {/* Accent glow, top-right. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.16),transparent_60%)]" />
    </div>
  );
}
