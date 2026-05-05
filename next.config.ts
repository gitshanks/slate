import type { NextConfig } from "next";
import path from "node:path";

// Public-portfolio mode: marketing page at /, app moved to /app. Piggybacks
// on NEXT_PUBLIC_DEMO_MODE — the same flag that opens the passcode gate and
// switches Supabase to the live read-only path — so the public deploy is
// configured by a single env var. Self-host default (flag unset) keeps the
// app at /, so existing bookmarks and PWA installs are unaffected.
const PUBLIC_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

const nextConfig: NextConfig = {
  // Produce a minimal self-contained server bundle for docker-compose /
  // self-host deploys. On Vercel this flag is a no-op.
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    viewTransition: true,
  },
  async rewrites() {
    if (!PUBLIC_MODE) return [];
    // beforeFiles is required for the "/" rewrite — array-form rewrites run
    // *after* the filesystem, and app/(app)/page.tsx already resolves at "/",
    // so an afterFiles rewrite would never fire. The "/app" rewrite has no
    // real file collision and can stay in afterFiles.
    return {
      beforeFiles: [
        { source: "/", destination: "/landing" },
      ],
      afterFiles: [
        { source: "/app", destination: "/" },
      ],
      fallback: [],
    };
  },
  async redirects() {
    if (!PUBLIC_MODE) return [];
    // /landing is an implementation detail of the rewrite above — bounce any
    // direct hits to the canonical "/" so we don't leak two URLs for the same
    // page (and avoid duplicate-content issues with crawlers).
    return [{ source: "/landing", destination: "/", permanent: false }];
  },
  images: {
    // TMDB already serves pre-built sizes (w92, w185, w500, w1280…) which we
    // pick explicitly via lib/tmdb-image.ts, and its CDN has strong cache
    // headers. Routing TMDB URLs through Vercel's /_next/image optimizer adds
    // zero value while burning the monthly image-transformation quota — it
    // maxed out in prod on 2026-04 and posters went blank. unoptimized makes
    // <Image> emit plain <img> pointing directly at image.tmdb.org.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
