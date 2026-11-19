import { describe, expect, it } from "vitest";
import {
  batches,
  changedUrls,
  hashesByUrl,
  INDEXNOW_KEY,
  isSitemapIndex,
  requestBody,
  sitemapLocs,
} from "./indexnow-core.ts";

const SITE_ORIGIN = "https://historyglobe.app";

describe("indexnow", () => {
  it("reads the addresses of a sitemap and tells an index from a list", () => {
    const list = `<?xml version="1.0"?><urlset xmlns="x">
  <url><loc>${SITE_ORIGIN}/</loc></url>
  <url><loc> ${SITE_ORIGIN}/docs/?a=1&amp;b=2 </loc></url>
</urlset>`;
    expect(sitemapLocs(list)).toEqual([`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/docs/?a=1&b=2`]);
    expect(isSitemapIndex(list)).toBe(false);
    expect(isSitemapIndex(`<sitemapindex xmlns="x"><sitemap><loc>a</loc></sitemap>`)).toBe(true);
  });

  it("sends every page on the first run", () => {
    const r = changedUrls(["a", "b"], { a: "1" }, null);
    expect(r.send).toEqual(["a", "b"]);
    expect(r.gone).toEqual([]);
    expect(r.next).toEqual({ a: "1", b: "-" });
  });

  it("then sends only new, changed and gone pages", () => {
    const sent = { a: "1", b: "-", c: "3", old: "9" };
    const r = changedUrls(["a", "b", "c", "new"], { a: "1", c: "4", new: "5" }, sent);
    expect(r.send).toEqual(["c", "new"]);
    expect(r.gone).toEqual(["old"]);
  });

  it("splits into requests of at most 10 000", () => {
    const many = Array.from({ length: 16_457 }, (_, i) => String(i));
    expect(batches(many).map((b) => b.length)).toEqual([10_000, 6_457]);
    expect(batches([])).toEqual([]);
  });

  it("writes the request the protocol asks for", () => {
    expect(JSON.parse(requestBody(`${SITE_ORIGIN}/`, [`${SITE_ORIGIN}/en/`]))).toEqual({
      host: "historyglobe.app",
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
      urlList: [`${SITE_ORIGIN}/en/`],
    });
    expect(hashesByUrl(`${SITE_ORIGIN}/`, { "en/": "ab" })).toEqual({
      [`${SITE_ORIGIN}/en/`]: "ab",
    });
  });
});
