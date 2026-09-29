import { featureFilter, validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { buildStyle, ERA_FILTER, layersInGroup, SITES_OF_SELECTED } from "./style.ts";

const style = buildStyle({
  dataUrl: "/data",
  terrainTiles: "https://example.test/{z}/{x}/{y}.webp",
  terrainAttribution: "test",
  fonts: {
    "Map Serif": [{ url: "/fonts/a.woff2", unicodeRange: "U+0000-00FF, U+0131, U+2000-206F" }],
  },
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

describe("sites of the selected place", () => {
  function shown(selected: string, place: string): boolean {
    const f = featureFilter(SITES_OF_SELECTED, "filter", { selected });
    return f.filter({ zoom: 8 }, { type: 1, properties: { place }, geometry: [] } as never);
  }

  it("shows only the candidates of the selected place", () => {
    expect(shown("ae7274b", "ae7274b")).toBe(true);
    expect(shown("ae7274b", "a15257a")).toBe(false);
  });

  it("shows nothing when nothing is selected", () => {
    expect(shown("", "ae7274b")).toBe(false);
  });
});
