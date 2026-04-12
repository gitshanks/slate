import Image from "next/image";
import { backdropUrl } from "@/lib/tmdb";

export function BackdropHero({
  path,
  alt,
  children,
}: {
  path: string | null;
  alt: string;
  children?: React.ReactNode;
}) {
  const src = backdropUrl(path, "w1280");
  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-16 h-[60vh] min-h-[420px] w-screen overflow-hidden">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="object-cover hero-fade"
        />
      ) : (
        <div className="h-full w-full bg-card hero-fade" />
      )}
      {/* Color wash + bottom fade to bg */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0">{children}</div>
    </div>
  );
}
