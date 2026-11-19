import { describe, expect, it } from "vitest";
import { attributionGaps, factMismatches, type Facts } from "./repo-facts.ts";

const facts: Facts = {
  named: 1231,
  records: 1288,
  articles: 746,
  questions: 200,
  tours: 62,
  events: 329,
  battles: 60,
  people: 2994,
  peopleOnMap: 2153,
  notes: 773,
  notedPlaces: 439,
  ancient: 1987,
  photos: 320,
  languages: 21,
  built: "2026-11-19",
};

describe("the front pages against the build", () => {
  const readme = `As of the release of 2026-11-17:
- 21 languages; 1,231 places named in the Bible (1,288 place
  records in all); 746 place articles and 200 answered questions.
- 62 tours, 329 dated events and 60
  battles; 2,994 people, 2,153 of them with their families.`;

  it("accepts numbers that are the build's, and an earlier date outside a release", () => {
    expect(factMismatches("README.md", readme, facts, false)).toEqual([]);
  });

  it("names a number that is not, across a line break", () => {
    expect(
      factMismatches("README.md", readme, { ...facts, battles: 61, records: 1290 }, false),
    ).toEqual([
      "README.md: «(1,288 place records», the build has 1290",
      "README.md: «60 battles», the build has 61",
    ]);
  });

  it("wants the data's own date in a release build, and never a later one", () => {
    expect(factMismatches("README.md", readme, facts, true)).toEqual([
      "README.md: «As of the release of 2026-11-17», the data is of 2026-11-19 (a release build)",
    ]);
    expect(factMismatches("CITATION.cff", "date-released: 2026-11-20", facts, false)).toHaveLength(
      1,
    );
  });
});

describe("the credits against the registry of sources", () => {
  const bibles = {
    ru: { file: "russyn_usfm.zip", page: "https://ebible.org/russyn/" },
    ro: {
      file: "ro-biblia1914_wikisource.json",
      page: "https://ro.wikisource.org/wiki/Biblia_1914",
    },
  };
  const credited =
    "OpenBible.info, Pleiades; Synodal (eBible.org russyn); https://ro.wikisource.org/wiki/Biblia_1914";
  const page = `OpenBible.info Pleiades <a href="https://ebible.org/russyn/">x</a> <a href="https://ro.wikisource.org/wiki/Biblia_1914">y</a>`;

  it("passes when every source and edition is credited in both", () => {
    expect(attributionGaps(["openbible", "pleiades"], bibles, credited, { en: page })).toEqual([]);
  });

  it("names a source left out, and one the check does not know", () => {
    expect(
      attributionGaps(["openbible", "itinere", "newset"], bibles, credited, {
        en: page.replace("https://ebible.org/russyn/", ""),
      }),
    ).toEqual([
      "docs/ATTRIBUTIONS.md: no credit for Itiner-e (itinere)",
      "docs/en/sources.html: no credit for Itiner-e (itinere)",
      'manifest.json: source "newset" has no name in SOURCE_NAMES (scripts/repo-facts.ts)',
      "docs/en/sources.html: no credit for the ru Bible (https://ebible.org/russyn/)",
    ]);
  });
});
