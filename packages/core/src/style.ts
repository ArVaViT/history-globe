import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

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

/** Localised name with fallback to the English one. */
export const NAME: ExpressionSpecification = [
  "case",
  ["==", LOCALE, "ru"],
  ["coalesce", ["get", "name_ru"], ["get", "name"]],
  ["get", "name"],
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
  const inner = ellipse(35, 31.5, 17, 11.5);
  const outer = ellipse(35, 31.5, 20, 13.5);
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

const isSettlement: ExpressionSpecification = ["==", ["get", "kind"], "settlement"];
const isWater: ExpressionSpecification = ["==", ["get", "kind"], "water"];
const isArea: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  ["region", "people group", "island", "mountain range"],
  true,
  false,
];

/** A place appears only from the zoom its importance deserves. */
const minZoomByRank: ExpressionSpecification = [
  "match",
  ["get", "rank"],
  0,
  3.2,
  1,
  5.2,
  2,
  6.8,
  8.2,
];

const visibleAtZoom: ExpressionSpecification = [">=", ["zoom"], minZoomByRank];

export function buildStyle(o: StyleOptions): StyleSpecification {
  const layers: LayerSpecification[] = [
    { id: "ocean", type: "background", paint: { "background-color": T.ocean } },
    { id: "land", type: "fill", source: "land", paint: { "fill-color": T.land } },
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
      source: "land",
      paint: {
        "line-color": T.coast,
        "line-opacity": 0.55,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 10, 1.2],
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
          [">", ["get", "sites"], 1],
          "#a6805c",
          T.accent,
        ],
        "circle-stroke-color": T.halo,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.6],
      },
    },
    {
      id: "place-label-area",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isArea, visibleAtZoom],
      layout: {
        // Biblical regions are not states: italic and sentence case, so they never read
        // as the polity labels (upper case) of the chosen year.
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 14, 1, 12.5, 11.5],
        "text-letter-spacing": 0.04,
        "text-max-width": 8,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": "#7a5a33", "text-halo-color": T.halo, "text-halo-width": 1.4 },
    },
    {
      id: "place-label-water",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isWater, visibleAtZoom],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 14, 1, 12.5, 11.5],
        "text-letter-spacing": 0.06,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": "#d7e7f2", "text-halo-color": "#1d4a66", "text-halo-width": 1.2 },
    },
    {
      id: "place-label",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isSettlement, visibleAtZoom],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT],
        "text-size": ["match", ["get", "rank"], 0, 15, 1, 13.5, 2, 12.5, 11.5],
        "text-variable-anchor": ["top", "bottom", "right", "left"],
        "text-radial-offset": 0.8,
        "text-justify": "auto",
        "symbol-sort-key": ["get", "rank"],
        "text-padding": 3,
      },
      paint: {
        "text-color": ["case", ["boolean", ["feature-state", "selected"], false], T.accent, T.ink],
        "text-halo-color": T.halo,
        "text-halo-width": 1.6,
      },
    },
    {
      id: "polity-label",
      type: "symbol",
      source: "polity-labels",
      filter: ERA_FILTER,
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
        "text-padding": 12,
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
  ];

  return {
    version: 8,
    projection: { type: "globe" },
    state: {
      year: { default: o.initialYear },
      locale: { default: o.initialLocale },
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
      land: { type: "geojson", data: `${o.dataUrl}/land.geojson`, attribution: "Natural Earth" },
      water: { type: "geojson", data: `${o.dataUrl}/water.geojson` },
      polities: {
        type: "geojson",
        data: `${o.dataUrl}/polities.geojson`,
        attribution: "Cliopatria / Seshat (CC BY 4.0)",
      },
      "polity-labels": { type: "geojson", data: `${o.dataUrl}/polity-labels.geojson` },
      places: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        attribution: "OpenBible.info (CC BY 4.0)",
      },
      mask: { type: "geojson", data: focusMask() },
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
