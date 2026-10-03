/**
 * What the browser checks share: the address of the running app and a Chromium.
 *
 * Playwright is not a dependency of the repo (ADR 0010: the browser tests come later, and
 * its browsers are a large download). The checks take it from wherever it is installed:
 * PLAYWRIGHT=<a folder whose node_modules has it, or a package.json beside one>, else the
 * repo's own resolution (a global install on NODE_PATH). CHROMIUM=<path> picks the
 * browser; by default Playwright's own.
 *
 *   HG_URL=http://localhost:5173/ PLAYWRIGHT=~/some/project pnpm e2e
 */
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

/** The running app (pnpm dev, or vite preview of a build). */
export const BASE = (process.env.HG_URL ?? "http://localhost:5173/").replace(/\/?$/, "/");

export async function launch() {
  const from = process.env.PLAYWRIGHT
    ? resolve(process.env.PLAYWRIGHT.replace(/^~(?=\/)/, process.env.HOME ?? "~"))
    : import.meta.filename;
  const anchor =
    existsSync(from) && statSync(from).isDirectory() ? join(from, "package.json") : from;
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

/** The page is ready when the map has drawn its first frame. */
export const mapReady = (page) =>
  page.waitForFunction(() => window.__hgMap?.loaded(), null, { timeout: 60_000 });
