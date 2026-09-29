import { describe, expect, it } from "vitest";
import { groupSites, searchPlaces, type LoadedData, type PlaceProps } from "./data";

function place(
  id: string,
  name: string,
  name_ru: string | undefined,
  rank: number,
  verses: number,
): PlaceProps {
  return {
    id,
    name,
    ...(name_ru ? { name_ru } : {}),
    kind: "settlement",
    sites: 1,
    verses,
    nt: 0,
    ot: verses,
    rank,
    where: "",
    osis: [],
    coord: "openbible",
  };
}

const list = [
  place("a1", "Jerusalem", "Иерусалим", 0, 800),
  place("a2", "Jericho", "Иерихон", 1, 60),
  place("a3", "Jeruel", undefined, 3, 1),
  place("a4", "Bethlehem", "Вифлеем", 0, 40),
];
const data = {
  byId: new Map(
    list.map((p) => [p.id, { props: p, info: { id: p.id, at: [0, 0] as const, kind: p.kind } }]),
  ),
} as unknown as LoadedData;

describe("searchPlaces", () => {
  it("needs at least two characters", () => {
    expect(searchPlaces(data, "И")).toEqual([]);
  });

  it("finds by Russian and by English name, prefix matches first, then importance", () => {
    expect(searchPlaces(data, "иер").map((r) => r.props.id)).toEqual(["a1", "a2"]);
    expect(searchPlaces(data, "jer").map((r) => r.props.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("also matches inside a name, after prefix matches", () => {
    expect(searchPlaces(data, "лее").map((r) => r.props.id)).toEqual(["a4"]);
  });
});

describe("groupSites", () => {
  it("groups candidates by place, most supported first", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [1, 1] },
          properties: { place: "p", label: "B", share: 38 },
        },
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [2, 2] },
          properties: { place: "p", label: "A", share: 53 },
        },
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [3, 3] },
          properties: { place: "q", label: "C", share: 100 },
        },
      ],
    };
    const g = groupSites(fc);
    expect(g.get("p")?.map((s) => s.label)).toEqual(["A", "B"]);
    expect(g.get("p")?.[0]?.at).toEqual([2, 2]);
    expect(g.get("q")?.length).toBe(1);
  });

  it("keeps unrated candidates in source order, with no share", () => {
    const pt = (label: string) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [0, 0] },
      properties: { place: "u", label },
    });
    const g = groupSites({ type: "FeatureCollection", features: [pt("X"), pt("Y"), pt("Z")] });
    expect(g.get("u")?.map((s) => [s.label, s.share])).toEqual([
      ["X", null],
      ["Y", null],
      ["Z", null],
    ]);
  });
});
