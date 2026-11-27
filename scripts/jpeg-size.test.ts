// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jpegSize } from "./jpeg-size.ts";

/** A JPEG's first bytes: SOI, an APP0 and a DHT segment, then a baseline frame header of w × h. */
const jpeg = (w: number, h: number, sof = 0xc0) =>
  Uint8Array.from([
    ...[0xff, 0xd8],
    ...[0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46],
    ...[0xff, 0xc4, 0x00, 0x04, 0x00, 0x00],
    ...[0xff, sof, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03],
    ...Array<number>(9).fill(0),
  ]);

describe("jpegSize", () => {
  it("reads the frame header past other segments", () => {
    expect(jpegSize(jpeg(960, 640))).toEqual({ width: 960, height: 640 });
    expect(jpegSize(jpeg(1200, 801, 0xc2))).toEqual({ width: 1200, height: 801 });
  });

  it("gives nothing for a file that is not a JPEG", () => {
    expect(jpegSize(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 4, 0, 0, 0, 0, 0]))).toBeNull();
  });

  it("reads the site's own photos, where they are built", () => {
    const dir = join(import.meta.dirname, "../apps/web/public/data/photos");
    // A checkout without `pnpm data` has no photos: nothing to read.
    if (!existsSync(dir)) return;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".jpg"))
      .slice(0, 20);
    for (const f of files) {
      const size = jpegSize(readFileSync(join(dir, f)));
      expect(size?.width, f).toBeGreaterThan(0);
      expect(size?.height, f).toBeGreaterThan(0);
    }
  });
});
