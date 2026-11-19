/**
 * The expressions the map style is built from (style.ts): fonts, colours, the year and the
 * language as the style reads them, and the filters and orders of the places' layers.
 */
import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";
import { DOT_RADIUS, KIND_ICON } from "./icons.ts";
import { AREA_KINDS, SETTLEMENT_KINDS, WATER_KINDS } from "./kinds.ts";

export const MAP_FONT = "Map Serif";
export const MAP_FONT_ITALIC = "Map Serif Italic";

/** Muted atlas palette for polities; index comes from the data build. */
export const POLITY_COLORS = [
  "#b5652f",
  "#6f8a3a",
  "#3b7c88",
  "#8d4f7b",
  "#a8862f",
  "#5a6fa8",
  "#9c3d3d",
  "#4f8a5b",
  "#b07a52",
  "#6d5a9c",
] as const;

/** The map's colours. */
export const T = {
  ocean: "#1f4257",
  oceanShallow: "#2b5872",
  land: "#ece2c8",
  coast: "#6d5b40",
  ink: "#2b2418",
  inkSoft: "#5c4f3c",
  halo: "#f6efe1",
  water: "#1f5d86",
  /** A sea's name, written on the dark sea. */
  seaLabel: "#d7e7f2",
  seaHalo: "#1d4a66",
  accent: "#9a3b1f",
  gold: "#b88a2e",
  mask: "#8f969b",
  landmark: "#5b4630",
  region: "#7a5a33",
  polityLabel: "#4a3b28",
  /** Warm brown, so a road is not read as a river or a border. */
  road: "#7a5228",
  /** A deep red, apart from the route's accent and the places' browns. */
  battle: "#8e2a22",
} as const;

export const YEAR: ExpressionSpecification = ["global-state", "year"];
export const LOCALE: ExpressionSpecification = ["global-state", "locale"];

/** Visible when y0 ≤ year < y1 (half-open, ADR 0003). */
export const ERA_FILTER: ExpressionSpecification = [
  "all",
  ["<=", ["get", "y0"], YEAR],
  [">", ["get", "y1"], YEAR],
];

/** Sites (candidate locations) belonging to the currently selected place. */
export const SITES_OF_SELECTED: ExpressionSpecification = [
  "==",
  ["get", "place"],
  ["global-state", "selected"],
];

/**
 * A feature's text in the map's language: its `<key>_<language>` where the data has one
 * (name_ru, label_ru, v_ru), else the English `<key>`. A new language needs its fields in
 * the data, nothing here.
 */
export const inLocale = (key: string): ExpressionSpecification => [
  "coalesce",
  ["get", ["concat", key, "_", LOCALE]],
  ["get", key],
];
/** Whether the data has the feature's `<key>` in the map's language (English always). */
export const hasInLocale = (key: string): ExpressionSpecification => [
  "any",
  ["==", LOCALE, "en"],
  ["!=", ["get", ["concat", key, "_", LOCALE]], null],
];

/** A candidate site's label, in the map's language where the content build could write one. */
export const SITE_LABEL: ExpressionSpecification = inLocale("label");

/** OpenBible's share for a candidate site; 0 where the candidates are unrated. */
export const SHARE: ExpressionSpecification = ["to-number", ["get", "share"], 0];

/** Where a state's name may stand around its point, in ems. */
export const POLITY_LABEL_OFFSETS: ["center", [number, number], ...(string | [number, number])[]] =
  [
    "center",
    [0, 0],
    "top",
    [0, 2],
    "bottom",
    [0, -2],
    "left",
    [2, 0],
    "right",
    [-2, 0],
    "top-left",
    [1.4, 1.4],
    "top-right",
    [-1.4, 1.4],
    "bottom-left",
    [1.4, -1.4],
    "bottom-right",
    [-1.4, -1.4],
  ];

/** Localised name with fallback to the English one. */
export const NAME: ExpressionSpecification = inLocale("name");

/**
 * A town or landmark is named only where the data has its name in the map's language: without
 * one it keeps its dot, which can still be clicked. Regions and waters have no dot, so they
 * fall back to English.
 */
export const HAS_LOCAL_NAME: ExpressionSpecification = hasInLocale("name");

/** The location is uncertain: disputed, or tentative: scored under 600 by OpenBible (sites.ts). */
export const UNCERTAIN_SITE: ExpressionSpecification = [
  "any",
  ["boolean", ["get", "disputed"], false],
  ["<", ["to-number", ["coalesce", ["get", "confidence"], 1000]], 600],
];

/** The two browns (0, 8) are near the desert's own colour: their fill is laid on thicker. */
export const WARM: ExpressionSpecification = ["match", ["get", "c"], [0, 8], 1.6, 1];

/**
 * A `match` on a feature's property from a table of its values. The style spec types `match`
 * as a fixed tuple, which a table spread into it cannot satisfy: the one cast lives here.
 */
function matchOf<O extends string | number>(
  property: string,
  table: readonly (readonly [string | number, O])[],
  otherwise: O,
): ExpressionSpecification {
  return [
    "match",
    ["get", property],
    ...table.flat(),
    otherwise,
  ] as unknown as ExpressionSpecification;
}

export const polityColor: ExpressionSpecification = matchOf(
  "c",
  POLITY_COLORS.map((color, i) => [i, color] as const),
  POLITY_COLORS[0],
);

/**
 * The world of the Bible and Acts, from Spain (Tarshish, Rom 15:24) to Persia, from the Black
 * Sea to the Red Sea and Arabia: the focus mask's rings, in degrees. Beyond the inner ring the
 * map is greyed lightly, beyond the outer one more.
 */
const FOCUS_INNER = { cx: 28, cy: 32, rx: 36, ry: 17 } as const;
export const FOCUS = { cx: 28, cy: 32, rx: 40.5, ry: 19.5 } as const;

/** Whether a point is inside the focus mask's outer ring (scripts/build-content.ts). */
export function inFocus(lon: number, lat: number): boolean {
  return ((lon - FOCUS.cx) / FOCUS.rx) ** 2 + ((lat - FOCUS.cy) / FOCUS.ry) ** 2 <= 1;
}

/** A closed ring of n + 1 points round an ellipse. */
function ellipse(
  { cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number },
  n = 128,
): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i): [number, number] => {
    const a = (i / n) * 2 * Math.PI;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

export function focusMask(): FeatureCollection {
  const world: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const inner = ellipse(FOCUS_INNER);
  const outer = ellipse(FOCUS);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { o: 0.3 },
        geometry: { type: "Polygon", coordinates: [outer, inner.slice().reverse()] },
      },
      {
        type: "Feature",
        properties: { o: 0.62 },
        geometry: { type: "Polygon", coordinates: [world, outer.slice().reverse()] },
      },
    ],
  };
}

/** Kinds drawn with an icon (icons.ts), and which one. */
export const hasIcon: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  Object.keys(KIND_ICON),
  true,
  false,
];
export const ICON_OF_KIND: ExpressionSpecification = matchOf("kind", Object.entries(KIND_ICON), "");

/** First year of the New Testament narrative (6 BC, astronomical -5). */
export const NT_FROM = -5;

/** A year past every other: a missing end year (`life_until`, `gap_until`) never comes. */
export const NO_YEAR = 100000;

/**
 * The place did not stand in the chosen year. (coalesce, not to-number: to-number turns
 * a missing value into 0, which would read as "founded in 1 BC".) Its known years (content/place-life.yaml,
 * `life_from`/`life_until`, half-open) win; without them, a place named only in the New
 * Testament is out of its time before 6 BC.
 */
export const OUT_OF_TIME: ExpressionSpecification = [
  "any",
  // In ruins between two lives (gap_from/gap_until).
  [
    "all",
    ["has", "gap_from"],
    [">=", YEAR, ["number", ["coalesce", ["get", "gap_from"], NO_YEAR]]],
    ["<", YEAR, ["number", ["coalesce", ["get", "gap_until"], NO_YEAR]]],
  ],
  // No longer standing.
  [">=", YEAR, ["number", ["coalesce", ["get", "life_until"], NO_YEAR]]],
  // Not yet standing: its founding year, or, without one, the New Testament rule.
  [
    "case",
    ["has", "life_from"],
    ["<", YEAR, ["number", ["coalesce", ["get", "life_from"], -NO_YEAR]]],
    ["has", "life_own"],
    false,
    ["all", ["==", ["get", "ot"], 0], ["<", YEAR, NT_FROM]],
  ],
];

/**
 * The selected place. Paint reads feature-state, which is cheap (ADR 0004); a filter cannot,
 * so filters read the global state `selected` (IS_SELECTED).
 */
export const SELECTED_STATE: ExpressionSpecification = [
  "boolean",
  ["feature-state", "selected"],
  false,
];
export const HOVER_STATE: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];

export const IS_SELECTED: ExpressionSpecification = [
  "==",
  ["get", "id"],
  ["global-state", "selected"],
];

/** The stops of the running tour; empty when none runs (or the state is not set). */
export const TOUR_PLACES: ExpressionSpecification = [
  "coalesce",
  ["global-state", "tourPlaces"],
  ["literal", []],
];
/** A tour is running and this place is not one of its stops: it steps back. */
export const OFF_TOUR: ExpressionSpecification = [
  "all",
  [">", ["length", TOUR_PLACES], 0],
  ["!", ["in", ["get", "id"], TOUR_PLACES]],
];
export const IN_TOUR: ExpressionSpecification = ["in", ["get", "id"], TOUR_PLACES];
/** Names kept off the map for a while: a quiz's answers until they are given. */
export const NOT_HIDDEN: ExpressionSpecification = [
  "!",
  ["in", ["get", "id"], ["global-state", "hiddenNames"]],
];

/**
 * A place's name out of its time (a town not yet built, or in ruins) only from a region's
 * view in: far out the pale names of Iconium and Lystra crowded 1800 BC, with no halo to read
 * them by. Up close they still say the town is not there yet (place-label-past). A tour's stop
 * or the picked place keeps its name whenever it stood: it is the one asked for.
 */
export const LABEL_IN_TIME: ExpressionSpecification = [
  "any",
  ["!", OUT_OF_TIME],
  IN_TOUR,
  IS_SELECTED,
  [">=", ["zoom"], 7],
];
export const NOT_TOURING: ExpressionSpecification = ["==", ["length", TOUR_PLACES], 0];

/** A second record of the same name on the same point (pipeline `dup`): dot, no label. */
export const NOT_DUP: ExpressionSpecification = [
  "any",
  // The selected record keeps its label even when it is a duplicate.
  IS_SELECTED,
  ["!", ["any", ["has", "dup"], ["!=", ["get", ["concat", "dup_", LOCALE]], null]]],
];

/**
 * Label placement order: the selected place, then most mentioned first, and places
 * faded before the New Testament last, so a faded Capernaum never takes the room of a
 * town of its time.
 */
export const PLACE_ORDER: ExpressionSpecification = [
  "+",
  // An ancient site, or a town its fame raised, weighs its rank in verses (`weight`).
  ["-", 0, ["coalesce", ["get", "weight"], ["get", "verses"]]],
  [
    "case",
    // The selected place is placed first, whatever its year.
    IS_SELECTED,
    -1000000,
    OUT_OF_TIME,
    100000,
    0,
  ],
];

/** A place off a running tour's route, faded so the stops stand out of a crowd. */
const OFF_TOUR_OPACITY = 0.22;

/**
 * A place's opacity: 1 when selected; OFF_TOUR_OPACITY off a running tour; `outOfTime`
 * outside its years (Caesarea or Capernaum must not read as towns of the Exodus); else 1.
 */
export const placeOpacity = (outOfTime: number): ExpressionSpecification => [
  "case",
  SELECTED_STATE,
  1,
  OFF_TOUR,
  OFF_TOUR_OPACITY,
  OUT_OF_TIME,
  outOfTime,
  1,
];

const kindIn = (kinds: readonly string[]): ExpressionSpecification => [
  "match",
  ["get", "kind"],
  [...kinds],
  true,
  false,
];
export const isSettlement = kindIn(SETTLEMENT_KINDS);
export const isArea = kindIn(AREA_KINDS);
// Rivers drawn as lines carry their label along the course (river-label), not at a point.
export const isWater: ExpressionSpecification = [
  "all",
  kindIn(WATER_KINDS),
  ["!", ["has", "line"]],
];
/** Everything else: mountains, valleys, springs, gates, … (see kinds.ts). */
export const isLandmark: ExpressionSpecification = [
  "!",
  kindIn([...SETTLEMENT_KINDS, ...AREA_KINDS, ...WATER_KINDS]),
];

/**
 * A place appears only from the zoom its importance deserves. Whole numbers on purpose:
 * a filter sees the zoom of its tile, an integer, so 5.2 would behave as 6 and a
 * mid-rank place (Corinth, Ephesus) would stay hidden at zoom 5.9.
 */
export const minZoomByRank: ExpressionSpecification = [
  "match",
  ["get", "rank"],
  0,
  3,
  1,
  5,
  2,
  6,
  9,
];

/**
 * Rank sets the zoom a place appears from; a tour's or a chapter's places show from zoom 2
 * (Acts 27 framed on a phone is below zoom 3), the selected place from zoom 5. Their labels
 * still give way to each other.
 */
export const visibleAtZoom: ExpressionSpecification = [
  "any",
  [">=", ["zoom"], minZoomByRank],
  ["all", IN_TOUR, [">=", ["zoom"], 2]],
  ["all", IS_SELECTED, [">=", ["zoom"], 5]],
];

/**
 * The least-named places get a dot from zoom 9 (minZoomByRank) but a name only from 10,
 * unless picked or in a tour: at 8-9 their names filled the hills around Jerusalem
 * (150 labels), and their dots alone still crowded zoom 8.
 */
export const labelledAtZoom: ExpressionSpecification = [
  "any",
  ["<", ["get", "rank"], 3],
  [">=", ["zoom"], 10],
  IS_SELECTED,
  IN_TOUR,
];

/**
 * The reader's own picks: the selected place and the places of a tour, a chapter or a
 * person. Their marks are drawn whatever else is near; every other mark gives way.
 */
export const PICKED: ExpressionSpecification = ["any", IS_SELECTED, IN_TOUR];

/** A tour's numbered stops are drawn (MapLibreRenderer.setRoute, with the routes layer on). */
const STOPS_SHOWN: ExpressionSpecification = ["boolean", ["global-state", "stops"], false];

/** The places the drawn stops stand at (a tour's, or a chapter's way). */
const AT_A_STOP: ExpressionSpecification = [
  "in",
  ["get", "id"],
  ["coalesce", ["global-state", "stopPlaces"], ["literal", []]],
];

/** A mark's opacity: none under a stop's disc, else faded as its place's name is. */
export const markOpacity = (outOfTime: number): ExpressionSpecification => [
  "case",
  ["all", AT_A_STOP, STOPS_SHOWN],
  0,
  placeOpacity(outOfTime),
];

/**
 * A town's mark (icons.ts): the great towns (rank 0) ringed, as on a printed atlas, but
 * not while a chapter, a tour or a person's places are picked out, where Jerusalem, named
 * once in Acts 16, outweighed Philippi, where the chapter happens. An uncertain site is
 * hollow; the selected town a plain dot, in gold.
 */
export const TOWN_MARK: ExpressionSpecification = [
  "case",
  IS_SELECTED,
  "hg-dot",
  ["all", ["==", ["get", "rank"], 0], NOT_TOURING],
  ["case", UNCERTAIN_SITE, "hg-dot-ringed-hollow", "hg-dot-ringed"],
  UNCERTAIN_SITE,
  "hg-dot-hollow",
  "hg-dot",
];

/**
 * A town mark's size, a radius in px over icons.ts DOT_RADIUS: the picked places one size,
 * the lesser towns smaller at a region's view, where three hundred of them would carpet the
 * Levant. A ringed mark is drawn at its own size.
 */
const townSize = (rank2: number): ExpressionSpecification => [
  "case",
  IS_SELECTED,
  8 / DOT_RADIUS,
  IN_TOUR,
  4.5 / DOT_RADIUS,
  [
    "match",
    ["get", "rank"],
    0,
    ["case", NOT_TOURING, 1, 5 / DOT_RADIUS],
    1,
    4 / DOT_RADIUS,
    2,
    rank2 / DOT_RADIUS,
    2.6 / DOT_RADIUS,
  ],
];
export const TOWN_MARK_SIZE: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  townSize(2.3),
  8,
  townSize(3.2),
];

/** Labels keep more room around them at a region's zoom than up close. */
export const LABEL_PADDING: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  8,
  11,
  3,
];

/** Roman roads are drawn from the Via Appia, 312 BC, on. */
export const ROADS_FROM = -311;
/** The zoom each kind of road is drawn from. */
export const ROAD_MINZOOM = { major: 5, minor: 7 } as const;

/** A battle shows this many years either side of its own: one step of the slider. */
export const BATTLE_YEAR_WINDOW = 5;
