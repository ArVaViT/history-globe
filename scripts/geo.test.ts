import { describe, expect, it } from "vitest";
import { pointInRing, type Ring, ringArea } from "./geo.ts";

const square: Ring = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [0, 0],
];
// A "C" open to the east: its middle lies outside.
const c: Ring = [
  [0, 0],
  [3, 0],
  [3, 1],
  [1, 1],
  [1, 2],
  [3, 2],
  [3, 3],
  [0, 3],
  [0, 0],
];

describe("pointInRing", () => {
  it("tells inside from outside, a concave ring too", () => {
    expect(pointInRing([1, 1], square)).toBe(true);
    expect(pointInRing([3, 1], square)).toBe(false);
    expect(pointInRing([0.5, 1.5], c)).toBe(true);
    expect(pointInRing([2, 1.5], c)).toBe(false);
  });
});

describe("ringArea", () => {
  it("is the same either way round", () => {
    expect(ringArea(square)).toBe(4);
    expect(ringArea([...square].reverse())).toBe(4);
    expect(ringArea(c)).toBe(7);
  });
});
