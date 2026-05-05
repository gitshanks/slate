import type { NextConfig } from "next";
import path from "node:path";

// Public-portfolio mode: marketing page at /, app moved to /app. Self-host
// default (flag unset) keeps the app at /, so existing bookmarks and PWA
// installs are unaffected.
const PUBLIC_MODE = process.env.NEXT_PUBLIC_SLATE_PUBLIC === "true";

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
    return [
      // Landing page at the root URL; the file lives at /landing so it
      // doesn't collide with the watchlist route.
      { source: "/", destination: "/landing" },
      // Watchlist at /app — points at the existing app/(app)/page.tsx, which
      // continues to live at the route group's "/" internally.
      { source: "/app", destination: "/" },
    ];
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
