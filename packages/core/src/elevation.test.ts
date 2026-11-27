// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { decodeTerrarium, tilePixel } from "./elevation.ts";

describe("tilePixel", () => {
  it("finds the tile and the pixel a point falls in", () => {
    expect(tilePixel(0, 0, 0)).toEqual({ x: 0, y: 0, px: 256, py: 256 });
    expect(tilePixel(0, 0, 1)).toEqual({ x: 1, y: 1, px: 0, py: 0 });
    expect(tilePixel(-180, 0, 2)).toEqual({ x: 0, y: 2, px: 0, py: 0 });
  });

  it("puts a point north of the equator above it", () => {
    const north = tilePixel(35.2, 31.8, 11);
    const equator = tilePixel(35.2, 0, 11);
    expect(north.x).toBe(equator.x);
    expect(north.y).toBeLessThan(equator.y);
  });
});

describe("decodeTerrarium", () => {
  it("reads a height in metres, rounded", () => {
    expect(decodeTerrarium(131, 232, 128)).toBe(1001);
  });

  it("keeps the Dead Sea shore as land", () => {
    expect(decodeTerrarium(126, 82, 0)).toBe(-430);
  });

  it("gives null for the open sea and the sea floor", () => {
    expect(decodeTerrarium(128, 0, 0)).toBeNull();
    expect(decodeTerrarium(126, 62, 0)).toBeNull();
  });
});
