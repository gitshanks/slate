import Image from "next/image";

/** Ambient artwork shared by the app feed and its landing-page surround. */
export function PreviewBackdrop({
  src,
  priority = false,
}: {
  src: string | null;
  priority?: boolean;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#050608]">
      {src && (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="100vw"
          className="scale-125 object-cover opacity-45 blur-xl saturate-125"
          priority={priority}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,8,0.30),rgba(4,5,8,0.38)_46%,rgba(4,5,8,0.68)_86%,rgba(4,5,8,0.82))]" />
    </div>
  );
}
