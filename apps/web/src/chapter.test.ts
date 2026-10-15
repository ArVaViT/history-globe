import { describe, expect, it } from "vitest";
import {
  chapterFocus,
  chapterLabel,
  chapterRoute,
  firstVerseIn,
  framePlaces,
  parseChapterRef,
  readingOrder,
  withoutYear,
} from "./chapter";

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

describe("a chapter's frame and way", () => {
  const at = (lon: number, lat: number) => [lon, lat] as const;
  it("leaves wide areas and a far place named once out of the frame", () => {
    // Acts 27 in miniature: Italy (a region at Rome) and the Adriatic would stretch it.
    const ids = framePlaces([
      { id: "sidon", at: at(35.4, 33.6), kind: "settlement", mentions: 1 },
      { id: "myra", at: at(30.0, 36.3), kind: "settlement", mentions: 1 },
      { id: "fair-havens", at: at(24.8, 34.9), kind: "settlement", mentions: 2 },
      { id: "italy", at: at(12.5, 41.9), kind: "region", mentions: 2 },
      { id: "adriatic", at: at(19.0, 38.0), kind: "body of water", mentions: 1 },
    ]);
    expect(ids).toEqual(["sidon", "myra", "fair-havens"]);
    // Jerusalem named once in Acts 16, far from Macedonia and Asia, halves the frame: out.
    const acts16 = framePlaces([
      { id: "derbe", at: at(33.4, 37.4), kind: "settlement", mentions: 1 },
      { id: "lystra", at: at(32.3, 37.6), kind: "settlement", mentions: 2 },
      { id: "troas", at: at(26.2, 39.8), kind: "settlement", mentions: 2 },
      { id: "philippi", at: at(24.3, 41.0), kind: "settlement", mentions: 1 },
      { id: "thyatira", at: at(27.8, 38.9), kind: "settlement", mentions: 1 },
      { id: "jerusalem", at: at(35.2, 31.8), kind: "settlement", mentions: 1 },
    ]);
    expect(acts16).not.toContain("jerusalem");
    expect(acts16).toHaveLength(5);
    // Only wide areas: they are what there is to frame.
    expect(
      framePlaces([
        { id: "egypt", at: at(31, 27), kind: "region", mentions: 3 },
        { id: "nile", at: at(31, 30), kind: "river", mentions: 1 },
      ]),
    ).toEqual(["egypt", "nile"]);
  });

  it("draws the chapter's stops of a walked tour, from the stop before", () => {
    const stop = (ref: string, lon: number) => ({ placeId: ref, at: at(lon, 0), ref, note: {} });
    const tour = {
      stops: [
        stop("Acts.26.1", 1),
        stop("Acts.27.3", 2),
        stop("Acts.27.5", 3),
        stop("Acts.28.1", 4),
      ],
    };
    const in27 = (r: string) => r.startsWith("Acts.27.");
    expect(chapterRoute(tour, in27)).toEqual({
      at: [at(1, 0), at(2, 0), at(3, 0)],
      places: ["Acts.26.1", "Acts.27.3", "Acts.27.5"],
    });
    // A survey of empires is not a way travelled; nor is a single point.
    expect(chapterRoute({ ...tour, walked: false }, in27)).toBeNull();
    expect(chapterRoute({ stops: [stop("Acts.27.3", 2)] }, in27)).toBeNull();
    expect(chapterRoute(undefined, in27)).toBeNull();
  });

  it("drops only the year from a chapter", () => {
    const way = { route: [at(1, 2), at(3, 4)], routePlaces: ["a", "b"] };
    const focus = { ref: "Acts.27", places: ["a"], year: 60, ...way };
    expect(withoutYear(focus)).toEqual({ ref: "Acts.27", places: ["a"], ...way });
  });
});
