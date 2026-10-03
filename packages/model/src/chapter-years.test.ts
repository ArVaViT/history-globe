import { describe, expect, it } from "vitest";
import { medianYear, packChapterYears, yearOfRef } from "./chapter-years.ts";

const file = {
  books: {
    Acts: [
      { chapters: "13-14", year: 47, approx: true, note: "first journey" },
      { chapters: "16-17", year: 50, approx: true, note: "Philippi" },
    ],
    "1Sam": [{ chapters: "16-31", year: -1024, approx: true, note: "David and Saul" }],
  },
};
const { table, errors } = packChapterYears(file, [-3499, 1300]);

describe("chapter years", () => {
  it("packs a valid table without errors", () => {
    expect(errors).toEqual([]);
    expect(table.Acts).toEqual([
      [13, 14, 47],
      [16, 17, 50],
    ]);
  });
  it("dates a verse, a chapter and a range by its first chapter", () => {
    expect(yearOfRef("Acts.16.12", table)).toBe(50);
    expect(yearOfRef("Acts.14", table)).toBe(47);
    expect(yearOfRef("Acts.16.1-Acts.17.3", table)).toBe(50);
    expect(yearOfRef("Acts.15.1", table)).toBeUndefined();
    expect(yearOfRef("Gen.1.1", table)).toBeUndefined();
  });
  it("takes the middle year of a person's verses", () => {
    expect(medianYear(["Acts.13.4", "Acts.16.12", "Acts.17.1", "Gen.1.1"], table)).toBe(50);
    expect(medianYear(["Gen.1.1"], table)).toBeUndefined();
  });
  it("reports runs that overlap, leave the book or leave the map", () => {
    const bad = packChapterYears(
      {
        books: {
          Acts: [
            { chapters: "1-5", year: 30, approx: true, note: "a" },
            { chapters: "5-29", year: 9000, approx: true, note: "b" },
          ],
          Xyz: [],
        },
      },
      [-3499, 1300],
    );
    expect(bad.errors).toHaveLength(4);
  });
});
