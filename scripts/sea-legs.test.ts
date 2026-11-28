import { describe, expect, it } from "vitest";
import { Water } from "./content-checks.ts";
import { landRuns, seaLegCrossing, seaLegErrors } from "./sea-legs.ts";

// A sea 2° a side with a square island in its middle, 0.4° (about 40 km) across. The island
// is a hole joined to the outer ring by a zero-width cut, as water.geojson draws one.
const sea: [number, number][] = [
  [30, 34],
  [32, 34],
  [32, 36],
  [30, 36],
  [30, 34],
];
const island: [number, number][] = [
  [30.8, 34.8],
  [30.8, 35.2],
  [31.2, 35.2],
  [31.2, 34.8],
  [30.8, 34.8],
];
const joined: [number, number][] = [
  ...sea.slice(0, 4),
  [30, 34.8],
  ...island,
  [30, 34.8],
  [30, 34],
];
const water = new Water([joined], [sea, island]);

describe("sea legs", () => {
  it("finds the land a straight line crosses", () => {
    const runs = landRuns(water, [
      [30.5, 35],
      [31.5, 35],
    ]);
    expect(runs).toHaveLength(1);
    // 0.4° of longitude at 35°N.
    expect(runs[0]?.km).toBeGreaterThan(35);
    expect(runs[0]?.km).toBeLessThan(38);
  });

  it("fails a voyage across an island and passes it round the island", () => {
    expect(seaLegCrossing(water, [30.5, 35], [31.5, 35])).toMatch(/^crosses 3\d\.\d km of land/);
    expect(
      seaLegCrossing(
        water,
        [30.5, 35],
        [31.5, 35],
        [
          [30.6, 35.4],
          [31.4, 35.4],
        ],
      ),
    ).toBeNull();
  });

  it("lets a town inland reach its harbour, but not a way that leaves over the land", () => {
    // The ends on the island's shore and a little inside it: the landfall.
    expect(seaLegCrossing(water, [30.82, 35], [30.4, 35])).toBeNull();
    // From the island's middle, 20 km from its shore: the 20 km to the sea are let pass…
    expect(seaLegCrossing(water, [31, 35], [30.4, 35])).toBeNull();
    // …but not the island crossed the whole way first (40 km of land from a shore town).
    expect(seaLegCrossing(water, [31.19, 35], [30.4, 35])).toMatch(/^crosses/);
  });

  it("names the tour and the stop", () => {
    const points: Record<string, [number, number]> = { a: [30.5, 35], b: [31.5, 35] };
    const tours = [{ id: "t", stops: [{ place: "a" }, { place: "b", by: "sea" }, { place: "a" }] }];
    expect(seaLegErrors(tours, (id) => points[id], water)).toEqual([
      expect.stringMatching(/^tours\/t\.yaml: stop 2 \(b\) by sea crosses/),
    ]);
  });
});
