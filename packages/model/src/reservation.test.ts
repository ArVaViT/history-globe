// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { isReserved, patternMatches, robotsTxt, tdmrep } from "./reservation.ts";

describe("the reservation of text and data mining (LICENSING.md, part 2)", () => {
  const slugs = ["jerusalem", "bethel-a1"];

  it("stands on the articles and the answers, in every language", () => {
    for (const path of [
      "/en/place/jerusalem/",
      "/vi/place/jerusalem/index.html",
      "/ru/place/bethel-a1/",
      "/en/q/from-dan-to-beersheba/",
      "/bg/questions/",
      "/data/articles/en.json",
      "/api/v1/questions.json",
    ])
      expect(isReserved(path, slugs), path).toBe(true);
  });

  it("leaves the data, the API, the map and the other pages free", () => {
    for (const path of [
      "/",
      "/api/v1/places.json",
      "/api/v1/index.json",
      "/api/v1/verses/Acts.json",
      "/data/places.geojson",
      "/data/photos/x.jpg",
      "/en/place/bethel/",
      "/en/place/jerusalem-b/",
      "/en/places/",
      "/en/tour/paul-1/",
      "/embed/v1",
      "/docs/build.html",
      "/hg-places.js",
    ])
      expect(isReserved(path, slugs), path).toBe(false);
  });

  it("says the same in tdmrep.json, first match first, everything else not reserved", () => {
    const rules = tdmrep(slugs);
    const first = (path: string) => rules.find((r) => patternMatches(r.location, path));
    expect(first("/en/place/jerusalem/")?.["tdm-reservation"]).toBe(1);
    expect(first("/api/v1/places.json")?.["tdm-reservation"]).toBe(0);
    expect(rules.at(-1)).toEqual({ location: "/", "tdm-reservation": 0 });
  });

  it("names no ai-train signal for the whole site in robots.txt", () => {
    const text = robotsTxt(slugs);
    expect(text).not.toContain("ai-train=no");
    expect(text).toContain("Disallow: /*/place/jerusalem/");
    expect(text).toContain("Disallow: /api/v1/questions.json");
  });
});
