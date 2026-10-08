import { describe, expect, it } from "vitest";
import { DOT_RADIUS, ICON_NAMES, KIND_ICON, markBox } from "./icons.ts";
import { AREA_KINDS, SETTLEMENT_KINDS } from "./kinds.ts";
import { buildStyle } from "./style.ts";

const style = buildStyle({
  dataUrl: "/data",
  terrainTiles: "https://example.test/{z}/{x}/{y}.webp",
  terrainAttribution: "test",
  fonts: {},
  initialYear: 30,
  initialLocale: "en",
});

describe("place icons", () => {
  it("draws every icon a kind points to", () => {
    for (const icon of Object.values(KIND_ICON)) expect(ICON_NAMES).toContain(icon);
  });

  it("draws every mark the style names", () => {
    const named = JSON.stringify(style).match(/"hg-[a-z-]+"/g) ?? [];
    for (const icon of new Set(named.map((n) => n.slice(1, -1))))
      expect(ICON_NAMES, icon).toContain(icon);
  });

  it("draws a town's mark on a canvas its own size, so its collision box is the mark", () => {
    // 16 px icon squares round 4 px dots kept towns 10 px apart off the map far out.
    // The dot and 3 px of halo room on each side.
    expect(markBox("hg-dot")).toBe(DOT_RADIUS * 2 + 6);
    expect(markBox("hg-dot-ringed")).toBeLessThanOrEqual(26);
    expect(markBox("hg-mountain")).toBeNull();
  });

  it("leaves towns and areas to their dots and labels", () => {
    for (const kind of [...SETTLEMENT_KINDS, ...AREA_KINDS])
      expect(KIND_ICON[kind]).toBeUndefined();
  });
});
