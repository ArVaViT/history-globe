import { describe, expect, it } from "vitest";
import type { Ring } from "./geo.ts";
import { insideRings, selfCrossings } from "./polygon-ops.ts";
import { reachCoast, WaterGrid } from "./polity-coast.ts";

const box = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];

// The sea east of 31.0 E; the land west of it.
const sea = box(31, 29, 33, 33);
const water = new WaterGrid([sea], [28, 28, 34, 34], 0.01);

describe("WaterGrid", () => {
  it("tells sea from land, with rings off the grid ignored", () => {
    const g = new WaterGrid([sea, box(-90, 30, -89, 31)], [28, 28, 34, 34], 0.01);
    expect(g.at([32, 31])).toBe(true);
    expect(g.at([30.5, 31])).toBe(false);
    expect(g.at([40, 31])).toBe(false);
  });
});

describe("reachCoast", () => {
  // A state whose coast runs 0.08 degrees inland of the shore; a port on the shore.
  const state = { polys: [[box(30, 30, 30.92, 32)]], y0: -800, y1: -700, name: "A" };
  const port: [number, number] = [30.99, 31];
  it("brings the shape out to the shore and past it", () => {
    expect(insideRings(port, state.polys.flat())).toBe(false);
    const reached = reachCoast(state, [], water);
    expect(reached).not.toBeNull();
    const rings = (reached ?? []).flat();
    expect(insideRings(port, rings)).toBe(true);
    expect(selfCrossings(rings)).toEqual([]);
    // Inland it is unchanged.
    expect(insideRings([29.9, 31], rings)).toBe(false);
  });
  it("leaves a strip another state holds", () => {
    const other = { polys: [[box(30.92, 30, 31.5, 32)]], y0: -750, y1: -650, name: "B" };
    expect(reachCoast(state, [other], water)).toBeNull();
  });
  it("does nothing to a shape far from the sea", () => {
    expect(reachCoast({ ...state, polys: [[box(28.5, 30, 29.5, 32)]] }, [], water)).toBeNull();
  });
});
