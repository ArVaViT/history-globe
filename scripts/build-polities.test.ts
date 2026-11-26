// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { checkPolities, isSliver, tidy } from "./build-polities.ts";
import { selfCrossings } from "./polygon-ops.ts";
import type { Ring } from "./geo.ts";

const box = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const shape = (name: string, y0: number, y1: number, ...rings: Ring[]) => ({
  geometry: { type: "MultiPolygon" as const, coordinates: rings.map((r) => [r]) },
  properties: { name, y0, y1 },
});
const run = (over: Partial<Parameters<typeof checkPolities>[0]>): string[] => {
  const errors: string[] = [];
  checkPolities({
    shapes: [],
    clips: [],
    cutAways: [],
    water: [],
    anchors: [],
    pointOf: () => undefined,
    drawn: new Set(),
    errors,
    ...over,
  });
  return errors;
};

describe("tidy", () => {
  it("rounds to three decimals and drops repeated points and spikes", () => {
    const ring: Ring = [
      [0, 0],
      [1.00001, 0],
      [1, 0],
      [1, 1],
      [1, 2], // a spike: out and straight back
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const [poly] = tidy([[ring]]);
    const r = poly?.[0] ?? [];
    expect(r.some((p, i) => i > 0 && p[0] === r[i - 1]?.[0] && p[1] === r[i - 1]?.[1])).toBe(false);
    expect(r.some(([, y]) => y === 2)).toBe(false);
  });
  it("splits a bow tie so no ring crosses itself", () => {
    const bow: Ring = [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 2],
      [0, 0],
    ];
    expect(selfCrossings([bow]).length).toBeGreaterThan(0);
    expect(selfCrossings(tidy([[bow]]).flat())).toHaveLength(0);
  });
  it("drops specks and slivers and keeps land", () => {
    expect(isSliver(box(0, 0, 0.001, 0.001))).toBe(true);
    expect(isSliver(box(0, 0, 2, 0.0002))).toBe(true);
    expect(isSliver(box(0, 0, 1, 1))).toBe(false);
    expect(tidy([[box(0, 0, 0.001, 0.001)], [box(5, 5, 6, 6)]])).toHaveLength(1);
  });
});

describe("checkPolities", () => {
  it("fails a shape that crosses itself", () => {
    const bow: Ring = [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 2],
      [0, 0],
    ];
    expect(run({ shapes: [shape("A", 0, 10, bow)] }).join()).toMatch(/a crossing at 1.000,1.000/);
  });
  it("fails an anchor outside its state and passes one inside or in a listed gap", () => {
    const shapes = [shape("A", -100, 0, box(0, 0, 2, 2)), shape("B", 0, 50, box(5, 5, 6, 6))];
    const anchor = {
      name: "Town",
      at: [1, 1] as [number, number],
      periods: [{ first_year: -100, last_year: 49, polity: "A" }],
    };
    expect(run({ shapes, anchors: [anchor] }).join()).toMatch(
      /Town 1 BC-AD 49: in no state, not A/,
    );
    expect(
      run({
        shapes,
        anchors: [
          {
            ...anchor,
            periods: [{ first_year: -100, last_year: -1, polity: "A" }],
            blank: [{ first_year: 0, last_year: 49, reason: "gone" }],
          },
        ],
      }),
    ).toEqual([]);
  });
  it("fails an anchor whose card names another state drawn over it", () => {
    const empire = shape("Empire", 0, 10, box(0, 0, 10, 10));
    const raid = shape("Raiders", 5, 7, box(0, 0, 2, 2));
    const anchor = {
      name: "City",
      at: [1, 1] as [number, number],
      periods: [{ first_year: 0, last_year: 9, polity: "Empire" }],
    };
    expect(run({ shapes: [empire, raid], anchors: [anchor] }).join()).toMatch(
      /City AD 5-AD 6: in Raiders within Empire, not Empire/,
    );
    expect(run({ shapes: [empire], anchors: [anchor] })).toEqual([]);
  });
  it("fails a clip that leaves land blank unless it says so", () => {
    const cutAways = [{ k: 0, y0: 0, y1: 10, rings: [box(0, 0, 1, 1)] }];
    expect(run({ clips: [{ name: "A", blank: false }], cutAways }).join()).toMatch(
      /clip 1 of "A" leaves 100%/,
    );
    expect(run({ clips: [{ name: "A", blank: true }], cutAways })).toEqual([]);
    const held = [shape("B", 0, 10, box(-1, -1, 2, 2))];
    expect(run({ shapes: held, clips: [{ name: "A", blank: false }], cutAways })).toEqual([]);
  });
  it("fails a drawn state over a neighbour it does not subtract", () => {
    const shapes = [shape("Ours", 0, 10, box(0, 0, 2, 2)), shape("B", 0, 10, box(1, 0, 3, 2))];
    expect(run({ shapes, drawn: new Set(["Ours"]) }).join()).toMatch(/drawn "Ours" covers/);
  });
});
