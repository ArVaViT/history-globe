import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// MapLibre 6 ships three ES modules: the library, its worker, and a module both share.
// It finds the worker next to its own file through a URL computed at run time, which a
// bundler cannot follow: bundled, the worker was a 404 in production and nothing was
// ever drawn. So the build ships MapLibre's own files unchanged under vendor/ and the
// app imports the library from there; the shared module then loads once, for the page
// and the worker alike. In development Vite serves them from node_modules as they are.
const require = createRequire(import.meta.url);
const maplibrePackage = require.resolve("maplibre-gl/package.json");
const maplibreDist = join(dirname(maplibrePackage), "dist");
const { version } = JSON.parse(readFileSync(maplibrePackage, "utf8")) as { version: string };
const VENDOR = `vendor/maplibre-gl-${version}`;
const FILES = ["maplibre-gl.mjs", "maplibre-gl-shared.mjs", "maplibre-gl-worker.mjs"];

function maplibreVendor(): Plugin {
  let outDir = "dist";
  return {
    name: "maplibre-vendor",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const to = join(outDir, VENDOR);
      mkdirSync(to, { recursive: true });
      for (const f of [...FILES, "../LICENSE.txt"])
        copyFileSync(join(maplibreDist, f), join(to, f.replace("../", "")));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreVendor()],
  build: {
    target: "es2023",
    sourcemap: true,
    rollupOptions: {
      external: ["maplibre-gl"],
      // Relative to the chunk in assets/, so the app works under any base path.
      output: { paths: { "maplibre-gl": `../${VENDOR}/maplibre-gl.mjs` } },
    },
  },
  // Pre-bundling would move the library away from its worker in development too.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
