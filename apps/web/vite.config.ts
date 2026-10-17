import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// MapLibre 6 ships three ES modules: the library, its worker, and a module both share.
// It finds the worker next to its own file through a URL computed at run time, which a
// bundler cannot follow: bundled, the worker was a 404 in production and nothing was
// ever drawn. So the build ships MapLibre's own files as they are under vendor/ and the
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
      // outDir is relative to the project root, not to where vite was started.
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const to = join(outDir, VENDOR);
      mkdirSync(to, { recursive: true });
      // Without their source maps (sourceMapsAside below): each file ends with a
      // sourceMappingURL line, dropped so that no browser asks for a map that is not there.
      for (const f of FILES)
        writeFileSync(
          join(to, f),
          readFileSync(join(maplibreDist, f), "utf8").replace(
            /\n\/\/# sourceMappingURL=\S+\s*$/,
            "\n",
          ),
        );
      copyFileSync(join(maplibreDist, "../LICENSE.txt"), join(to, "LICENSE.txt"));
    },
  };
}

/**
 * The source maps are not published: the code is all rights reserved (ADR 0014), and a map
 * is the source with its comments. `build.sourcemap: "hidden"` writes them without a
 * sourceMappingURL in the chunks; this moves them out of dist/ to apps/web/maps/ (not in
 * git), where scripts/check-budget.ts reads which language a chunk belongs to.
 */
function sourceMapsAside(): Plugin {
  let outDir = "dist";
  let mapsDir = "maps";
  return {
    name: "source-maps-aside",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      mapsDir = resolve(config.root, "maps");
    },
    closeBundle: {
      order: "pre",
      handler() {
        rmSync(mapsDir, { recursive: true, force: true });
        const walk = (dir: string) => {
          for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (name.endsWith(".map")) {
              const to = join(mapsDir, relative(outDir, path));
              mkdirSync(dirname(to), { recursive: true });
              renameSync(path, to);
            }
          }
        };
        walk(outDir);
      },
    },
  };
}

// The static pages in public/ (docs/, ru/places/ …) are folders with an index.html. The
// production host serves those; the dev server would answer with the app instead.
function publicFolderIndex(): Plugin {
  return {
    name: "public-folder-index",
    apply: "serve",
    configureServer(server) {
      const pub = server.config.publicDir;
      server.middlewares.use((req, res, next) => {
        const [path = "/", query] = (req.url ?? "/").split("?");
        if (path === "/" || !existsSync(join(pub, path, "index.html"))) {
          next();
          return;
        }
        // A folder asked for without its slash: the host would redirect, so do the same, or
        // the page's relative links would point one level too high.
        if (!path.endsWith("/")) {
          res.statusCode = 301;
          res.setHeader("Location", `${path}/${query === undefined ? "" : `?${query}`}`);
          res.end();
          return;
        }
        req.url = `${path}index.html${query === undefined ? "" : `?${query}`}`;
        next();
      });
    },
  };
}

// What a reader's "save for use offline" fetches (public/sw.js): the app itself, MapLibre,
// the data and the photos, with their size; not the static pages, docs or API, which are
// for search engines and other sites. Written once the bundle and the vendor files are out.
function offlineList(): Plugin {
  let outDir = "dist";
  return {
    name: "offline-list",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files: string[] = [];
      let bytes = 0;
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const path = join(dir, name);
          if (statSync(path).isDirectory()) walk(path);
          // The states' later half (*-late) is kept only to rebuild the data: the app reads
          // polities-all instead (docs/data-release.md).
          else if (!name.endsWith(".map") && !name.includes("-late.")) {
            files.push(relative(outDir, path).split("\\").join("/"));
            bytes += statSync(path).size;
          }
        }
      };
      for (const dir of ["assets", "vendor", "data"])
        if (existsSync(join(outDir, dir))) walk(join(outDir, dir));
      for (const name of ["manifest.webmanifest", "favicon.svg", "icon-192.png"])
        if (existsSync(join(outDir, name))) {
          files.push(name);
          bytes += statSync(join(outDir, name)).size;
        }
      const list = JSON.stringify({ bytes, files });
      writeFileSync(join(outDir, "offline.json"), list);
      // The worker carries the build's id: a deploy changes its bytes, so browsers install it
      // anew and it drops the built files of the deploy before (public/sw.js prune).
      const sw = join(outDir, "sw.js");
      if (existsSync(sw)) {
        const id = createHash("sha256").update(list).digest("hex").slice(0, 12);
        writeFileSync(
          sw,
          readFileSync(sw, "utf8").replace('const BUILD = "dev";', `const BUILD = "${id}";`),
        );
      }
    },
  };
}

// The first screen (index.html) sets the title in Literata, Latin in every language: its
// font is asked for with the page, not once the stylesheet has been read, so the title is
// drawn in its own face from the first frame, not in Georgia first and again a moment later.
function titleFont(): Plugin {
  let base = "/";
  return {
    name: "title-font",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const font = Object.values(ctx.bundle ?? {}).find(
          (f) =>
            f.type === "asset" &&
            /^assets\/literata-latin-wght-normal-[^/]+\.woff2$/.test(f.fileName),
        );
        if (!font) throw new Error("title-font: Literata's Latin font is not in the build");
        return [
          {
            tag: "link",
            attrs: {
              rel: "preload",
              href: `${base}${font.fileName}`,
              as: "font",
              type: "font/woff2",
              crossorigin: true,
            },
            injectTo: "head",
          },
        ];
      },
    },
  };
}

// WebMCP's origin trial (src/webmcp.ts): a token given to the build in WEBMCP_ORIGIN_TRIAL
// goes into the app's page; without one the page carries none. Never written in the code.
function originTrial(): Plugin {
  const token = process.env.WEBMCP_ORIGIN_TRIAL?.trim();
  return {
    name: "origin-trial",
    transformIndexHtml: () =>
      token
        ? [
            {
              tag: "meta",
              attrs: { "http-equiv": "origin-trial", content: token },
              injectTo: "head-prepend",
            },
          ]
        : [],
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    maplibreVendor(),
    sourceMapsAside(),
    publicFolderIndex(),
    offlineList(),
    titleFont(),
    originTrial(),
  ],
  build: {
    target: "es2023",
    // Written for check-budget.ts, never published (sourceMapsAside).
    sourcemap: "hidden",
    rollupOptions: {
      external: ["maplibre-gl"],
      // Relative to the chunk in assets/, so the app works under any base path.
      output: { paths: { "maplibre-gl": `../${VENDOR}/maplibre-gl.mjs` } },
    },
  },
  // Pre-bundling would move the library away from its worker in development too.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
