import { describe, expect, it } from "vitest";
import { PlaceNamesFile, TourFile } from "./content.ts";

describe("PlaceNamesFile", () => {
  const entry = {
    id: "aa21f26",
    en: "Etam",
    ru: "Ефам",
    evidence: { osis: "2Chr.11.6", excerpt: "Он укрепил Вифлеем и Ефам" },
  };

  it("keeps the evidence (it must never be silently dropped)", () => {
    expect(PlaceNamesFile.parse({ places: [entry] }).places[0]?.evidence?.excerpt).toBe(
      entry.evidence.excerpt,
    );
  });

  it("rejects unknown fields instead of dropping them", () => {
    expect(() => PlaceNamesFile.parse({ places: [{ ...entry, source: "x" }] })).toThrow();
  });

  it("rejects an invalid verse reference in the evidence", () => {
    expect(() =>
      PlaceNamesFile.parse({
        places: [{ ...entry, evidence: { ...entry.evidence, osis: "Enoch.1.1" } }],
      }),
    ).toThrow();
  });
});

describe("TourFile", () => {
  it("converts the year label to an astronomical year", () => {
    const tour = TourFile.parse({
      id: "t",
      title: { en: "T", ru: "Т" },
      year: "AD 47",
      stops: [
        { place: "ae41ab4", ref: "Acts.13.1", note: { en: "a", ru: "а" } },
        { place: "a6d306d", ref: "Acts.13.4", note: { en: "b", ru: "б" } },
      ],
    });
    expect(tour.year).toBe(47);
  });
});
