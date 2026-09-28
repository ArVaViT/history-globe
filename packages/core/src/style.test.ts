import { featureFilter, validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { buildStyle, ERA_FILTER, layersInGroup } from "./style.ts";

const style = buildStyle({
  dataUrl: "/data",
  terrainTiles: "https://example.test/{z}/{x}/{y}.webp",
  terrainAttribution: "test",
  fonts: { "Map Serif": [{ url: "/fonts/a.woff2", unicodeRange: "U+0000-00FF" }] },
  initialYear: 30,
  initialLocale: "ru",
});

function visibleIn(year: number, y0: number, y1: number): boolean {
  const f = featureFilter(ERA_FILTER, "filter", { year });
  return f.filter({ zoom: 5 }, { type: 1, properties: { y0, y1 }, geometry: [] } as never);
}

describe("style", () => {
  it("is a valid MapLibre style", () => {
    expect(validateStyleMin(style)).toEqual([]);
  });

  it("toggles layers by group", () => {
    expect(layersInGroup(style, "borders")).toEqual(["polity-fill", "polity-line", "polity-label"]);
    expect(layersInGroup(style, "places").length).toBeGreaterThan(2);
  });
});

describe("era filter (half-open, ADR 0003)", () => {
  // Herod's kingdom 37–4 BC → [-36, -2)
  it.each([
    [-37, false],
    [-36, true],
    [-3, true],
    [-2, false],
  ])("year %i → visible %s", (year, visible) => {
    expect(visibleIn(year, -36, -2)).toBe(visible);
  });
});
