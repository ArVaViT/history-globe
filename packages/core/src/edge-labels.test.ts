// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { bboxOf, covers } from "./edge-labels.ts";

const square = (w: number, s: number, e: number, n: number) => [
  [w, s],
  [e, s],
  [e, n],
  [w, n],
  [w, s],
];

const withHole: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)],
};

describe("bboxOf", () => {
  it("spans a shape's outer rings", () => {
    expect(bboxOf(withHole)).toEqual([0, 0, 10, 10]);
    expect(
      bboxOf({
        type: "MultiPolygon",
        coordinates: [[square(0, 0, 1, 1)], [square(5, -2, 7, 3)]],
      }),
    ).toEqual([0, -2, 7, 3]);
  });
});

describe("covers", () => {
  it("covers a point inside the shape, not one in its hole or outside", () => {
    expect(covers(withHole, 2, 2)).toBe(true);
    expect(covers(withHole, 5, 5)).toBe(false);
    expect(covers(withHole, 11, 5)).toBe(false);
  });

  it("covers a point in any part of a multipolygon", () => {
    const parts: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [[square(0, 0, 1, 1)], [square(5, 5, 6, 6)]],
    };
    expect(covers(parts, 5.5, 5.5)).toBe(true);
    expect(covers(parts, 3, 3)).toBe(false);
  });

  it("covers nothing for a line", () => {
    expect(
      covers(
        {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        0.5,
        0.5,
      ),
    ).toBe(false);
  });
});
