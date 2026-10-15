/**
 * page-hashes.json: a short hash of every page the sitemap lists, by its path from the site
 * root ("de/place/jerusalem/" → "3f9c0a1b2c4d"), published with the site. IndexNow
 * (scripts/indexnow.ts) compares it with what it sent last time and sends only the pages
 * that changed: the sitemap has no <lastmod>, and sending all 16 000 pages on every deploy
 * is what the protocol asks sites not to do.
 *
 * The app's own page (the sitemap's first address) is built later by Vite and is not
 * listed; IndexNow sends it once.
 *
 * Usage: node scripts/build-page-hashes.ts  (after build-pages and build-docs, with SITE_URL)
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sitemapLocs } from "./indexnow-core.ts";

const pub = join(import.meta.dirname, "../apps/web/public");
const out = join(pub, "page-hashes.json");
const sitemap = join(pub, "sitemap.xml");
const site = process.env.SITE_URL?.replace(/\/+$/, "") ?? "";

if (!site || !existsSync(sitemap)) {
  rmSync(out, { force: true });
  console.log("page hashes: no SITE_URL or sitemap, nothing written");
} else {
  const hashes: Record<string, string> = {};
  let missing = 0;
  for (const url of sitemapLocs(readFileSync(sitemap, "utf8"))) {
    const path = url.slice(site.length + 1);
    if (path === "") continue;
    const file = join(pub, path.endsWith("/") ? `${path}index.html` : path);
    if (!existsSync(file)) {
      missing++;
      continue;
    }
    hashes[path] = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
  }
  if (missing > 0) throw new Error(`page hashes: ${String(missing)} sitemap pages have no file`);
  writeFileSync(out, JSON.stringify(hashes));
  console.log(`page hashes: ${String(Object.keys(hashes).length)} pages`);
}
