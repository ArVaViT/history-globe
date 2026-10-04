/**
 * The expressions the map style is built from (style.ts): fonts, colours, the year and the
 * language as the style reads them, and the filters and orders of the places' layers.
 */
import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";
import { KIND_ICON } from "./icons.ts";
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

export const T = {
  ocean: "#1f4257",
  oceanShallow: "#2b5872",
  land: "#ece2c8",
  coast: "#6d5b40",
  ink: "#2b2418",
  inkSoft: "#5c4f3c",
  halo: "#f6efe1",
  water: "#1f5d86",
  accent: "#9a3b1f",
  gold: "#b88a2e",
  mask: "#8f969b",
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
 * Towns and landmarks on the Russian map are labelled only with a verified Russian name:
 * without one they keep their dot, which can still be clicked. Regions and waters have no
 * dot, their label is all there is, so they keep the English name as a fallback.
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

export const polityColor: ExpressionSpecification = [
  "match",
  ["get", "c"],
  ...POLITY_COLORS.flatMap((color, i) => [i, color]),
  POLITY_COLORS[0],
] as unknown as ExpressionSpecification;

/** The outer ring of the focus mask, in degrees: what lies beyond is greyed out. */
export const FOCUS = { cx: 28, cy: 32, rx: 40.5, ry: 19.5 } as const;

/** Whether a point is inside the focus mask's outer ring (scripts/build-content.ts). */
export function inFocus(lon: number, lat: number): boolean {
  return ((lon - FOCUS.cx) / FOCUS.rx) ** 2 + ((lat - FOCUS.cy) / FOCUS.ry) ** 2 <= 1;
}

/** Soft "coming soon" mask: two rings around the Levant, stronger outside. */
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 128,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

export function focusMask(): FeatureCollection {
  const world: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  // The world of the Bible and Acts: from Spain (Tarshish, Rom 15:24) to Persia, from the
  // Black Sea to the Red Sea and Arabia. Widened on 2.10.2026.
  const inner = ellipse(28, 32, 36, 17);
  const outer = ellipse(FOCUS.cx, FOCUS.cy, FOCUS.rx, FOCUS.ry);
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

export const LANDMARK_INK = "#5b4630";

/** Kinds drawn with an icon (icons.ts), and which one. */
export const hasIcon: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  Object.keys(KIND_ICON),
  true,
  false,
];
export const ICON_OF_KIND: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  ...Object.entries(KIND_ICON).flat(),
  "",
] as unknown as ExpressionSpecification;

/** First year of the New Testament narrative (6 BC, astronomical -5). */
export const NT_FROM = -5;

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
    [">=", YEAR, ["number", ["coalesce", ["get", "gap_from"], 100000]]],
    ["<", YEAR, ["number", ["coalesce", ["get", "gap_until"], 100000]]],
  ],
  // No longer standing.
  [">=", YEAR, ["number", ["coalesce", ["get", "life_until"], 100000]]],
  // Not yet standing: its founding year, or, without one, the New Testament rule.
  [
    "case",
    ["has", "life_from"],
    ["<", YEAR, ["number", ["coalesce", ["get", "life_from"], -100000]]],
    ["has", "life_own"],
    false,
    ["all", ["==", ["get", "ot"], 0], ["<", YEAR, NT_FROM]],
  ],
];

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
 * them by. Up close they still say the town is not there yet (place-label-past).
 */
// A tour's stop or the picked place keeps its name, whenever it stood (it is the one asked for).
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
  ["-", 0, ["get", "verses"]],
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

/**
 * Places named only in the New Testament fade before its events: Caesarea or
 * Capernaum must not read as towns of the Exodus. Seas and rivers do not fade;
 * the selected place never does.
 */
export const fadeBeforeNT = (faded: number): ExpressionSpecification => [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  1,
  // During a tour the places off its route fade, so the stops stand out of a crowd.
  OFF_TOUR,
  0.22,
  OUT_OF_TIME,
  faded,
  1,
];

export const kindIn = (kinds: readonly string[]): ExpressionSpecification => [
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
 * A small place is drawn once a search flies to it, whatever its rank; the places of a
 * tour or a chapter from zoom 3, so a chapter framed whole (Acts 16, from Derbe to
 * Philippi) shows its places even on a phone. Their labels still give way to each other.
 */
export const visibleAtZoom: ExpressionSpecification = [
  "any",
  [">=", ["zoom"], minZoomByRank],
  ["all", IN_TOUR, [">=", ["zoom"], 3]],
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

/**
 * The ancient world around the Bible (content/ancient-sites.json): cities, capitals and
 * sanctuaries the Bible does not name, while they stood, quieter than its own places and
 * giving way to them. The greatest from zoom 4, regional ones from 6, the rest from 8.
 */
export const ANCIENT_NOW: ExpressionSpecification = [
  "all",
  ["<=", ["get", "from"], YEAR],
  [">=", ["get", "to"], YEAR],
  [">=", ["zoom"], ["match", ["get", "rank"], 0, 4, 1, 6, 8]],
];
// Battles: a deep red, apart from the route's accent and the places' browns.
export const BATTLE_INK = "#8e2a22";
// A cool grey against the warm browns of the Bible's places, faded ones included: the
// ancient world reads as another layer, not as a place out of its time.
export const ANCIENT_INK = "#5d6570";
