// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { medianYear, packChapterYears, yearOfRef } from "./chapter-years.ts";

const file = {
  books: {
    Acts: [
      { chapters: "13-14", year: 47 },
      { chapters: "16-17", year: 50 },
    ],
    "1Sam": [{ chapters: "16-31", year: -1024 }],
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
            { chapters: "1-5", year: 30 },
            { chapters: "5-29", year: 9000 },
          ],
          Xyz: [],
        },
      },
      [-3499, 1300],
    );
    expect(bad.errors).toEqual([
      "chapter-years: Acts 5-29 is not in the book",
      "chapter-years: Acts 5 year 9000 is off the map",
      "chapter-years: Acts 5 overlaps the run before it",
      "chapter-years: unknown book Xyz",
    ]);
  });
});
