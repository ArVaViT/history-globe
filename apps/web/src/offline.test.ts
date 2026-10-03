import { describe, expect, it } from "vitest";
import { reliefTiles } from "./offline";

describe("the relief saved for use offline", () => {
  const tiles = reliefTiles("t/{z}/{x}/{y}");

  it("covers the whole world at the smallest zoom and the Holy Land closest", () => {
    expect(tiles).toContain("t/0/0/0");
    // Jerusalem (35.2° E, 31.8° N) at zoom 9.
    expect(tiles).toContain("t/9/306/207");
    expect(tiles.some((t) => t.startsWith("t/10/"))).toBe(false);
  });

  it("is about 220 tiles, each once", () => {
    expect(new Set(tiles).size).toBe(tiles.length);
    expect(tiles.length).toBeGreaterThan(200);
    expect(tiles.length).toBeLessThan(250);
  });
});
