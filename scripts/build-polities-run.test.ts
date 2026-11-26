// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPolities, drawnFromCut, moveSeams, seamOverlaps } from "./build-polities.ts";
import type { Ring } from "./geo.ts";

const box = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const state = (name: string, y0: number, y1: number, r: Ring) => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [r] },
  properties: { name, y0, y1, rel: false, c: 0 },
});
const label = (name: string, y0: number, y1: number, at: [number, number]) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: at },
  properties: { name, y0, y1, rel: false, c: 0, tier: 0, lead: 1, size: 1 },
});
type Out = { features: { properties: { name: string; y0: number; y1: number } }[] };

/** Runs the whole build on a few states and the corrections given. */
function run(
  clips: unknown[],
  more: Record<string, unknown> = {},
): { shapes: Out; labels: Out; errors: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "polities-"));
  const fc = (features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });
  writeFileSync(
    join(dir, "polities.geojson"),
    fc([
      state("Israel", -1000, -900, box(0, 0, 4, 4)),
      state("Israel", -900, -800, box(0, 0, 2, 4)),
      state("Raiders", 10, 20, box(10, 0, 11, 1)),
      state("Empire", 0, 30, box(20, 0, 24, 4)),
      state("Heirs", 40, 50, box(30, 0, 31, 1)),
    ]),
  );
  writeFileSync(
    join(dir, "polity-labels.geojson"),
    fc([
      label("Israel", -1000, -900, [1, 1]),
      label("Israel", -900, -800, [1, 1]),
      label("Raiders", 10, 20, [10.5, 0.5]),
      label("Empire", 0, 30, [21, 1]),
      label("Heirs", 40, 50, [30.5, 0.5]),
    ]),
  );
  writeFileSync(join(dir, "water.geojson"), fc([]));
  const files: Record<string, unknown> = {
    "content/polity-overrides.yaml": {
      overrides: [],
      seams: [
        {
          polity: "Israel",
          data_year: "901 BC",
          first_year: "931 BC",
          reason: "r",
          sources: ["s"],
        },
      ],
      clips,
      ...more,
    },
    "content/polity-anchors.yaml": { anchors: [] },
    "content/polity-names.yaml": {
      polities: { Israel: "Израиль", Raiders: "Р", Empire: "Е", Heirs: "Н" },
    },
  };
  const errors: string[] = [];
  const writes: [string, string][] = [];
  buildPolities({
    out: dir,
    from: dir,
    load: (path) =>
      files[path] ?? (path.includes("wave") ? { _source: "test", sites: [] } : { sites: [] }),
    places: { features: [] },
    errors,
    writes,
  });
  const read = (name: string) =>
    JSON.parse(writes.find(([p]) => p.endsWith(name))?.[1] ?? '{"features":[]}') as Out;
  return {
    shapes: read("polities-all.geojson"),
    labels: read("polity-labels-all.geojson"),
    errors,
  };
}
const years = (o: Out, name: string) =>
  o.features
    .filter((f) => f.properties.name === name)
    .map((f) => [f.properties.y0, f.properties.y1])
    .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
const raid = {
  polity: "Raiders",
  without: [
    [9, -1],
    [12, -1],
    [12, 2],
    [9, 2],
  ],
  first_year: "AD 10",
  last_year: "AD 19",
  leaves_blank: true,
  reason: "a raid",
  sources: ["s"],
};
const cut = (flag: boolean) => ({
  polity: "Empire",
  without: [
    [22, -1],
    [25, -1],
    [25, 5],
    [22, 5],
  ],
  first_year: "AD 10",
  last_year: "AD 19",
  to: "Heirs",
  ...(flag ? { drawn_from_cut: true } : {}),
  reason: "taken",
  sources: ["s"],
});

describe("moveSeams", () => {
  const f = (y0: number, y1: number) => ({ properties: { name: "A", y0, y1 } });
  it("moves the change of shape to the year given", () => {
    const fs = [f(-1000, -900), f(-900, -800)];
    const errors: string[] = [];
    moveSeams(fs, [{ polity: "A", data_year: -900, first_year: -930 }], errors);
    expect(fs.map((x) => [x.properties.y0, x.properties.y1])).toEqual([
      [-1000, -930],
      [-930, -800],
    ]);
    expect(errors).toEqual([]);
  });
  it("refuses a seam where no shape begins, or one that passes a whole shape", () => {
    const errors: string[] = [];
    moveSeams([f(-1000, -900)], [{ polity: "A", data_year: -950, first_year: -960 }], errors);
    moveSeams(
      [f(-1000, -900), f(-900, -800)],
      [{ polity: "A", data_year: -900, first_year: -1000 }],
      errors,
    );
    expect(errors.join("\n")).toMatch(/no shape begins in -950[\s\S]*moves past a whole shape/);
  });
});

describe("seamOverlaps", () => {
  const shape = (name: string, y0: number, y1: number, r: Ring) => ({
    geometry: { type: "Polygon", coordinates: [r] },
    properties: { name, y0, y1 },
  });
  // A grows east over B's land in year 10, when B gives that land up: A's seam moved to 8.
  const a = [shape("A", 0, 8, box(0, 0, 2, 2)), shape("A", 8, 20, box(0, 0, 4, 2))];
  const seam = [{ polity: "A", data_year: 10, first_year: 8 }];
  it("refuses a seam that draws a state over a neighbour that changes in the same year", () => {
    const b = [shape("B", 0, 10, box(2, 0, 6, 2)), shape("B", 10, 20, box(4, 0, 6, 2))];
    expect(seamOverlaps([...a, ...b], seam)).toEqual([
      expect.stringMatching(/seam "A" draws it over B \(4\.00 square degrees more than in 10\)/),
    ]);
  });
  it("passes one whose neighbours keep their shapes", () => {
    const b = [shape("B", 0, 20, box(4, 0, 6, 2))];
    expect(seamOverlaps([...a, ...b], seam)).toEqual([]);
  });
});

describe("drawnFromCut", () => {
  it("draws the land as a shape of its own, with a label inside it", () => {
    const made = drawnFromCut({ properties: { name: "B", y0: 0, y1: 5, c: 3 } }, 10, 20, [
      box(0, 0, 2, 2),
    ]);
    expect(made?.shape.properties).toMatchObject({ name: "B", y0: 10, y1: 20, src: "override" });
    expect(made?.label.geometry).toEqual({ type: "Point", coordinates: [1, 1] });
    expect(drawnFromCut({ properties: { name: "B" } }, 10, 20, [])).toBeUndefined();
  });
});

describe("buildPolities", () => {
  it("moves seams, drops a shape cut away whole with its label, and draws land from a cut", () => {
    const { shapes, labels, errors } = run([raid, cut(true)]);
    expect(errors).toEqual([]);
    expect(years(shapes, "Israel")).toEqual([
      [-1000, -930],
      [-930, -800],
    ]);
    expect(years(shapes, "Raiders")).toEqual([]);
    expect(years(labels, "Raiders")).toEqual([]);
    expect(years(shapes, "Heirs")).toEqual([
      [10, 20],
      [40, 50],
    ]);
    expect(years(labels, "Heirs")).toEqual([
      [10, 20],
      [40, 50],
    ]);
  });
  it("refuses land given to a state absent in those years without drawn_from_cut", () => {
    expect(run([cut(false)]).errors.join()).toMatch(/clip "Empire" to "Heirs": not on the map/);
  });
  it("annexes the last shape drawn, not one a correction left with no years", () => {
    // Israel ends in 951 BC: its shape of 931-801 BC is left with no years, after the
    // shape of 1000-951 BC. Annexed from AD 1, the land is that last drawn shape's.
    const { shapes, errors } = run([], {
      overrides: [{ polity: "Israel", last_year: "951 BC", reason: "r", sources: ["s"] }],
      annexed: [
        {
          polity: "Israel",
          by: "Empire",
          first_year: "AD 1",
          last_year: "AD 9",
          reason: "r",
          sources: ["s"],
        },
      ],
    });
    expect(errors).toEqual([]);
    const annexed = shapes.features.find(
      (f) => f.properties.name === "Empire" && f.properties.y0 === 1,
    ) as { geometry: { coordinates: Ring[][] } } | undefined;
    const xs = (annexed?.geometry.coordinates ?? []).flat(2).map(([x]) => x);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 4]);
  });
});
