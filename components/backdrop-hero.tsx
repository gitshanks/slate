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
      className="pointer-events-none absolute left-1/2 right-1/2 top-0 -ml-[50vw] -mr-[50vw] -mt-16 h-[calc(100vh+4rem)] min-h-[760px] w-screen overflow-hidden"
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
      {/* Global darkening + fade to bg at bottom + gentle left weight for text */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, hsl(var(--background) / 0.9) 0%, hsl(var(--background) / 0.7) 35%, hsl(var(--background) / 0.35) 60%, hsl(var(--background) / 0.15) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.3) 40%, transparent 85%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
    </div>
  );
}
