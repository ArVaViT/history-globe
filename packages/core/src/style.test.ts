import { expression, featureFilter, validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import {
  buildStyle,
  ERA_FILTER,
  layersInGroup,
  NT_FROM,
  SITES_OF_SELECTED,
  TOWN_NAMED,
} from "./style.ts";
import { isSettlement, visibleAtZoom } from "./style-expressions.ts";

/** Where a town's dot was drawn before its mark took part in the collision. */
const VISIBLE_TOWN = ["all", isSettlement, visibleAtZoom];

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

type Layer = (typeof style.layers)[number];
type Props = Record<string, unknown>;
const DEFAULT_STATE = {
  year: 30,
  locale: "en",
  selected: "",
  tourPlaces: [] as string[],
  stops: false,
  bibleOnly: false,
  hiddenNames: [] as string[],
};

/** Whether a layer's filter lets a point feature through, as MapLibre tests it at a tile's zoom. */
function passes(layer: Layer, state: Props, zoom: number, props: Props): boolean {
  if (!("filter" in layer) || !layer.filter) return true;
  return featureFilter(layer.filter, "filter", { ...DEFAULT_STATE, ...state }).filter({ zoom }, {
    type: 1,
    // A great town kept at every zoom unless the test says otherwise (majors.ts `keep`).
    properties: { keep: 0xffff, ...props },
    geometry: [],
  } as never);
}

/** A symbol layer's layout value for a feature ("" where the layer has none). */
function layoutOf(layer: Layer, key: string, state: Props, zoom: number, props: Props): unknown {
  const layout = "layout" in layer ? (layer.layout as Record<string, unknown> | undefined) : {};
  const value = layout?.[key];
  if (value === undefined) return "";
  const compiled = expression.createExpression(value, `layers.${layer.id}.layout.${key}`, null, {
    ...DEFAULT_STATE,
    ...state,
  });
  if (compiled.result !== "success") throw new Error(`${layer.id} ${key} does not compile`);
  const v: unknown = compiled.value.evaluate({ zoom }, {
    type: 1,
    properties: props,
    geometry: [],
  } as never);
  return v;
}

// The great towns and the seas' names are drawn from sources of their own (majors.ts,
// seaLabels), with the places' properties.
const placeLayers = style.layers.filter(
  (l) =>
    l.type === "symbol" && "source" in l && ["places", "majors", "sea-labels"].includes(l.source),
);

/** The place layers that draw the feature's mark (an icon) at the zoom. */
function marked(state: Props, zoom: number, props: Props): string[] {
  return placeLayers
    .filter((l) => passes(l, state, zoom, props))
    .filter((l) => {
      const icon = layoutOf(l, "icon-image", state, zoom, props);
      return typeof icon === "string" ? icon !== "" : String(icon) !== "";
    })
    .map((l) => l.id);
}

/** The place layers that write the feature's name at the zoom. */
function named(state: Props, zoom: number, props: Props): string[] {
  return placeLayers
    .filter((l) => passes(l, state, zoom, props))
    .filter((l) => String(layoutOf(l, "text-field", state, zoom, props)) !== "")
    .map((l) => l.id);
}

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
    // A great town's name is decided by its layer's text, not its filter (place-label-major).
    return named({ year: 30, locale }, 10, {
      id: "a000001",
      rank: 0,
      kind: "region",
      ...props,
    }).some((l) => l.startsWith("place-label"));
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
    expect(layersFor({ kind: "settlement", name: "Samaria" })).toEqual(["place-label-picked"]);
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
    expect(drawn("place-label-picked", "a0", 5, "settlement")).toBe(true);
    expect(drawn("place-label-picked", "a0", 7, "settlement")).toBe(true);
    expect(drawn("place-label-selected", "a0", 7, "well")).toBe(true);
  });

  it("is named from zoom 10 otherwise, and stays hidden at zoom 4 even when selected", () => {
    expect(drawn("place-label", "", 9, "settlement")).toBe(false);
    expect(drawn("place-dot", "", 9, "settlement")).toBe(true);
    expect(drawn("place-label", "", 10, "settlement")).toBe(true);
    expect(drawn("place-dot", "", 10, "settlement")).toBe(false);
    expect(drawn("place-label-picked", "a0", 4, "settlement")).toBe(false);
  });
});

describe("during a tour", () => {
  function labelled(tourPlaces: string[], id: string, selected = ""): boolean {
    return named({ locale: "en", selected, tourPlaces, year: 30 }, 8, {
      id,
      rank: 2,
      kind: "settlement",
      name: "Town",
    }).some((l) => l.startsWith("place-label"));
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
          properties: {
            id: "a1",
            rank: 0,
            kind: "settlement",
            name: "Antioch",
            life_from: -299,
            keep: 0xffff,
          },
          geometry: [],
        } as never,
      );
    };
    expect(named("place-label-past", -1300)).toBe(true);
    expect(named("place-label-major", -1300)).toBe(false);
    // Standing, a great town is drawn with the great towns (majors.ts).
    expect(named("place-label-major", 50)).toBe(true);
    expect(named("place-label", 50)).toBe(false);
    expect(named("place-label-past", 50)).toBe(false);
    // Far out, a name out of its time is left off: it crowded the overview, pale and unhaloed.
    expect(named("place-label-past", -1300, 5)).toBe(false);
    expect(named("place-label-major", 50, 5)).toBe(true);
  });
});

describe("marks and names never pile up (8.10.2026)", () => {
  const ids = style.layers.map((l) => l.id);
  const at = (id: string) => {
    const i = ids.indexOf(id);
    if (i < 0) throw new Error(`no layer ${id}`);
    return i;
  };
  const layerById = (id: string): Layer => {
    const l = style.layers.find((x) => x.id === id);
    if (!l) throw new Error(`no layer ${id}`);
    return l;
  };
  const filterLayer = (filter: unknown) =>
    ({ id: "x", type: "symbol", source: "places", filter }) as Layer;

  it("draws every mark of a place, a battle or an ancient site as a symbol, never as a circle", () => {
    for (const l of style.layers)
      if (l.type === "circle") expect(["places", "ancient", "battles"]).not.toContain(l.source);
  });

  it("lets a mark give way, except the reader's picks and the great towns", () => {
    // The great towns are thinned among themselves in code (majors.ts), not by MapLibre.
    const allowed = new Set(["place-label-picked", "place-label-selected", "place-label-major"]);
    const marks: string[] = [];
    for (const l of style.layers) {
      if (l.type !== "symbol" || !["places", "majors", "ancient", "battles"].includes(l.source))
        continue;
      const layout = (l.layout ?? {}) as Record<string, unknown>;
      // Regions and waters have no mark, their name is all there is.
      if (layout["icon-image"] === undefined) continue;
      marks.push(l.id);
      // Taking part in the collision: placed only where nothing is, and keeping its room.
      expect(layout["icon-ignore-placement"], l.id).not.toBe(true);
      expect(layout["icon-allow-overlap"] === true, l.id).toBe(allowed.has(l.id));
      // A name never keeps its mark off the map.
      if (layout["text-field"] !== undefined) expect(layout["text-optional"], l.id).toBe(true);
    }
    expect(marks.sort()).toEqual([
      "ancient-label",
      "battle-icon",
      "landmark-icon",
      "place-dot",
      "place-dot-past",
      "place-label",
      "place-label-landmark",
      "place-label-major",
      "place-label-past",
      "place-label-picked",
      "place-label-selected",
      "place-label-water",
    ]);
  });

  // Damascus went off the map at zoom 4 in 1000 BC: Tyre's name and the room kept round it,
  // placed first, left no room for its ring (8.10.2026).
  it("places the great towns right after the reader's picks: no name, state, battle or past year takes their room", () => {
    const major = at("place-label-major");
    const before = new Set(["place-label-picked", "place-label-selected"]);
    for (const l of style.layers) {
      if (l.type !== "symbol" || before.has(l.id) || l.id === "place-label-major") continue;
      const layout = (l.layout ?? {}) as Record<string, unknown>;
      // Tour numbers take no room: they are not in the collision at all.
      if (layout["text-ignore-placement"] === true) continue;
      expect(at(l.id), `${l.id} is placed before the great towns`).toBeLessThan(major);
    }
    for (const id of before) expect(at(id)).toBeGreaterThan(major);
    const layer = layerById("place-label-major");
    const layout = (layer.type === "symbol" ? layer.layout : {}) as Record<string, unknown>;
    // Drawn whatever lies near, and keeping their room from all placed after them.
    expect(layout["icon-allow-overlap"]).toBe(true);
    expect(layout["icon-ignore-placement"]).not.toBe(true);
  });

  it("draws a great town standing in the year only from its own source, where majors.ts keeps it", () => {
    const damascus = { id: "a0", kind: "settlement", rank: 0, verses: 58, name: "Damascus" };
    for (let zoom = 3; zoom <= 14; zoom++) {
      expect(marked({ year: -1000 }, zoom, damascus)).toEqual(["place-label-major"]);
      expect(marked({ year: -1000 }, zoom, { ...damascus, keep: 0 })).toEqual(
        zoom >= 15 ? ["place-label-major"] : [],
      );
      // Kept at this zoom only.
      expect(marked({ year: -1000 }, zoom, { ...damascus, keep: 2 ** zoom })).toEqual([
        "place-label-major",
      ]);
      expect(marked({ year: -1000 }, zoom, { ...damascus, keep: 2 ** (zoom + 1) })).toEqual([]);
    }
  });

  it("places the picks first, then the great towns, battles, towns, states, seas and lesser marks", () => {
    // Higher in the stack is placed first.
    expect(at("place-label-selected")).toBeGreaterThan(at("place-label-picked"));
    expect(at("place-label-picked")).toBeGreaterThan(at("site-label"));
    expect(at("place-label-major")).toBeGreaterThan(at("battle-icon"));
    // The year's battles before the ordinary towns: Saul at Gilboa in 1010 BC.
    expect(at("battle-icon")).toBeGreaterThan(at("place-label"));
    expect(at("place-label")).toBeGreaterThan(at("polity-label-pin"));
    expect(at("polity-label-pin")).toBeGreaterThan(at("place-label-sea"));
    expect(at("place-label-sea")).toBeGreaterThan(at("place-dot"));
    expect(at("place-dot")).toBeGreaterThan(at("polity-label"));
    expect(at("place-label-landmark")).toBeGreaterThan(at("ancient-label"));
    expect(at("ancient-label")).toBeGreaterThan(at("place-label-past"));
    expect(at("place-label-past")).toBeGreaterThan(at("place-dot-past"));
    expect(at("place-dot-past")).toBeGreaterThan(at("landmark-icon"));
  });

  it("places the most named town of a layer first, the selected one before all", () => {
    const layer = layerById("place-label");
    const key = (props: Props, state: Props = {}) =>
      layoutOf(layer, "symbol-sort-key", state, 8, props) as number;
    const jerusalem = { id: "a1", verses: 955, rank: 0, kind: "settlement" };
    const bethel = { id: "a2", verses: 69, rank: 0, kind: "settlement" };
    expect(key(jerusalem)).toBeLessThan(key(bethel));
    expect(key(bethel, { selected: "a2" })).toBeLessThan(key(jerusalem, { selected: "a2" }));
  });

  // Each town, landmark or river point in view has exactly one mark: with its name, alone,
  // or picked. Two would cover each other; none would lose a place.
  const towns: Props[] = [
    { rank: 0, verses: 955, name: "Jerusalem" },
    { rank: 1, verses: 40, name: "Gibeon" },
    { rank: 2, verses: 9, name: "Geba", name_ru: "Гева" },
    { rank: 3, verses: 1, name: "Dothan" },
    { rank: 0, verses: 148, name: "Zion", where_tpl: "same" },
    { rank: 1, verses: 20, name: "Bethel", dup: true },
    { rank: 0, verses: 18, name: "Caesarea", ot: 0 },
    { rank: 1, verses: 12, name: "Antioch", life_from: -299 },
  ];
  const states: Props[] = [
    {},
    { locale: "ru" },
    { year: -1000 },
    { selected: "a0" },
    { tourPlaces: ["a0"] },
    { tourPlaces: ["a9"] },
    { hiddenNames: ["a0"] },
  ];
  const where = (state: Props, zoom: number) => `${JSON.stringify(state)} z${String(zoom)}`;

  it.each(towns.map((t) => [String(t["name"]), t] as const))(
    "%s: one mark at any zoom",
    (_, town) => {
      for (const state of states)
        for (let zoom = 0; zoom <= 14; zoom++) {
          const props = { id: "a0", kind: "settlement", ...town };
          const layers = marked(state, zoom, props);
          expect(layers.length, where(state, zoom)).toBeLessThanOrEqual(1);
          // Drawn from the zoom its rank deserves, as its dot was.
          const visible = passes(filterLayer(VISIBLE_TOWN), state, zoom, props);
          expect(layers.length === 1, where(state, zoom)).toBe(visible);
          // Named only by the layer that draws its mark, and wherever it was named before.
          const names = named(state, zoom, props);
          for (const n of names) expect(layers, where(state, zoom)).toContain(n);
          expect(names.length > 0, where(state, zoom)).toBe(
            passes(filterLayer(TOWN_NAMED), state, zoom, props),
          );
        }
    },
  );

  it.each([
    ["a mountain", { kind: "mountain", rank: 1, name: "Mount Carmel" }],
    ["a valley", { kind: "valley", rank: 2, name: "Valley of Elah" }],
    ["a kind without an icon", { kind: "plain", rank: 0, name: "Moreh" }],
    ["a river known by a point", { kind: "wadi", rank: 1, name: "Besor" }],
  ] as const)("%s: one mark at any zoom", (_, place) => {
    for (const state of states)
      for (let zoom = 0; zoom <= 14; zoom++) {
        const layers = marked(state, zoom, { id: "a0", ...place });
        expect(layers.length, where(state, zoom)).toBeLessThanOrEqual(1);
        if (zoom >= 10) expect(layers.length, where(state, zoom)).toBe(1);
      }
  });

  it("gives a region or a sea no mark, only its name", () => {
    const edom = { id: "a0", kind: "region", rank: 0, name: "Edom" };
    expect(marked({ selected: "a0" }, 8, edom)).toEqual([]);
    expect(named({ selected: "a0" }, 8, edom)).toEqual(["place-label-selected"]);
  });

  it("rings the great towns, hollows the uncertain sites, gilds only the selected", () => {
    const layer = layerById("place-label");
    const picked = layerById("place-label-picked");
    const icon = (l: Layer, props: Props, state: Props = {}) =>
      layoutOf(l, "icon-image", state, 8, { id: "a0", kind: "settlement", ...props });
    expect(icon(layer, { rank: 0 })).toBe("hg-dot-ringed");
    expect(icon(layer, { rank: 0, disputed: true })).toBe("hg-dot-ringed-hollow");
    expect(icon(layer, { rank: 1, confidence: 300 })).toBe("hg-dot-hollow");
    expect(icon(layer, { rank: 1 })).toBe("hg-dot");
    // A tour or a chapter in focus: no ring on Jerusalem, named once in Acts 16.
    expect(icon(layer, { rank: 0 }, { tourPlaces: ["a9"] })).toBe("hg-dot");
    expect(icon(picked, { rank: 0 }, { selected: "a0" })).toBe("hg-dot");
  });

  it("hides a tour stop's own mark under its numbered disc, and only then", () => {
    const layer = layerById("place-label-picked");
    if (layer.type !== "symbol") throw new Error("not a symbol layer");
    const opacity = (state: Props) => {
      const compiled = expression.createExpression(
        layer.paint?.["icon-opacity"],
        "icon-opacity",
        null,
        { ...DEFAULT_STATE, ...state },
      );
      if (compiled.result !== "success") throw new Error("icon-opacity does not compile");
      return compiled.value.evaluate(
        { zoom: 8 },
        { type: 1, properties: { id: "a0", ot: 5 }, geometry: [] } as never,
        { selected: false },
      ) as number;
    };
    expect(opacity({ tourPlaces: ["a0"], stops: true })).toBe(0);
    // A chapter or a person in focus has no discs: the picked places keep their marks.
    expect(opacity({ tourPlaces: ["a0"], stops: false })).toBe(1);
  });
});
