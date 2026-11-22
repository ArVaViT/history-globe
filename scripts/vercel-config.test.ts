import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// What apps/web/vercel.json promises the reader and a host page, held so that a later edit
// cannot drop it unnoticed. Vercel matches a source with path-to-regexp, strict and
// case-sensitive; `sourceRegex` below is enough for the plain sources used here.

interface Rule {
  source: string;
  has?: { type: string; key: string }[];
  missing?: { type: string; key: string }[];
  headers: { key: string; value: string }[];
}
interface Redirect {
  source: string;
  destination: string;
  permanent?: boolean;
}
const vercel = JSON.parse(
  readFileSync(join(import.meta.dirname, "../apps/web/vercel.json"), "utf8"),
) as { headers: Rule[]; redirects: Redirect[] };

/** A header rule's source as a regular expression (no named parameters in these). */
const sourceRegex = (source: string) => new RegExp(`^${source}$`);

/** The headers Vercel sends for a path, with or without `?embed=1`: later rules win. */
function headersFor(path: string, embed: boolean): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of vercel.headers) {
    if (!sourceRegex(r.source).test(path)) continue;
    if (r.has?.some((h) => h.type === "query" && h.key === "embed") && !embed) continue;
    if (r.missing?.some((h) => h.type === "query" && h.key === "embed") && embed) continue;
    for (const h of r.headers) out.set(h.key.toLowerCase(), h.value);
  }
  return out;
}
const frameAncestors = (path: string, embed: boolean) =>
  /frame-ancestors ([^;]+)/.exec(headersFor(path, embed).get("content-security-policy") ?? "")?.[1];

describe("vercel.json", () => {
  it("lets any site frame the embed and the app it opens, and nothing else", () => {
    expect(frameAncestors("/embed/v1", false)).toBe("*");
    expect(frameAncestors("/", true)).toBe("*");
    for (const path of ["/", "/en/place/bethel/", "/docs/api.html", "/about.html", "/index.html"])
      expect(frameAncestors(path, false), path).toBe("'self'");
    for (const path of ["/en/place/bethel/", "/docs/api.html", "/index.html"])
      expect(frameAncestors(path, true), `${path}?embed=1`).toBe("'self'");
  });

  it("sends one Content-Security-Policy on every page", () => {
    for (const path of ["/", "/embed/v1", "/en/", "/docs/", "/data/places.geojson"])
      for (const embed of [false, true])
        expect(headersFor(path, embed).get("content-security-policy"), path).toBeDefined();
  });

  it("keeps the site on https, its subdomains too, and its window to itself", () => {
    const h = headersFor("/", false);
    expect(h.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
    expect(h.get("cross-origin-opener-policy")).toBe("same-origin");
  });

  it("sends a page asked for with a slash after .html to the page", () => {
    const r = vercel.redirects.find((x) => x.source.endsWith("\\.html)/"));
    expect(r?.permanent).toBe(true);
  });

  it("caches the built files for good and the data only as long as it may", () => {
    expect(headersFor("/assets/index-abc123.js", false).get("cache-control")).toContain(
      "immutable",
    );
    expect(headersFor("/data/places.geojson", false).get("cache-control")).toBe("public, no-cache");
    expect(headersFor("/sw.js", false).get("cache-control")).toBe("public, no-cache");
  });
});
