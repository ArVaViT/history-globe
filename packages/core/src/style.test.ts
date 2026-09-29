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

describe("river labels", () => {
  const layer = style.layers.find((l) => l.id === "river-label");
  function labelled(locale: string, props: Record<string, string>): boolean {
    if (!layer || !("filter" in layer)) throw new Error("no river-label filter");
    const f = featureFilter(layer.filter, "filter", { locale });
    return f.filter({ zoom: 6 }, { type: 2, properties: props, geometry: [] } as never);
  }

  it("labels a biblical river with a verified Russian name in Russian", () => {
    expect(labelled("ru", { place: "ae686c9", name: "Jordan", name_ru: "Иордан" })).toBe(true);
  });

  it("does not show a Latin name on the Russian map", () => {
    expect(labelled("ru", { place: "a012705", name: "Nile" })).toBe(false);
    expect(labelled("en", { place: "a012705", name: "Nile" })).toBe(true);
  });

  it("never labels rivers that are not biblical places", () => {
    expect(labelled("en", { name: "Danube" })).toBe(false);
  });
});

describe("site labels", () => {
  const layer = style.layers.find((l) => l.id === "site-label");
  function labelled(props: Record<string, unknown>): boolean {
    if (!layer || !("filter" in layer)) throw new Error("no site-label filter");
    const f = featureFilter(layer.filter, "filter", { selected: "p" });
    return f.filter({ zoom: 8 }, {
      type: 1,
      properties: { place: "p", label: "X", ...props },
      geometry: [],
    } as never);
  }

  it("labels rated candidates above 0 % and unrated ones", () => {
    expect(labelled({ share: 38 })).toBe(true);
    expect(labelled({ share: 0 })).toBe(false);
    expect(labelled({})).toBe(true);
  });
});

describe("every place kind is drawn", () => {
  const placeLayers = style.layers.filter(
    (l) => "source" in l && l.source === "places" && "filter" in l && l.filter,
  );
  function drawnBy(props: Record<string, unknown>): string[] {
    return placeLayers
      .filter((l) =>
        featureFilter("filter" in l ? l.filter : undefined, "filter", {}).filter({ zoom: 10 }, {
          type: 1,
          properties: { rank: 0, ...props },
          geometry: [],
        } as never),
      )
      .map((l) => l.id);
  }

  it.each([
    "settlement",
    "campsite",
    "region",
    "people group",
    "body of water",
    "river",
    "mountain",
    "valley",
    "gate",
    "a kind nobody has seen yet",
  ])("%s", (kind) => {
    expect(drawnBy({ kind })).not.toEqual([]);
  });

  it("leaves a river drawn as a line to its line label", () => {
    expect(drawnBy({ kind: "river", line: true })).toEqual([]);
  });
});
