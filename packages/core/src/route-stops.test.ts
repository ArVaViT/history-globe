import { describe, expect, it } from "vitest";
import type { LonLat } from "./renderer.ts";
import { groupByPoint, stopDiscs } from "./route-stops.ts";

const ANTIOCH: LonLat = [36.17, 36.23];
// Antioch at stops 1, 6, 12 and 15 (0-based 0, 5, 11, 14).
const journey: LonLat[] = Array.from({ length: 16 }, (_, i) =>
  [0, 5, 11, 14].includes(i) ? ANTIOCH : [30 + i, 35],
);

describe("groupByPoint", () => {
  it("groups items on one point, in the order the points first come", () => {
    const marks = [
      { n: 1, at: [35.2, 31.7] as LonLat },
      { n: 2, at: [35.5, 32.8] as LonLat },
      { n: 3, at: [35.200001, 31.700001] as LonLat },
    ];
    expect(groupByPoint(marks, (m) => m.at).map((g) => g.map((m) => m.n))).toEqual([[1, 3], [2]]);
  });
});

describe("stopDiscs", () => {
  const antioch = (current: number) => stopDiscs(journey, current).find((d) => d.at === ANTIOCH);

  it("draws a place the way comes back to as one disc", () => {
    expect(stopDiscs(journey, 0)).toHaveLength(13);
  });

  it("holds the current stop there, the others beside it", () => {
    expect(antioch(5)).toEqual({ at: ANTIOCH, shown: 5, also: [0, 11, 14] });
  });

  it("holds the next stop there while the tour is elsewhere, the last one after it", () => {
    expect(antioch(6)?.shown).toBe(11);
    expect(antioch(15)?.shown).toBe(14);
  });
});
