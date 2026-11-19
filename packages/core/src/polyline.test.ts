import { describe, expect, it } from "vitest";
import { alongPath, pointsAlongPath } from "./polyline.ts";

describe("points along a way", () => {
  it("spaces a straight line evenly, both ends included", () => {
    expect(
      pointsAlongPath(
        [
          [0, 0],
          [4, 0],
        ],
        5,
      ),
    ).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ]);
  });

  it("follows a road round its corner, spaced by length, not by corner", () => {
    // Three units east, then one north: the fourth of five points is the corner itself.
    const pts = pointsAlongPath(
      [
        [0, 0],
        [3, 0],
        [3, 1],
      ],
      5,
    );
    expect(pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
    ]);
  });

  it("reads a way back as the same points, turned", () => {
    const way: [number, number][] = [
      [33.0, 37.1],
      [33.4, 37.3],
      [33.6, 37.5],
    ];
    const there = pointsAlongPath(way, 7);
    const back = pointsAlongPath([...way].reverse(), 7).reverse();
    back.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(there[i]?.[0] ?? 0, 9);
      expect(y).toBeCloseTo(there[i]?.[1] ?? 0, 9);
    });
  });

  it("gives one point, or the same point, without failing", () => {
    expect(pointsAlongPath([[5, 5]], 3)).toEqual([
      [5, 5],
      [5, 5],
      [5, 5],
    ]);
    expect(
      pointsAlongPath(
        [
          [1, 2],
          [3, 4],
        ],
        1,
      ),
    ).toEqual([[1, 2]]);
  });
});

describe("alongPath", () => {
  it("walks a polyline by length, from the first point to the last", () => {
    const at = alongPath([
      [0, -1],
      [2, -1],
      [2, 1],
    ]);
    expect(at(0)).toEqual([0, -1]);
    expect(at(0.5)).toEqual([2, -1]);
    expect(at(1)).toEqual([2, 1]);
  });

  it("counts a degree of longitude shorter away from the equator", () => {
    // About 60° a degree east is half a degree north: the corner is a third of the way.
    const at = alongPath([
      [0, 59],
      [2, 59],
      [2, 61],
    ]);
    const [x, y] = at(1 / 3);
    expect(x).toBeCloseTo(2, 9);
    expect(y).toBeCloseTo(59, 9);
  });

  it("stays at the ends outside 0 to 1", () => {
    const at = alongPath([
      [1, 1],
      [3, 1],
    ]);
    expect(at(-1)).toEqual([1, 1]);
    expect(at(2)).toEqual([3, 1]);
  });
});
