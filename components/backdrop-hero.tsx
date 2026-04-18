import Image from "next/image";
import { backdropUrl } from "@/lib/tmdb";

/**
 * Renders the title's backdrop as a page background behind content.
 * Absolutely positioned inside a `relative` parent — content lives in
 * normal flow on top of it with z-10.
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
      className="pointer-events-none absolute left-1/2 right-1/2 top-0 -ml-[50vw] -mr-[50vw] -mt-16 h-screen min-h-[720px] w-screen overflow-hidden"
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
        <div className="h-full w-full bg-card" />
      )}
      {/* Readability overlays: strong left column + bottom fade to bg + primary glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, hsl(var(--background) / 0.92) 0%, hsl(var(--background) / 0.6) 30%, hsl(var(--background) / 0.15) 55%, transparent 75%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--background) / 0.95) 0%, hsl(var(--background) / 0.25) 40%, transparent 75%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.18),transparent_55%)]" />
    </div>
  );
}
