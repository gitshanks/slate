#!/usr/bin/env node
/**
 * Build the Slate Chrome extension with esbuild.
 *
 * We don't use Vite here. MV3 content scripts declared in `manifest.json`
 * are loaded as CLASSIC scripts — they can't resolve ES-module `import`
 * statements, so any shared-chunk splitting (which Vite/rollup does by
 * default across multiple entry points) would break them silently.
 *
 * esbuild's per-entry `bundle: true` + `format: "iife"` produces a
 * self-contained file per entry with no `import`s in the output, which
 * is exactly what MV3 wants for content scripts, the popup, and the
 * service worker alike.
 *
 * Outputs:
 *   dist/manifest.json, dist/popup.html                        (copied)
 *   dist/popup.js, dist/background.js                          (UI + SW)
 *   dist/content/{netflix,prime,hulu,disney}.js                (scrapers)
 */
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const base = {
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
  logLevel: "info",
};

// Clean dist first so leftovers from a previous build (e.g. the old
// Vite-split shared chunks) don't linger and get loaded by Chrome.
await rm("dist", { recursive: true, force: true });
await mkdir("dist/content", { recursive: true });

await Promise.all([
  build({ ...base, entryPoints: ["src/popup.ts"], outfile: "dist/popup.js" }),
  build({ ...base, entryPoints: ["src/background.ts"], outfile: "dist/background.js" }),
  build({ ...base, entryPoints: ["content/netflix.ts"], outfile: "dist/content/netflix.js" }),
  build({ ...base, entryPoints: ["content/prime.ts"], outfile: "dist/content/prime.js" }),
  build({ ...base, entryPoints: ["content/hulu.ts"], outfile: "dist/content/hulu.js" }),
  build({ ...base, entryPoints: ["content/disney.ts"], outfile: "dist/content/disney.js" }),
]);

await cp("manifest.json", "dist/manifest.json");
await cp("popup.html", "dist/popup.html");

console.log("✓ built → dist/");
