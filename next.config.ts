import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    viewTransition: true,
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
