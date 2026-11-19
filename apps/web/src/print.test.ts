import { describe, expect, it } from "vitest";
import { buildStyle } from "@hg/core";
import { loadDictionary } from "./i18n";
import { CREDIT_WORDS, readableLink, sheetCredits } from "./print";
import { TERRAIN_ATTRIBUTION } from "./terrain";

describe("readableLink", () => {
  it("prints a lesson's name in its own letters, and types back to the same link", () => {
    const q = new URLSearchParams({ lesson: "a15257a~30", title: "Павел в Афинах: R&D #1 + 50%" });
    const link = `https://example.org/?${q.toString()}`;
    const shown = readableLink(link);
    expect(shown).toContain("title=Павел+в+Афинах:+R%26D+%231+%2B+50%25");
    expect(new URL(shown).searchParams.get("title")).toBe(q.get("title"));
    expect(new URL(shown).searchParams.get("lesson")).toBe("a15257a~30");
  });

  it("leaves a link with no query as it is", () => {
    expect(readableLink("https://example.org/")).toBe("https://example.org/");
  });
});

describe("the sheet's credits", () => {
  it("find every English word they translate in the map's own credits", () => {
    const style = buildStyle({
      dataUrl: "/data",
      terrainTiles: "https://example.org/{z}/{x}/{y}.webp",
      terrainAttribution: TERRAIN_ATTRIBUTION,
      fonts: {},
      initialYear: 30,
      initialLocale: "en",
    });
    const credits = [
      TERRAIN_ATTRIBUTION,
      ...Object.values(style.sources).map((s) => ("attribution" in s ? (s.attribution ?? "") : "")),
    ].join(" · ");
    for (const [english] of CREDIT_WORDS)
      expect(typeof english === "string" ? credits.includes(english) : english.test(credits)).toBe(
        true,
      );
  });

  it("put them in the sheet's language", async () => {
    await loadDictionary("de");
    const de = sheetCredits(
      "Ancient sites: Pleiades · Roman roads: Itiner-e (Brughmans et al. 2025)",
      "de",
    );
    expect(de).not.toContain("Ancient sites:");
    expect(de).not.toContain("Roman roads:");
  });
});
