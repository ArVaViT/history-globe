// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_FIXED } from "../packages/model/src/reservation.ts";

// What apps/web/vercel.json promises the reader and a host page, held so that a later edit
// cannot drop it unnoticed. Vercel matches a source with path-to-regexp, strict and
// case-sensitive; `sourceRegex` below is enough for the plain sources used here.

interface Rule {
  source: string;
  has?: { type: string; key: string; value?: string }[];
  missing?: { type: string; key: string; value?: string }[];
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

/** Whether a query condition holds for the query asked. */
function holds(c: { type: string; key: string; value?: string }, query: Record<string, string>) {
  const v = query[c.key];
  return c.type === "query" && v !== undefined && (c.value ?? v) === v;
}

/** The headers Vercel sends for a path: `true` is `?embed=1`, a string `?embed=<it>`. */
function headersFor(
  path: string,
  embedArg: boolean | string,
  more: Record<string, string> = {},
): Map<string, string> {
  const query: Record<string, string> = { ...more };
  if (embedArg !== false) query["embed"] = embedArg === true ? "1" : embedArg;
  const out = new Map<string, string>();
  for (const r of vercel.headers) {
    if (!sourceRegex(r.source).test(path)) continue;
    if (r.has && !r.has.every((c) => holds(c, query))) continue;
    if (r.missing?.some((c) => holds(c, query))) continue;
    for (const h of r.headers) out.set(h.key.toLowerCase(), h.value);
  }
  return out;
}
const frameAncestors = (path: string, embed: boolean | string) =>
  /frame-ancestors ([^;]+)/.exec(headersFor(path, embed).get("content-security-policy") ?? "")?.[1];

describe("vercel.json", () => {
  it("lets any site frame the embed and the app it opens, and nothing else", () => {
    expect(frameAncestors("/embed/v1", false)).toBe("*");
    expect(frameAncestors("/", true)).toBe("*");
    for (const path of ["/", "/en/place/bethel/", "/docs/api.html", "/about.html", "/index.html"])
      expect(frameAncestors(path, false), path).toBe("'self'");
    for (const path of ["/en/place/bethel/", "/docs/api.html", "/index.html"])
      expect(frameAncestors(path, true), `${path}?embed=1`).toBe("'self'");
    // The app reads only embed=1 as embedded (apps/web/src/url.ts).
    for (const value of ["0", "", "yes"])
      expect(frameAncestors("/", value), `/?embed=${value}`).toBe("'self'");
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

  // A lesson's title is in the address (?title=): even the site's own requests (an article,
  // the visit count) send only the origin as referrer, never the page's address.
  it("sends only the origin as referrer, to the site itself too", () => {
    for (const path of ["/", "/en/place/bethel/", "/docs/privacy.html"])
      expect(headersFor(path, false).get("referrer-policy")).toBe("strict-origin");
  });

  it("sends a page asked for with a slash after .html to the page", () => {
    const r = vercel.redirects.find((x) => x.source.endsWith("\\.html)/"));
    expect(r?.permanent).toBe(true);
  });

  // English documentation has no folder of its own (/docs/api.html); /docs/en/… is a guess
  // a reader makes from the other languages' addresses (/docs/ru/api.html).
  it("sends /docs/en/ and every page under it to the English documentation", () => {
    const to = (source: string) => {
      const r = vercel.redirects.find((x) => x.source === source);
      expect(r?.permanent, source).toBe(true);
      return r?.destination;
    };
    expect(to("/docs/en")).toBe("/docs/");
    expect(to("/docs/en/")).toBe("/docs/");
    expect(to("/docs/en/:path+")).toBe("/docs/:path+");
  });

  it("caches a stylesheet for good only at an address with its version", () => {
    for (const path of ["/pages.css", "/docs/docs.css"]) {
      expect(headersFor(path, false, { v: "3f9c0a1b2c4d" }).get("cache-control")).toContain(
        "immutable",
      );
      expect(headersFor(path, false).get("cache-control"), path).toBeUndefined();
    }
  });

  it("caches the built files for good and the data only as long as it may", () => {
    expect(headersFor("/assets/index-abc123.js", false).get("cache-control")).toContain(
      "immutable",
    );
    expect(headersFor("/data/places.geojson", false).get("cache-control")).toBe("public, no-cache");
    expect(headersFor("/sw.js", false).get("cache-control")).toBe("public, no-cache");
  });

  // The reservation of text and data mining stands on the articles and the answers alone
  // (packages/model/src/reservation.ts): the data, the API, the map and the other pages are
  // sent without it. The place pages that carry an article say it in their own head.
  it("sends tdm-reservation on the articles' and the answers' fixed paths, and nowhere else", () => {
    const reserved = (path: string) => headersFor(path, false).get("tdm-reservation");
    for (const path of [
      "/data/articles/en.json",
      "/api/v1/questions.json",
      "/en/q/from-dan-to-beersheba/",
      "/uk/q/from-dan-to-beersheba/",
      "/en/questions/",
      "/bg/questions/",
    ])
      expect(reserved(path), path).toBe("1");
    for (const path of [
      "/",
      "/api/v1/places.json",
      "/api/v1/index.json",
      "/data/places.geojson",
      "/en/place/bethel/",
      "/en/places/",
      "/en/tour/paul-1/",
      "/embed/v1",
      "/docs/build.html",
      "/.well-known/tdmrep.json",
      "/robots.txt",
    ])
      expect(reserved(path), path).toBeUndefined();
    // Every fixed path reservation.ts names has the header, in every language.
    for (const pattern of RESERVED_FIXED)
      for (const l of ["en", "vi"]) {
        const path = pattern.replace("*", l) + (pattern.endsWith("/") ? "x/" : "");
        expect(reserved(path), path).toBe("1");
      }
  });
});
