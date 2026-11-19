import { describe, expect, it } from "vitest";
import { areaOf, booleanOp, insideRings, repairPolygons, selfCrossings } from "./polygon-ops.ts";
import type { Ring } from "./geo.ts";

const box = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const total = (polys: Ring[][]) =>
  polys.reduce(
    (a, poly) => a + areaOf(poly[0] ?? []) - poly.slice(1).reduce((h, r) => h + areaOf(r), 0),
    0,
  );

describe("booleanOp", () => {
  const a = box(0, 0, 2, 2);
  const b = box(1, 1, 3, 3);
  it("joins, cuts and intersects two crossing squares", () => {
    expect(total(booleanOp([a], [b], "union"))).toBeCloseTo(7);
    expect(total(booleanOp([a], [b], "intersection"))).toBeCloseTo(1);
    expect(total(booleanOp([a], [b], "difference"))).toBeCloseTo(3);
    expect(booleanOp([a], [b], "union")).toHaveLength(1);
  });
  it("keeps one ring where two squares share an edge", () => {
    const right = box(2, 0, 4, 2);
    const u = booleanOp([a], [right], "union");
    expect(u).toHaveLength(1);
    expect(total(u)).toBeCloseTo(8);
    expect(total(booleanOp([a], [right], "difference"))).toBeCloseTo(4);
    expect(total(booleanOp([a], [right], "intersection"))).toBeCloseTo(0);
  });
  it("leaves a hole when the cut lies inside", () => {
    const d = booleanOp([box(0, 0, 4, 4)], [box(1, 1, 2, 2)], "difference");
    expect(d).toHaveLength(1);
    expect(d[0]).toHaveLength(2);
    expect(total(d)).toBeCloseTo(15);
    expect(insideRings([1.5, 1.5], d.flat())).toBe(false);
    expect(insideRings([3, 3], d.flat())).toBe(true);
  });
  it("adds a part apart from the shape as its own polygon", () => {
    const u = booleanOp([a], [box(5, 5, 6, 6)], "union");
    expect(u).toHaveLength(2);
    expect(total(u)).toBeCloseTo(5);
  });
  it("cuts a concave shape against a convex one", () => {
    // A "C" open to the east, its gap filled by the square.
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
    const u = booleanOp([c], [box(0.5, 0.5, 3, 2.5)], "union");
    expect(total(u)).toBeCloseTo(9);
    expect(selfCrossings(u.flat())).toEqual([]);
  });
  it("returns rings that never cross", () => {
    const star: Ring = [
      [0, 0],
      [4, 1],
      [8, 0],
      [7, 4],
      [8, 8],
      [4, 7],
      [0, 8],
      [1, 4],
      [0, 0],
    ];
    for (const op of ["union", "intersection", "difference"] as const)
      expect(selfCrossings(booleanOp([star], [box(2, 2, 9, 5)], op).flat())).toEqual([]);
  });
});

describe("selfCrossings and repairPolygons", () => {
  it("keeps a hole of a ring that crosses itself", () => {
    const outer: Ring = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [2, 4.5],
      [0, 4],
      [0, 0],
    ];
    const fixed = repairPolygons([[outer, box(1, 1, 2, 2)]]);
    expect(selfCrossings(fixed.flat())).toEqual([]);
    expect(insideRings([1.5, 1.5], fixed.flat())).toBe(false);
    expect(insideRings([3, 3], fixed.flat())).toBe(true);
  });
  const bowtie: Ring = [
    [0, 0],
    [2, 2],
    [2, 0],
    [0, 2],
    [0, 0],
  ];
  it("finds a ring crossing itself, not a simple one", () => {
    expect(selfCrossings([bowtie])).toHaveLength(1);
    expect(selfCrossings([box(0, 0, 1, 1)])).toEqual([]);
  });
  it("splits a bow tie into its two loops", () => {
    const fixed = repairPolygons([[bowtie]]);
    expect(fixed).toHaveLength(2);
    expect(selfCrossings(fixed.flat())).toEqual([]);
    expect(total(fixed)).toBeCloseTo(2);
  });
  it("drops repeated points and pieces below the minimum area", () => {
    const r: Ring = [
      [0, 0],
      [1, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const fixed = repairPolygons([[r], [box(5, 5, 5.001, 5.001)]], 0.01);
    expect(fixed).toHaveLength(1);
    expect(fixed[0]?.[0]).toHaveLength(5);
  });
  it("joins overlapping parts into one", () => {
    const fixed = repairPolygons([[box(0, 0, 2, 2)], [box(1, 1, 3, 3)]]);
    expect(fixed).toHaveLength(1);
    expect(total(fixed)).toBeCloseTo(7);
  });
});
