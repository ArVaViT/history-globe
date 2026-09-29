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
  const tour = {
    id: "t",
    title: { en: "T", ru: "Т" },
    year: "AD 47",
    stops: [
      { place: "ae41ab4", ref: "Acts.13.1", note: { en: "a", ru: "а" } },
      { place: "a6d306d", ref: "Acts.13.4", note: { en: "b", ru: "б" } },
    ],
  };

  it("converts the year label to an astronomical year", () => {
    expect(TourFile.parse(tour).year).toBe(47);
  });

  it("refuses an approximate year instead of rounding it silently", () => {
    expect(() => TourFile.parse({ ...tour, year: "c. 47 AD" })).toThrow();
  });

  it("rejects misspelt fields in the tour and in its stops", () => {
    expect(() => TourFile.parse({ ...tour, yaer: "AD 47" })).toThrow();
    const [first, second] = tour.stops;
    expect(() => TourFile.parse({ ...tour, stops: [{ ...first, nte: "x" }, second] })).toThrow();
  });
});
