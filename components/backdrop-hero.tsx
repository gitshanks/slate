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
      className="pointer-events-none absolute left-1/2 right-1/2 top-0 -ml-[50vw] -mr-[50vw] -mt-16 h-[85vh] min-h-[560px] w-screen overflow-hidden"
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
      {/* Readability overlays: bottom fade to bg, gentle left darkening, primary glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/20 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
    </div>
  );
}
