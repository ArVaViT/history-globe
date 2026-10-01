import { describe, expect, it } from "vitest";
import { routeWalker } from "./route-walker.ts";

describe("routeWalker", () => {
  it("walks a polyline by length, from the first point to the last", () => {
    const at = routeWalker([
      [0, 0],
      [2, 0],
      [2, 2],
    ]);
    expect(at(0)).toEqual([0, 0]);
    expect(at(0.5)[0]).toBeCloseTo(2, 5);
    expect(at(0.5)[1]).toBeCloseTo(0, 5);
    expect(at(1)).toEqual([2, 2]);
  });
});
