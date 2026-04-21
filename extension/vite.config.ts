import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync } from "fs";

/**
 * Build config for the Chrome MV3 extension. Every entry outputs an
 * unbundled ES module so Chrome can load it directly. The manifest is
 * copied into dist/ as a post-build step — Vite only knows about JS.
 *
 * Output layout:
 *   dist/manifest.json
 *   dist/popup.html          (copied)
 *   dist/popup.js
 *   dist/background.js
 *   dist/content/netflix.js
 *   dist/content/prime.js
 *   dist/content/hulu.js
 *   dist/content/disney.js
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.ts"),
        background: resolve(__dirname, "src/background.ts"),
        "content/netflix": resolve(__dirname, "content/netflix.ts"),
        "content/prime": resolve(__dirname, "content/prime.ts"),
        "content/hulu": resolve(__dirname, "content/hulu.ts"),
        "content/disney": resolve(__dirname, "content/disney.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  plugins: [
    {
      name: "copy-static",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync("manifest.json", "dist/manifest.json");
        copyFileSync("popup.html", "dist/popup.html");
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
