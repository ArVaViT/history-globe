import { expression, featureFilter, validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { buildStyle, ERA_FILTER, layersInGroup, NT_FROM, SITES_OF_SELECTED } from "./style.ts";

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
  // The whole style as built: a move or a refactor of its expressions changes nothing here.
  // An intended change updates it with `vitest -u` and shows in review as a diff.
  it("is built as before", () => {
    expect(style).toMatchSnapshot();
  });

  it("is a valid MapLibre style", () => {
    expect(validateStyleMin(style)).toEqual([]);
  });

  it("toggles layers by group", () => {
    expect(layersInGroup(style, "borders")).toEqual([
      "polity-fill",
      "polity-line",
      "polity-label-edge",
      "polity-label",
      "polity-label-pin",
    ]);
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
    const f = featureFilter(layer.filter, "filter", { locale, year: 30 });
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
    const f = featureFilter(layer.filter, "filter", { selected: "p", year: 30 });
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
        featureFilter("filter" in l ? l.filter : undefined, "filter", { year: 30 }).filter(
          { zoom: 10 },
          {
            type: 1,
            properties: { rank: 0, ...props },
            geometry: [],
          } as never,
        ),
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

describe("places named only in the New Testament", () => {
  const index = style.layers.findIndex((l) => l.id === "place-label");
  const layer = style.layers[index];
  const opacity =
    layer && "paint" in layer ? (layer.paint as Record<string, unknown>)["text-opacity"] : null;
  function at(year: number, ot: number, selected = false): number {
    const rootKey = `layers[${String(index)}].paint.text-opacity`;
    const compiled = expression.createExpression(opacity, rootKey, null, { year });
    if (compiled.result !== "success") throw new Error("text-opacity does not compile");
    return compiled.value.evaluate(
      { zoom: 8 },
      { type: 1, properties: { ot }, geometry: [] } as never,
      { selected },
    ) as number;
  }

  it("fade before the New Testament, and only they", () => {
    expect(at(-1200, 0)).toBeLessThan(1);
    expect(at(-1200, 5)).toBe(1);
    expect(at(NT_FROM, 0)).toBe(1);
  });

  it("never fade when selected", () => {
    expect(at(-1200, 0, true)).toBe(1);
  });
});

describe("place labels on the Russian map", () => {
  function labelled(locale: string, props: Record<string, unknown>): boolean {
    return style.layers
      .filter((l) => l.id.startsWith("place-label") && "filter" in l)
      .some((l) =>
        featureFilter("filter" in l ? l.filter : undefined, "filter", {
          year: 30,
          locale,
          selected: "",
        }).filter({ zoom: 10 }, {
          type: 1,
          properties: { id: "a000001", rank: 0, kind: "region", ...props },
          geometry: [],
        } as never),
      );
  }

  it("need a Russian name for a town, any name in English", () => {
    expect(labelled("ru", { kind: "settlement", name: "Gob" })).toBe(false);
    expect(labelled("ru", { kind: "settlement", name: "Gob", name_ru: "Гоб" })).toBe(true);
    expect(labelled("en", { kind: "settlement", name: "Gob" })).toBe(true);
  });

  it("print a name once where two records share a point", () => {
    expect(labelled("en", { kind: "settlement", name: "Bethel", dup: true })).toBe(false);
    expect(
      labelled("ru", { kind: "settlement", name: "Babel", name_ru: "Вавилон", dup_ru: true }),
    ).toBe(false);
    expect(
      labelled("en", { kind: "settlement", name: "Babel", name_ru: "Вавилон", dup_ru: true }),
    ).toBe(true);
  });

  it("label a selected mountain once, in its own layer placed before the towns", () => {
    const mountain = { id: "a3e21c6", rank: 1, kind: "mountain", name: "Mount Carmel" };
    const labelling = (selected: string) =>
      style.layers
        .filter((l) => l.id.startsWith("place-label") && "filter" in l)
        .filter((l) =>
          featureFilter("filter" in l ? l.filter : undefined, "filter", {
            year: 30,
            locale: "en",
            selected,
          }).filter({ zoom: 10 }, { type: 1, properties: mountain, geometry: [] } as never),
        )
        .map((l) => l.id);
    expect(labelling("a3e21c6")).toEqual(["place-label-selected"]);
    expect(labelling("")).toEqual(["place-label-landmark"]);
    // Higher in the stack is placed first.
    expect(style.layers.at(-1)?.id).toBe("place-label-selected");
  });

  it("label a selected region or sea in the same layer, a town in its own and a river line in none of them", () => {
    const layersFor = (props: Record<string, unknown>) =>
      style.layers
        .filter((l) => l.id.startsWith("place-label") && "filter" in l)
        .filter((l) =>
          featureFilter("filter" in l ? l.filter : undefined, "filter", {
            year: 30,
            locale: "en",
            selected: "a0",
          }).filter({ zoom: 10 }, {
            type: 1,
            properties: { id: "a0", rank: 0, ...props },
            geometry: [],
          } as never),
        )
        .map((l) => l.id);
    expect(layersFor({ kind: "region", name: "Egypt" })).toEqual(["place-label-selected"]);
    expect(layersFor({ kind: "body of water", name: "Great Sea" })).toEqual([
      "place-label-selected",
    ]);
    expect(layersFor({ kind: "settlement", name: "Samaria" })).toEqual(["place-label"]);
    expect(layersFor({ kind: "river", name: "Jordan", line: true })).toEqual([]);
  });

  it("keep the English name for a region, which has no dot to fall back on", () => {
    expect(labelled("ru", { kind: "region", name: "Negeb" })).toBe(true);
    expect(labelled("ru", { kind: "body of water", name: "Great Sea" })).toBe(true);
  });
});

describe("places outside their known years", () => {
  const index = style.layers.findIndex((l) => l.id === "place-label");
  const layer = style.layers[index];
  const opacity =
    layer && "paint" in layer ? (layer.paint as Record<string, unknown>)["text-opacity"] : null;
  function at(year: number, props: Record<string, unknown>): number {
    const rootKey = `layers[${String(index)}].paint.text-opacity`;
    const compiled = expression.createExpression(opacity, rootKey, null, { year });
    if (compiled.result !== "success") throw new Error("text-opacity does not compile");
    return compiled.value.evaluate(
      { zoom: 8 },
      { type: 1, properties: props, geometry: [] } as never,
      { selected: false },
    ) as number;
  }

  it("fade after destruction and before founding, whatever the testament", () => {
    expect(at(-700, { ot: 27, life_until: -610 })).toBe(1);
    expect(at(-600, { ot: 27, life_until: -610 })).toBeLessThan(1);
    expect(at(-10, { ot: 0, life_from: -21 })).toBe(1);
    // In ruins between two lives: Jerusalem, last year in ruins 539 BC -> gap_until -537.
    const jerusalem = { ot: 800, gap_from: -585, gap_until: -537, life_until: 71 };
    expect(at(-560, jerusalem)).toBeLessThan(1);
    expect(at(-500, jerusalem)).toBe(1);
    expect(at(80, jerusalem)).toBeLessThan(1);
    // A gap alone does not fade a New Testament place before 6 BC (Corinth).
    // Corinth: a curated record with a gap only; it stood before, so no NT rule.
    expect(at(-300, { ot: 0, gap_from: -145, gap_until: -43, life_own: true })).toBe(1);
    // A New Testament gate that only inherits its city's ruin keeps the NT rule.
    expect(at(-300, { ot: 0, gap_from: -585, gap_until: -537, life_until: 71 })).toBeLessThan(1);
  });
});

describe("a small place (rank 3)", () => {
  function drawn(layer: string, selected: string, zoom: number, kind: string): boolean {
    const l = style.layers.find((x) => x.id === layer);
    if (!l || !("filter" in l)) return false;
    return featureFilter(l.filter, "filter", { locale: "en", selected, year: 30 }).filter(
      { zoom },
      {
        type: 1,
        properties: { id: "a0", rank: 3, kind, name: "Dothan" },
        geometry: [],
      } as never,
    );
  }

  it("is drawn from zoom 5 when selected, as a tour flies to zoom 7.6", () => {
    expect(drawn("place-label", "a0", 5, "settlement")).toBe(true);
    expect(drawn("place-label", "a0", 7, "settlement")).toBe(true);
    expect(drawn("place-label-selected", "a0", 7, "well")).toBe(true);
  });

  it("is named from zoom 10 otherwise, and stays hidden at zoom 4 even when selected", () => {
    expect(drawn("place-label", "", 9, "settlement")).toBe(false);
    expect(drawn("place-label", "", 10, "settlement")).toBe(true);
    expect(drawn("place-label", "a0", 4, "settlement")).toBe(false);
  });
});

describe("during a tour", () => {
  function labelled(tourPlaces: string[], id: string, selected = ""): boolean {
    const l = style.layers.find((x) => x.id === "place-label");
    if (!l || !("filter" in l)) return false;
    return featureFilter(l.filter, "filter", {
      locale: "en",
      selected,
      tourPlaces,
      year: 30,
    }).filter({ zoom: 8 }, {
      type: 1,
      properties: { id, rank: 2, kind: "settlement", name: "Town" },
      geometry: [],
    } as never);
  }

  it("labels only the tour's stops", () => {
    expect(labelled(["a1", "a2"], "a1")).toBe(true);
    expect(labelled(["a1", "a2"], "a9")).toBe(false);
  });

  it("labels everything when no tour runs", () => {
    expect(labelled([], "a9")).toBe(true);
  });
});

describe("a town not standing in the year", () => {
  const ids = style.layers.map((l) => l.id);
  it("is named in a layer under the ancient world's sites, the standing towns above them", () => {
    expect(ids.indexOf("place-label-past")).toBeLessThan(ids.indexOf("ancient-label"));
    expect(ids.indexOf("ancient-label")).toBeLessThan(ids.indexOf("place-label"));
  });
  it("goes to the faded layer before its founding, to the main one after", () => {
    const named = (layer: string, year: number, zoom = 7) => {
      const l = style.layers.find((x) => x.id === layer);
      if (!l || !("filter" in l)) return false;
      return featureFilter(l.filter, "filter", { locale: "en", selected: "", year }).filter(
        { zoom },
        {
          type: 1,
          properties: { id: "a1", rank: 0, kind: "settlement", name: "Antioch", life_from: -299 },
          geometry: [],
        } as never,
      );
    };
    expect(named("place-label-past", -1300)).toBe(true);
    expect(named("place-label", -1300)).toBe(false);
    expect(named("place-label", 50)).toBe(true);
    expect(named("place-label-past", 50)).toBe(false);
    // Far out, a name out of its time is left off: it crowded the overview, pale and unhaloed.
    expect(named("place-label-past", -1300, 5)).toBe(false);
    expect(named("place-label", 50, 5)).toBe(true);
  });
});
