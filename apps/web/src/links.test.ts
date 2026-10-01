import { describe, expect, it } from "vitest";
import { mapsUrl, verseUrl } from "./links";

describe("links", () => {
  it("open a verse in the Synodal text in Russian, in the ESV in English", () => {
    expect(verseUrl("Ps.68.15", "ru")).toBe(
      "https://www.biblegateway.com/passage/?search=Ps.68.15&version=RUSV",
    );
    expect(verseUrl("Acts.13.1-Acts.14.28", "en")).toContain(
      "search=Acts.13.1-Acts.14.28&version=ESV",
    );
  });

  it("put latitude first for Google Maps", () => {
    expect(mapsUrl([35.575, 32.881])).toBe(
      "https://www.google.com/maps/search/?api=1&query=32.881,35.575",
    );
  });
});
