import { describe, expect, it } from "vitest";
import { chapterFocus, chapterLabel, firstVerseIn, parseChapterRef, readingOrder } from "./chapter";

const place = (id: string, osis: string[]) => ({
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [0, 0] },
  properties: { id, osis },
});
const data = {
  places: {
    type: "FeatureCollection" as const,
    features: [
      place("philippi", ["Acts.16.12", "Phil.1.1"]),
      place("troas", ["Acts.16.8", "Acts.20.5"]),
      place("shechem", ["Gen.12.6"]),
      place("zion", ["Ps.9.11", "Ps.10.1"]),
      place("temple", ["Ps.116.19"]),
    ],
  },
  tours: [
    {
      id: "paul-2",
      year: 50,
      stops: [{ placeId: "troas", at: [0, 0], ref: "Acts.16.8-Acts.16.10", note: {} }],
    },
  ],
} as unknown as Parameters<typeof chapterFocus>[0];

describe("chapter", () => {
  it("finds a chapter's places and the year of the tour that reads it", () => {
    expect(chapterFocus(data, "Acts.16")).toEqual({
      ref: "Acts.16",
      places: ["philippi", "troas"],
      year: 50,
    });
    // No tour reads Genesis 12 here: no year, the slider stays.
    expect(chapterFocus(data, "Gen.12")).toEqual({ ref: "Gen.12", places: ["shechem"] });
    expect(chapterFocus(data, "Gen.13")).toBeNull();
  });

  it("keeps to the verses of a Synodal psalm that is half an English one", () => {
    expect(chapterFocus(data, "Ps.116.10-Ps.116.19")?.places).toEqual(["temple"]);
    expect(chapterFocus(data, "Ps.116.1-Ps.116.9")).toBeNull();
    expect(chapterFocus(data, "Ps.9-Ps.10")?.places).toEqual(["zion"]);
  });

  it("names the chapter in the reader's numbering", () => {
    expect(chapterLabel("Ps.116.10-Ps.116.19", "ru")).toBe("Пс 115");
    expect(chapterLabel("Ps.9-Ps.10", "ru")).toBe("Пс 9");
    expect(chapterLabel("Ps.9-Ps.10", "en")).toBe("Ps 9–10");
    expect(chapterLabel("Acts.16", "ru")).toBe("Деян 16");
    expect(chapterLabel("Acts.16", "en")).toBe("Acts 16");
  });

  it("refuses what is not one chapter, a short run, or a verse range of one book", () => {
    expect(parseChapterRef("Acts.16")).toEqual({ book: "Acts", from: 16001, to: 16999 });
    expect(parseChapterRef("Ps.116.10-Ps.116.19")).toEqual({
      book: "Ps",
      from: 116010,
      to: 116019,
    });
    expect(parseChapterRef("Acts.16-Rom.1")).toBeNull();
    expect(parseChapterRef("Acts.0")).toBeNull();
    expect(parseChapterRef("Ps.1-Ps.150")).toBeNull();
    expect(parseChapterRef("Ps.2-Ps.1")).toBeNull();
  });
});

describe("readingOrder and firstVerseIn", () => {
  const osis: Record<string, string[]> = {
    philippi: ["Acts.16.12", "Acts.20.6", "Phil.1.1"],
    derbe: ["Acts.14.6", "Acts.16.1"],
    rome: ["Acts.28.14"],
  };
  it("orders a chapter's places as the text first names them", () => {
    expect(readingOrder(["philippi", "rome", "derbe"], (id) => osis[id] ?? [], "Acts.16")).toEqual([
      "derbe",
      "philippi",
      "rome",
    ]);
  });
  it("gives the first verse inside the chapter", () => {
    expect(firstVerseIn(osis.philippi ?? [], "Acts.16")).toBe("Acts.16.12");
    expect(firstVerseIn(osis.rome ?? [], "Acts.16")).toBeUndefined();
  });
});
