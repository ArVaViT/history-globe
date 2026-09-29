import { describe, expect, it } from "vitest";
import { searchPlaces, type LoadedData, type PlaceProps } from "./data";

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
