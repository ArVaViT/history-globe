/**
 * What the browser checks share: the address of the running app, a Chromium, a page whose
 * relief does not come from the network, and the wait for the map's first frame.
 *
 * Playwright is not a dependency of the repo (ADR 0010: the browser tests come later, and
 * its browsers are a large download). The checks take it from wherever it is installed:
 * PLAYWRIGHT=<a folder whose node_modules has it, or a package.json beside one>, else the
 * repo's own resolution (a global install on NODE_PATH). CHROMIUM=<path> picks the
 * browser; by default Playwright's own.
 *
 *   HG_URL=http://localhost:5173/ PLAYWRIGHT=~/some/project pnpm e2e
 *
 * The relief comes from tiles.mapterhorn.com, and `map.loaded()` waits for every tile: on a
 * slow or closed network the map never counts as drawn and every check times out. So a
 * page from `newPage` answers those requests itself with one flat tile at sea level, unless
 * HG_TILES=live asks for the real relief.
 */
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { crc32, deflateSync } from "node:zlib";

/** The running app (pnpm dev, or vite preview of a build). */
export const BASE = (process.env.HG_URL ?? "http://localhost:5173/").replace(/\/?$/, "/");

/** The relief's tiles (apps/web/src/offline.ts), answered locally unless HG_TILES=live. */
const TILES = /^https:\/\/tiles\.mapterhorn\.com\//;
const LIVE_TILES = process.env.HG_TILES === "live";

/** Where Playwright is taken from: PLAYWRIGHT, else this file's own resolution. */
const anchor = (() => {
  const from = process.env.PLAYWRIGHT
    ? resolve(process.env.PLAYWRIGHT.replace(/^~(?=\/)/, process.env.HOME ?? "~"))
    : import.meta.filename;
  return existsSync(from) && statSync(from).isDirectory() ? join(from, "package.json") : from;
})();

/** A module from the same place as Playwright, or null: axe-core when it is installed there. */
export function resolveBeside(id) {
  try {
    return createRequire(anchor).resolve(id);
  } catch {
    return null;
  }
}

export async function launch() {
  let playwright;
  try {
    playwright = createRequire(anchor)("playwright");
  } catch {
    console.error(
      "Playwright not found: set PLAYWRIGHT to a folder where it is installed (e2e/browser.mjs).",
    );
    process.exit(2);
  }
  return playwright.chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    // Metal draws MapLibre on a Mac without a GPU warning; elsewhere it is ignored.
    args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
  });
}

/**
 * A page of the given size in its own context. Its relief tiles are answered locally (see
 * above), so the map draws without the network and the checks do not load the tile host.
 */
export async function newPage(browser, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  if (!LIVE_TILES) {
    const body = flatTile();
    await ctx.route(TILES, (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body }),
    );
  }
  return ctx.newPage();
}

/**
 * The page is ready when the map has drawn its first frame. A map that never does is
 * explained: no handle (a production build), or which sources are still waiting.
 */
export async function mapReady(page, timeout = 45_000) {
  try {
    await page.waitForFunction(() => window.__hgMap?.loaded(), null, { timeout });
  } catch (e) {
    if (!String(e.message).includes("Timeout")) throw e;
    const why = await page
      .evaluate(() => {
        const m = window.__hgMap;
        if (!m)
          return "window.__hgMap is missing: the handle exists in development builds only (HG_URL must be a dev server or a preview of one)";
        const pending = Object.keys(m.getStyle()?.sources ?? {}).filter(
          (id) => !m.isSourceLoaded(id),
        );
        return `style ${m.isStyleLoaded() ? "loaded" : "not loaded"}, tiles ${
          m.areTilesLoaded() ? "loaded" : "pending"
        }, sources still loading: ${pending.join(", ") || "none"}`;
      })
      .catch(() => "the page is gone");
    const relief = /\bdem\b/.test(why)
      ? LIVE_TILES
        ? " The relief comes from tiles.mapterhorn.com (HG_TILES=live): is the network up?"
        : " The relief is answered locally by e2e/browser.mjs: it should not wait on dem."
      : "";
    throw new Error(
      `the map did not draw its first frame in ${String(timeout / 1000)} s (${why}).${relief}`,
      { cause: e },
    );
  }
}

/**
 * One 512 px Terrarium tile of sea level, as a PNG (the host's tiles are WebP; the browser
 * reads the image by its bytes, not its name). Terrarium: height = R·256 + G + B/256 − 32768,
 * so (128, 0, 0) is 0 m — flat for the terrain, and the sea to packages/core elevation.
 */
function flatTile() {
  const size = 512;
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row[1 + x * 3] = 128;
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
