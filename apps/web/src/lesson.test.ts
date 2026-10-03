import { describe, expect, it } from "vitest";
import { lessonSearch, lessonStops, lessonTitle } from "./lesson";

describe("lesson links", () => {
  it("reads the places and their years, in order, once each", () => {
    expect(lessonStops("?lesson=a15257a~30.a112427~-5.a15257a.zz.af5884f")).toEqual([
      { id: "a15257a", year: 30 },
      { id: "a112427", year: -5 },
      { id: "af5884f" },
    ]);
  });

  it("writes what it reads", () => {
    const stops = [{ id: "a15257a", year: -585 }, { id: "a112427" }];
    expect(lessonStops(lessonSearch(stops, "ru"))).toEqual(stops);
  });

  it("keeps the lesson's name, trimmed and cut, and none when it has none", () => {
    const stops = [{ id: "a15257a" }, { id: "a112427" }];
    expect(lessonTitle(lessonSearch(stops, "ru", "  Путь Павла & Варнавы "))).toBe(
      "Путь Павла & Варнавы",
    );
    expect(lessonSearch(stops, "ru", "  ")).not.toContain("title");
    expect(lessonTitle(`?title=${"я".repeat(200)}`)).toHaveLength(80);
  });
});
