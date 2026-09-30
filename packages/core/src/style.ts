import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import { KIND_ICON } from "./icons.ts";
import { AREA_KINDS, SETTLEMENT_KINDS, WATER_KINDS } from "./kinds.ts";

/**
 * The map style, written as code (ADR 0004). Year and locale are global-state properties,
 * so the slider and the language switch never rebuild tiles or the style.
 */

export interface StyleOptions {
  /** Base URL of the data release, e.g. "/data". */
  readonly dataUrl: string;
  /** Terrain tiles in Terrarium encoding. */
  readonly terrainTiles: string;
  readonly terrainAttribution: string;
  /** font-faces for map labels: family name → WOFF2 files with unicode ranges. */
  readonly fonts: Readonly<Record<string, readonly { url: string; unicodeRange: string }[]>>;
  readonly initialYear: number;
  readonly initialLocale: string;
}

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

const YEAR: ExpressionSpecification = ["global-state", "year"];
const LOCALE: ExpressionSpecification = ["global-state", "locale"];

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

/** A candidate site's label, in Russian where the content build could write one. */
const SITE_LABEL: ExpressionSpecification = [
  "case",
  ["==", LOCALE, "ru"],
  ["coalesce", ["get", "label_ru"], ["get", "label"]],
  ["get", "label"],
];

/** OpenBible's share for a candidate site; 0 where the candidates are unrated. */
const SHARE: ExpressionSpecification = ["to-number", ["get", "share"], 0];

/** Localised name with fallback to the English one. */
export const NAME: ExpressionSpecification = [
  "case",
  ["==", LOCALE, "ru"],
  ["coalesce", ["get", "name_ru"], ["get", "name"]],
  ["get", "name"],
];

/**
 * Towns and landmarks on the Russian map are labelled only with a verified Russian name:
 * without one they keep their dot, which can still be clicked. Regions and waters have no
 * dot, their label is all there is, so they keep the English name as a fallback.
 */
export const HAS_LOCAL_NAME: ExpressionSpecification = [
  "any",
  ["!=", LOCALE, "ru"],
  ["has", "name_ru"],
];

const polityColor: ExpressionSpecification = [
  "match",
  ["get", "c"],
  ...POLITY_COLORS.flatMap((color, i) => [i, color]),
  POLITY_COLORS[0],
] as unknown as ExpressionSpecification;

/** Soft "coming soon" mask: two rings around the Levant, stronger outside. */
function ellipse(cx: number, cy: number, rx: number, ry: number, n = 128): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

function focusMask(): FeatureCollection {
  const world: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  // The world of the Bible and Acts: from Mesopotamia to Rome (Paul's voyage, Acts 27–28).
  const inner = ellipse(29, 34, 24, 12.5);
  const outer = ellipse(29, 34, 27.5, 14.5);
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

const LANDMARK_INK = "#5b4630";

/** Kinds drawn with an icon (icons.ts), and which one. */
const hasIcon: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  Object.keys(KIND_ICON),
  true,
  false,
];
const ICON_OF_KIND: ExpressionSpecification = [
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
const OUT_OF_TIME: ExpressionSpecification = [
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

const IS_SELECTED: ExpressionSpecification = ["==", ["get", "id"], ["global-state", "selected"]];

/** A second record of the same name on the same point (pipeline `dup`): dot, no label. */
const NOT_DUP: ExpressionSpecification = [
  "any",
  // The selected record keeps its label even when it is a duplicate.
  IS_SELECTED,
  ["!", ["any", ["has", "dup"], ["all", ["==", LOCALE, "ru"], ["has", "dup_ru"]]]],
];

/**
 * Label placement order: the selected place, then most mentioned first, and places
 * faded before the New Testament last, so a faded Capernaum never takes the room of a
 * town of its time.
 */
const PLACE_ORDER: ExpressionSpecification = [
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
const fadeBeforeNT = (faded: number): ExpressionSpecification => [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  1,
  OUT_OF_TIME,
  faded,
  1,
];

const kindIn = (kinds: readonly string[]): ExpressionSpecification => [
  "match",
  ["get", "kind"],
  [...kinds],
  true,
  false,
];
const isSettlement = kindIn(SETTLEMENT_KINDS);
const isArea = kindIn(AREA_KINDS);
// Rivers drawn as lines carry their label along the course (river-label), not at a point.
const isWater: ExpressionSpecification = ["all", kindIn(WATER_KINDS), ["!", ["has", "line"]]];
/** Everything else: mountains, valleys, springs, gates, … (see kinds.ts). */
const isLandmark: ExpressionSpecification = [
  "!",
  kindIn([...SETTLEMENT_KINDS, ...AREA_KINDS, ...WATER_KINDS]),
];

/**
 * A place appears only from the zoom its importance deserves. Whole numbers on purpose:
 * a filter sees the zoom of its tile, an integer, so 5.2 would behave as 6 and a
 * mid-rank place (Corinth, Ephesus) would stay hidden at zoom 5.9.
 */
const minZoomByRank: ExpressionSpecification = ["match", ["get", "rank"], 0, 3, 1, 5, 2, 6, 8];

const visibleAtZoom: ExpressionSpecification = [">=", ["zoom"], minZoomByRank];

export function buildStyle(o: StyleOptions): StyleSpecification {
  const layers: LayerSpecification[] = [
    // The globe is land; the water layer paints seas and lakes over it. A separate land
    // polygon (a fifth of the data download) would only be covered again.
    { id: "land", type: "background", paint: { "background-color": T.land } },
    {
      id: "relief",
      type: "color-relief",
      source: "dem",
      metadata: { group: "relief" },
      paint: {
        "color-relief-color": [
          "interpolate",
          ["linear"],
          ["elevation"],
          -450,
          "#d4c79f",
          0,
          "#ece2c6",
          200,
          "#e7dab8",
          600,
          "#dccaa4",
          1200,
          "#cfb893",
          2000,
          "#c1aa89",
          3000,
          "#d8d1c4",
          4500,
          "#f2efe9",
        ],
      },
    },
    {
      id: "hillshade",
      type: "hillshade",
      source: "dem",
      metadata: { group: "relief" },
      paint: {
        "hillshade-method": "multidirectional",
        "hillshade-illumination-direction": [270, 315, 0, 45],
        "hillshade-illumination-altitude": [35, 35, 35, 35],
        "hillshade-highlight-color": ["#fff8ea", "#fff4e0", "#fff8ea", "#fffaf0"],
        "hillshade-shadow-color": ["#6b5236", "#5b4630", "#6b5236", "#7a6045"],
        "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 3, 0.35, 8, 0.55, 12, 0.7],
      },
    },
    {
      id: "water",
      type: "fill",
      source: "water",
      paint: {
        "fill-color": ["interpolate", ["linear"], ["zoom"], 3, T.ocean, 9, T.oceanShallow],
      },
    },
    {
      id: "coast",
      type: "line",
      // Sea and lake shores around the map's region (not the water polygon's outline,
      // which is cut along the antimeridian).
      source: "coast",
      paint: {
        "line-color": T.coast,
        "line-opacity": 0.55,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 10, 1.2],
      },
    },
    {
      id: "river",
      type: "line",
      source: "rivers",
      // Big rivers from the globe view, small ones only closer in.
      filter: [">=", ["zoom"], ["-", ["get", "rank"], 2]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": T.oceanShallow,
        "line-opacity": 0.85,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 7, 1.4, 11, 2.6],
      },
    },
    {
      id: "polity-fill",
      type: "fill",
      source: "polities",
      filter: ["all", ERA_FILTER, ["!", ["get", "rel"]]],
      metadata: { group: "borders" },
      paint: {
        "fill-color": polityColor,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.24, 8, 0.12],
      },
    },
    {
      id: "polity-line",
      type: "line",
      source: "polities",
      filter: ["all", ERA_FILTER, ["!", ["get", "rel"]]],
      metadata: { group: "borders" },
      paint: {
        "line-color": polityColor,
        "line-opacity": 0.85,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 8, 2],
        "line-dasharray": [4, 2],
      },
    },
    {
      id: "mask",
      type: "fill",
      source: "mask",
      paint: { "fill-color": T.mask, "fill-opacity": ["get", "o"] },
    },
    {
      id: "route-halo",
      type: "line",
      source: "route",
      metadata: { group: "routes" },
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": T.halo, "line-width": 7, "line-opacity": 0.85 },
    },
    {
      id: "route",
      type: "line",
      source: "route",
      metadata: { group: "routes" },
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": T.accent, "line-width": 3.2, "line-dasharray": [2, 1.4] },
    },
    {
      // Mountains, springs, gates…: a small dark mark under the towns.
      id: "landmark-dot",
      type: "circle",
      source: "places",
      metadata: { group: "places" },
      // Landmarks without an icon of their own keep a small dot.
      filter: ["all", isLandmark, ["!", hasIcon], visibleAtZoom],
      paint: {
        "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 6, 2.6],
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          T.gold,
          LANDMARK_INK,
        ],
        "circle-stroke-color": T.halo,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.6, 1.2],
        "circle-opacity": fadeBeforeNT(0.3),
        "circle-stroke-opacity": fadeBeforeNT(0.3),
      },
    },
    {
      // A mountain, a spring, a gate: an icon that says what the place is.
      id: "landmark-icon",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", ["any", isLandmark, isWater], hasIcon, visibleAtZoom],
      layout: {
        "icon-image": ICON_OF_KIND,
        "icon-size": ["match", ["get", "rank"], 0, 1.35, 1, 1.2, 1],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          T.gold,
          ["match", ["get", "kind"], ["river", "wadi", "canal"], T.water, LANDMARK_INK],
        ],
        "icon-halo-color": T.halo,
        "icon-halo-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.6],
        "icon-opacity": fadeBeforeNT(0.3),
      },
    },
    {
      // Major towns (most mentioned) get a ring around their dot, as on a printed atlas.
      id: "place-ring",
      type: "circle",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isSettlement, ["==", ["get", "rank"], 0], visibleAtZoom],
      paint: {
        "circle-radius": 8.5,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": T.accent,
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": fadeBeforeNT(0.3),
      },
    },
    {
      id: "place-dot",
      type: "circle",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isSettlement, visibleAtZoom],
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          8,
          ["match", ["get", "rank"], 0, 5, 1, 4, 2, 3.2, 2.6],
        ],
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          T.gold,
          ["boolean", ["get", "disputed"], false],
          "#a6805c",
          T.accent,
        ],
        "circle-stroke-color": T.halo,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.6],
        "circle-opacity": fadeBeforeNT(0.3),
        "circle-stroke-opacity": fadeBeforeNT(0.3),
      },
    },
    // Tour stops lie under the labels: an island named at its centre (Melita) stays readable.
    {
      id: "route-stop",
      type: "circle",
      source: "route",
      metadata: { group: "routes" },
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["case", ["get", "current"], 8, 5],
        "circle-color": ["case", ["get", "current"], T.gold, T.accent],
        "circle-stroke-color": T.halo,
        "circle-stroke-width": 2.5,
      },
    },
    {
      id: "place-label-area",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isArea, visibleAtZoom, NOT_DUP, ["!", IS_SELECTED]],
      layout: {
        // Biblical regions are not states: italic and sentence case, so they never read
        // as the polity labels (upper case) of the chosen year.
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 14, 1, 12.5, 11.5],
        "text-letter-spacing": 0.04,
        "text-max-width": 8,
        "symbol-sort-key": PLACE_ORDER,
      },
      paint: {
        "text-color": "#7a5a33",
        "text-halo-color": T.halo,
        "text-halo-width": 1.4,
        "text-opacity": fadeBeforeNT(0.4),
      },
    },
    {
      id: "place-label-water",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isWater, visibleAtZoom, NOT_DUP, ["!", IS_SELECTED]],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 14, 1, 12.5, 11.5],
        "text-letter-spacing": 0.06,
        "symbol-sort-key": PLACE_ORDER,
      },
      // Seas are labelled on the dark sea; rivers, wadis and canals on land.
      paint: {
        "text-color": ["match", ["get", "kind"], "body of water", "#d7e7f2", T.water],
        "text-halo-color": ["match", ["get", "kind"], "body of water", "#1d4a66", T.halo],
        "text-halo-width": 1.3,
      },
    },
    {
      id: "place-label-landmark",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isLandmark, visibleAtZoom, HAS_LOCAL_NAME, NOT_DUP, ["!", IS_SELECTED]],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 13.5, 1, 12.5, 11.5],
        "text-variable-anchor": ["top", "bottom", "right", "left"],
        "text-radial-offset": 1,
        "text-justify": "auto",
        "symbol-sort-key": PLACE_ORDER,
        "text-padding": 3,
      },
      paint: {
        "text-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          T.accent,
          LANDMARK_INK,
        ],
        "text-halo-color": T.halo,
        "text-halo-width": 1.5,
        "text-opacity": fadeBeforeNT(0.45),
      },
    },
    {
      id: "polity-label",
      type: "symbol",
      source: "polity-labels",
      // The fine grid of an empire's label points only when zoomed in (build_data.py). A
      // filter sees the tile's whole zoom, so this is from zoom 6.
      filter: [
        "all",
        ERA_FILTER,
        ["any", ["<", ["coalesce", ["get", "tier"], 0], 2], [">=", ["zoom"], 6]],
      ],
      metadata: { group: "borders" },
      minzoom: 2.5,
      layout: {
        "text-field": ["upcase", NAME],
        "text-font": [MAP_FONT],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          ["*", ["get", "size"], 2.6],
          7,
          ["*", ["get", "size"], 4],
        ],
        "text-letter-spacing": 0.28,
        "text-max-width": 7,
        "symbol-sort-key": ["-", 0, ["get", "size"]],
        // Some padding keeps an empire's anchors from crowding one view; 48 px made the
        // box so large that a river label nearby left the Neo-Babylonian Empire unnamed.
        "text-padding": 16,
        // Room to move off a river or a town instead of disappearing.
        "text-variable-anchor": ["center", "top", "bottom"],
        "text-radial-offset": 1.2,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#4a3b28",
        "text-opacity": 0.82,
        "text-halo-color": T.halo,
        "text-halo-width": 1.2,
      },
    },
    {
      id: "place-label",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isSettlement, visibleAtZoom, HAS_LOCAL_NAME, NOT_DUP],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT],
        "text-size": ["match", ["get", "rank"], 0, 15, 1, 13.5, 2, 12.5, 11.5],
        "text-variable-anchor": ["top", "bottom", "right", "left"],
        "text-radial-offset": 0.8,
        "text-justify": "auto",
        "symbol-sort-key": PLACE_ORDER,
        "text-padding": 3,
      },
      paint: {
        "text-color": ["case", ["boolean", ["feature-state", "selected"], false], T.accent, T.ink],
        "text-halo-color": T.halo,
        "text-halo-width": 1.6,
        "text-opacity": fadeBeforeNT(0.45),
      },
    },
    {
      id: "river-label",
      type: "symbol",
      // Placed before towns and states compete for space (higher in the stack = placed
      // first); a line label takes little room. A smoothed copy of the course: MapLibre drops line labels on sharp bends.
      source: "river-labels",
      // Only rivers that are biblical places carry a label: no modern local names.
      // In Russian, only rivers with a verified Synodal name (no Latin fallback on the map).
      filter: ["all", ["has", "place"], ["any", ["!=", LOCALE, "ru"], ["has", "name_ru"]]],
      minzoom: 4.5,
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11.5, 10, 14],
        "text-letter-spacing": 0.12,
        "symbol-spacing": 280,
        "text-max-angle": 55,
      },
      paint: { "text-color": T.water, "text-halo-color": T.halo, "text-halo-width": 1.4 },
    },
    // Candidate locations of the selected place, when its location is disputed.
    {
      id: "site-alt",
      type: "circle",
      source: "sites",
      filter: SITES_OF_SELECTED,
      paint: {
        "circle-radius": ["interpolate", ["linear"], SHARE, 0, 6, 100, 13],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": T.accent,
        "circle-stroke-width": 2,
        "circle-stroke-opacity": ["interpolate", ["linear"], SHARE, 0, 0.45, 50, 1],
      },
    },
    {
      id: "site-label",
      type: "symbol",
      source: "sites",
      // Candidates rated 0 % stay unlabelled; unrated ones (no `share`) keep their name.
      filter: ["all", SITES_OF_SELECTED, ["any", ["!", ["has", "share"]], [">", SHARE, 0]]],
      layout: {
        "text-field": [
          "case",
          ["has", "share"],
          ["concat", SITE_LABEL, " · ", ["to-string", SHARE], "%"],
          SITE_LABEL,
        ],
        "text-font": [MAP_FONT_ITALIC],
        "text-size": 12,
        "text-variable-anchor": ["left", "right", "top", "bottom"],
        "text-radial-offset": 1.3,
        "text-allow-overlap": true,
      },
      paint: { "text-color": T.accent, "text-halo-color": T.halo, "text-halo-width": 1.6 },
    },
    {
      // The selected region, sea, mountain or spring: their layers are placed after towns,
      // so its own layer, placed first, keeps a town beside it from taking its label's room.
      // A river drawn as a line keeps its line label.
      id: "place-label-selected",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: [
        "all",
        IS_SELECTED,
        ["!", isSettlement],
        ["!", ["has", "line"]],
        // Its own threshold: a small place is labelled once a tour or a search flies to it.
        [">=", ["zoom"], 5],
        ["any", ["!", isLandmark], HAS_LOCAL_NAME],
      ],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": 13.5,
        "text-variable-anchor": ["top", "bottom", "right", "left"],
        "text-radial-offset": 1,
        "text-justify": "auto",
      },
      paint: { "text-color": T.accent, "text-halo-color": T.halo, "text-halo-width": 1.5 },
    },
  ];

  return {
    version: 8,
    projection: { type: "globe" },
    state: {
      year: { default: o.initialYear },
      locale: { default: o.initialLocale },
      selected: { default: "" },
    },
    "font-faces": Object.fromEntries(
      Object.entries(o.fonts).map(([family, files]) => [
        family,
        files.map((f) => ({
          url: f.url,
          // CSS-style "U+0000-00FF, U+0131" → ["U+0000-00FF", "U+0131"], as MapLibre expects.
          "unicode-range": f.unicodeRange.split(",").map((r) => r.trim()),
        })),
      ]),
    ),
    sky: {
      "sky-color": "#0c1520",
      "horizon-color": "#35536b",
      "fog-color": "#cdd8df",
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.45, 10, 0],
    },
    sources: {
      dem: {
        type: "raster-dem",
        tiles: [o.terrainTiles],
        encoding: "terrarium",
        tileSize: 512,
        maxzoom: 12,
        attribution: o.terrainAttribution,
      },
      // A second source of the same tiles for 3D terrain: MapLibre renders better when
      // shading layers and terrain do not share one source.
      "dem-terrain": {
        type: "raster-dem",
        tiles: [o.terrainTiles],
        encoding: "terrarium",
        tileSize: 512,
        maxzoom: 12,
      },
      water: { type: "geojson", data: `${o.dataUrl}/water.geojson`, attribution: "Natural Earth" },
      coast: { type: "geojson", data: `${o.dataUrl}/coast.geojson` },
      polities: {
        type: "geojson",
        data: `${o.dataUrl}/polities.geojson`,
        attribution: "Cliopatria / Seshat (CC BY 4.0)",
      },
      "polity-labels": { type: "geojson", data: `${o.dataUrl}/polity-labels.geojson` },
      rivers: {
        type: "geojson",
        data: `${o.dataUrl}/rivers.geojson`,
        attribution: "Natural Earth",
      },
      "river-labels": { type: "geojson", data: `${o.dataUrl}/river-labels.geojson` },
      places: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        attribution: "OpenBible.info (CC BY 4.0)",
      },
      mask: { type: "geojson", data: focusMask() },
      sites: { type: "geojson", data: `${o.dataUrl}/sites.geojson` },
      route: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers,
  };
}

/** Layer ids per toggle group, read from layer metadata. */
export function layersInGroup(style: StyleSpecification, group: string): string[] {
  return style.layers
    .filter((l) => (l.metadata as { group?: string } | undefined)?.group === group)
    .map((l) => l.id);
}
