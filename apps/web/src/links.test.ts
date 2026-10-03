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

  it("open 1-2 Maccabees where they are: the Synodal at Azbyka, an English Bible with the Apocrypha", () => {
    expect(verseUrl("1Macc.4.36-1Macc.4.59", "ru")).toBe("https://azbyka.ru/biblia/?1Mac.4:36-59");
    expect(verseUrl("2Macc.4.7-2Macc.5.2", "ru")).toBe("https://azbyka.ru/biblia/?2Mac.4:7-5:2");
    expect(verseUrl("1Macc.1.54", "ru")).toBe("https://azbyka.ru/biblia/?1Mac.1:54");
    expect(verseUrl("1Macc.1.54", "en")).toContain("version=NRSVUE");
  });

  it("put latitude first for Google Maps", () => {
    expect(mapsUrl([35.575, 32.881])).toBe(
      "https://www.google.com/maps/search/?api=1&query=32.881,35.575",
    );
  });
});
