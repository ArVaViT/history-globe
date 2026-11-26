import { describe, expect, it } from "vitest";
import type { PlaceInfo } from "@hg/core";
import { lessonTour } from "./lesson-tour";

const place = (osis: string[], at: [number, number]) => ({
  props: { osis },
  info: { at } as unknown as PlaceInfo,
});
const byId = new Map([
  ["a7e13e1", place(["Josh.7.2", "Ezra.2.28"], [35.26, 31.92])],
  ["a64f355", place(["Gen.12.8"], [35.22, 31.93])],
]);

describe("lesson tour", () => {
  it("leads a merged record's old id to its place (ADR 0022)", () => {
    const aliases = new Map([["a63c70b", "a7e13e1"]]);
    const tour = lessonTour("?lesson=a63c70b~-500.a64f355", byId, {}, aliases);
    expect(tour?.stops.map((s) => s.placeId)).toEqual(["a7e13e1", "a64f355"]);
    expect(tour?.stops[0]?.at).toEqual([35.26, 31.92]);
  });

  it("counts a place once when the old and the new id are both in the link", () => {
    const aliases = new Map([["a63c70b", "a7e13e1"]]);
    expect(lessonTour("?lesson=a7e13e1.a63c70b", byId, {}, aliases)).toBeNull();
  });

  it("drops an unknown id, as before", () => {
    expect(lessonTour("?lesson=a63c70b.a64f355", byId, {})).toBeNull();
  });
});
