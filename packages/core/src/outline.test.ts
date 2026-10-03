import { describe, expect, it } from "vitest";
import { moveOutline, outlineCentre, outlineSize } from "./outline";

const km = (a: readonly [number, number], b: readonly [number, number]) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
};

describe("an outline carried elsewhere", () => {
  // A square about a kilometre on a side, at Jerusalem's latitude.
  const square: [number, number][] = [
    [35.225, 31.772],
    [35.2356, 31.772],
    [35.2356, 31.781],
    [35.225, 31.781],
    [35.225, 31.772],
  ];
  it("keeps its middle where it is asked to be", () => {
    const moved = moveOutline(square, [44.42, 32.54]); // Babylon
    const [x, y] = outlineCentre(moved);
    expect(x).toBeCloseTo(44.42, 6);
    expect(y).toBeCloseTo(32.54, 6);
  });
  it("keeps its size in kilometres, even far to the north", () => {
    const side = km(square[0] ?? [0, 0], square[1] ?? [0, 0]);
    const moved = moveOutline(square, [12.49, 55.68]); // Copenhagen
    expect(km(moved[0] ?? [0, 0], moved[1] ?? [0, 0])).toBeCloseTo(side, 2);
    expect(km(moved[1] ?? [0, 0], moved[2] ?? [0, 0])).toBeCloseTo(
      km(square[1] ?? [0, 0], square[2] ?? [0, 0]),
      2,
    );
  });
  it("measures its area and its length round, the same wherever it is laid", () => {
    const here = outlineSize(square);
    expect(here.area / 1e6).toBeCloseTo(1.0, 1);
    expect(here.perimeter / 1000).toBeCloseTo(4.0, 1);
    const there = outlineSize(moveOutline(square, [12.49, 55.68]));
    expect(there.area / here.area).toBeCloseTo(1, 3);
  });
});
