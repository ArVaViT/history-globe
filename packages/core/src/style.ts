import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import {
  MAP_FONT,
  MAP_FONT_ITALIC,
  T,
  YEAR,
  LOCALE,
  ERA_FILTER,
  SITES_OF_SELECTED,
  inLocale,
  hasInLocale,
  SITE_LABEL,
  SHARE,
  POLITY_LABEL_OFFSETS,
  NAME,
  HAS_LOCAL_NAME,
  UNCERTAIN_SITE,
  WARM,
  polityColor,
  focusMask,
  LANDMARK_INK,
  hasIcon,
  ICON_OF_KIND,
  OUT_OF_TIME,
  IS_SELECTED,
  OFF_TOUR,
  IN_TOUR,
  NOT_HIDDEN,
  LABEL_IN_TIME,
  NOT_TOURING,
  NOT_DUP,
  PLACE_ORDER,
  fadeBeforeNT,
  isSettlement,
  isArea,
  isWater,
  isLandmark,
  visibleAtZoom,
  labelledAtZoom,
  LABEL_PADDING,
  ANCIENT_NOW,
  BATTLE_INK,
  ANCIENT_INK,
} from "./style-expressions.ts";
export {
  MAP_FONT,
  MAP_FONT_ITALIC,
  POLITY_COLORS,
  T,
  ERA_FILTER,
  SITES_OF_SELECTED,
  NAME,
  HAS_LOCAL_NAME,
  FOCUS,
  inFocus,
  NT_FROM,
} from "./style-expressions.ts";

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
    // States are drawn under the sea: Cliopatria's shapes are coarse offshore (square boxes
    // around islands), and a border at sea means nothing on this map.
    {
      id: "polity-fill",
      type: "fill",
      source: "polities",
      filter: ["all", ERA_FILTER, ["!", ["get", "rel"]]],
      metadata: { group: "borders" },
      paint: {
        "fill-color": polityColor,
        // A vassal (build-content.ts) wears its overlord's colour at half the strength.
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          ["*", WARM, ["case", ["has", "vin"], 0, ["has", "v"], 0.12, 0.24]],
          8,
          ["*", WARM, ["case", ["has", "vin"], 0, ["has", "v"], 0.06, 0.12]],
        ],
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
    // Roman roads (Itiner-e, CC BY 4.0): thin and quiet, from the Via Appia (312 BC) on;
    // main roads from zoom 5, the others from 7. Conjectured stretches are fainter.
    ...(["major", "minor"] as const).map((kind): LayerSpecification => ({
      id: `road-${kind}`,
      type: "line",
      source: `roads-${kind}`,
      metadata: { group: "roads" },
      minzoom: kind === "major" ? 5 : 7,
      filter: [">=", YEAR, -311],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        // Warm brown, so a road is not read as a river or a border.
        "line-color": "#7a5228",
        // Fades in over its first zoom level; zoom must be the outer expression.
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          kind === "major" ? 5 : 7,
          0,
          kind === "major" ? 6 : 8,
          ["match", ["get", "cert"], "certain", 0.85, 0.55],
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          kind === "major" ? 1.4 : 1,
          10,
          kind === "major" ? 2.4 : 1.6,
        ],
        "line-dasharray": [2.5, 1.2],
      },
    })),
    {
      id: "mask",
      type: "fill",
      source: "mask",
      paint: { "fill-color": T.mask, "fill-opacity": ["get", "o"] },
    },
    // "Distance from here": a dashed straight line of its own, not a route (no lights, and
    // it shows whatever the routes switch says).
    {
      id: "measure-halo",
      type: "line",
      source: "measure",
      layout: { "line-cap": "round" },
      paint: { "line-color": T.halo, "line-width": 5, "line-opacity": 0.8 },
    },
    {
      id: "measure",
      type: "line",
      source: "measure",
      layout: { "line-cap": "round" },
      paint: { "line-color": T.accent, "line-width": 2, "line-dasharray": [1.5, 1.5] },
    },
    {
      // The rest of a tour's way, faint: where it goes is seen from the first stop.
      id: "route-ahead",
      type: "line",
      source: "route",
      metadata: { group: "routes" },
      filter: [
        "all",
        ["==", ["geometry-type"], "LineString"],
        ["boolean", ["get", "ahead"], false],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      // Faint, but read on the relief's browns: at 0.4 and 2 px it was lost there.
      paint: {
        "line-color": T.accent,
        "line-width": 2.4,
        "line-opacity": 0.6,
        "line-dasharray": [1.4, 1.2],
      },
    },
    {
      id: "route-halo",
      type: "line",
      source: "route",
      metadata: { group: "routes" },
      filter: [
        "all",
        ["==", ["geometry-type"], "LineString"],
        ["!", ["boolean", ["get", "ahead"], false]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": T.halo, "line-width": 8, "line-opacity": 0.9 },
    },
    {
      id: "route",
      type: "line",
      source: "route",
      metadata: { group: "routes" },
      filter: [
        "all",
        ["==", ["geometry-type"], "LineString"],
        ["!", ["boolean", ["get", "ahead"], false]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      // The way walked: dashed still (straight lines between the stops, not the roads),
      // with short gaps, so it reads as a line on the relief and on a printed sheet.
      paint: { "line-color": T.accent, "line-width": 4, "line-dasharray": [2.6, 1] },
    },
    {
      id: "ancient-dot",
      type: "circle",
      source: "ancient",
      metadata: { group: "ancient" },
      filter: ANCIENT_NOW,
      paint: {
        // A hollow ring, as in the key: no fill to read as a white dot.
        "circle-radius": ["match", ["get", "rank"], 0, 3.8, 1, 3.3, 2.8],
        "circle-color": T.halo,
        "circle-opacity": 0,
        "circle-stroke-color": ANCIENT_INK,
        "circle-stroke-width": 1.5,
        // A tour, a person or a chapter in focus: the ancient world steps back with the
        // places off it.
        "circle-stroke-opacity": ["case", NOT_TOURING, 0.9, 0.35],
      },
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
      // Major towns (most mentioned) get a ring around their dot, as on a printed atlas;
      // not while a chapter, a tour or a person's places are picked out, where Jerusalem,
      // named once in Acts 16, outweighed Philippi, where the chapter happens.
      id: "place-ring",
      type: "circle",
      source: "places",
      metadata: { group: "places" },
      filter: ["all", isSettlement, ["==", ["get", "rank"], 0], visibleAtZoom, NOT_TOURING],
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
        // The places picked out (a chapter's, a person's) are one size: the passage decides
        // what matters, not how often the Bible names the town. The lesser towns are smaller
        // at a region's view, where three hundred of them made a carpet over the Levant.
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            8,
            IN_TOUR,
            4.5,
            ["match", ["get", "rank"], 0, 5, 1, 4, 2, 2.3, 2.6],
          ],
          8,
          [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            8,
            IN_TOUR,
            4.5,
            ["match", ["get", "rank"], 0, 5, 1, 4, 2, 3.2, 2.6],
          ],
        ],
        // Where the place stood is uncertain (disputed, or tentative under 600):
        // a hollow dot, so the map itself says how sure it is, not only the card.
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          T.gold,
          UNCERTAIN_SITE,
          T.halo,
          T.accent,
        ],
        "circle-stroke-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          T.halo,
          UNCERTAIN_SITE,
          T.accent,
          T.halo,
        ],
        "circle-stroke-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          3,
          ["all", UNCERTAIN_SITE, ["!", ["boolean", ["feature-state", "selected"], false]]],
          1.8,
          1.6,
        ],
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
      // Big enough to hold the stop's number; the stops ahead are hollow.
      paint: {
        "circle-radius": ["case", ["get", "current"], 9.5, 7.5],
        "circle-color": [
          "case",
          ["get", "current"],
          T.gold,
          ["boolean", ["get", "ahead"], false],
          T.halo,
          T.accent,
        ],
        "circle-stroke-color": ["case", ["boolean", ["get", "ahead"], false], T.accent, T.halo],
        "circle-stroke-width": ["case", ["boolean", ["get", "ahead"], false], 1.5, 2],
      },
    },
    {
      id: "route-num",
      type: "symbol",
      source: "route",
      metadata: { group: "routes" },
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["to-string", ["get", "n"]],
        "text-font": [MAP_FONT],
        "text-size": ["case", ["get", "current"], 11.5, 10],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": [
          "case",
          ["get", "current"],
          T.ink,
          ["boolean", ["get", "ahead"], false],
          T.accent,
          T.halo,
        ],
      },
    },
    {
      // The other stops at a place the tour comes back to, beside its disc.
      id: "route-also",
      type: "symbol",
      source: "route",
      metadata: { group: "routes" },
      filter: ["all", ["==", ["geometry-type"], "Point"], ["has", "also"]],
      layout: {
        "text-field": ["get", "also"],
        "text-font": [MAP_FONT],
        "text-size": 10,
        "text-anchor": "left",
        "text-offset": [1.4, 0],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": T.accent, "text-halo-color": T.halo, "text-halo-width": 1.5 },
    },
    {
      // Battles and sieges in their years (a few either side: a slider step is five), above
      // the places; their names from zoom 6. Under "the Bible alone", only those it tells.
      id: "battle-icon",
      type: "symbol",
      source: "battles",
      metadata: { group: "battles" },
      filter: [
        "all",
        [">=", YEAR, ["-", ["get", "year"], 5]],
        ["<=", YEAR, ["+", ["get", "year"], 5]],
        ["any", ["!", ["boolean", ["global-state", "bibleOnly"], false]], ["has", "ref"]],
      ],
      layout: {
        "icon-image": "hg-battle",
        "icon-size": 1.45,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-offset": [14, -14],
        "text-field": ["step", ["zoom"], "", 6, ["coalesce", ["get", LOCALE], ["get", "en"]]],
        "text-font": [MAP_FONT],
        "text-size": 11,
        "text-anchor": "left",
        "text-offset": [2.6, -1.2],
        "text-optional": true,
        "text-padding": LABEL_PADDING,
      },
      paint: {
        "icon-color": BATTLE_INK,
        "icon-halo-color": T.halo,
        "icon-halo-width": 1.6,
        "text-color": BATTLE_INK,
        "text-halo-color": T.halo,
        "text-halo-width": 1.4,
      },
    },
    {
      id: "ancient-label",
      type: "symbol",
      source: "ancient",
      metadata: { group: "ancient" },
      filter: ANCIENT_NOW,
      layout: {
        "text-field": ["coalesce", ["get", LOCALE], ["get", "en"]],
        "text-font": [MAP_FONT],
        "text-size": ["match", ["get", "rank"], 0, 12.5, 1, 11.5, 11],
        "text-variable-anchor": ["top", "bottom", "right", "left"],
        "text-radial-offset": 0.7,
        "text-justify": "auto",
        "symbol-sort-key": ["get", "rank"],
        "text-padding": LABEL_PADDING,
      },
      paint: {
        "text-color": ANCIENT_INK,
        "text-halo-color": T.halo,
        // Faded during a tour or a chapter, a light halo on the dark sea read as a smudge
        // (Knossos in Acts 16): no halo then.
        "text-halo-width": ["case", NOT_TOURING, 1.4, 0],
        "text-opacity": ["case", NOT_TOURING, 1, 0.4],
      },
    },
    {
      id: "place-label-area",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: [
        "all",
        isArea,
        visibleAtZoom,
        LABEL_IN_TIME,
        NOT_HIDDEN,
        NOT_DUP,
        ["!", IS_SELECTED],
        ["!", OFF_TOUR],
      ],
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
        "text-halo-width": ["case", OUT_OF_TIME, 0, 1.4],
        "text-opacity": fadeBeforeNT(0.4),
      },
    },
    {
      id: "place-label-water",
      type: "symbol",
      source: "places",
      metadata: { group: "places" },
      filter: [
        "all",
        isWater,
        NOT_HIDDEN,
        ["!=", ["get", "kind"], "body of water"],
        visibleAtZoom,
        NOT_DUP,
        ["!", IS_SELECTED],
        ["!", OFF_TOUR],
      ],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 14, 1, 12.5, 11.5],
        "text-letter-spacing": 0.06,
        "symbol-sort-key": PLACE_ORDER,
        // A sea's name on two short lines rather than one long one across the coast.
        "text-max-width": 5,
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
      filter: [
        "all",
        isLandmark,
        visibleAtZoom,
        labelledAtZoom,
        LABEL_IN_TIME,
        NOT_HIDDEN,
        HAS_LOCAL_NAME,
        NOT_DUP,
        ["!", IS_SELECTED],
        ["!", OFF_TOUR],
      ],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 13.5, 1, 12.5, 11.5],
        "text-variable-anchor": ["top", "bottom", "right", "left"],
        "text-radial-offset": 1,
        "text-justify": "auto",
        "symbol-sort-key": PLACE_ORDER,
        "text-padding": LABEL_PADDING,
      },
      paint: {
        "text-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          T.accent,
          LANDMARK_INK,
        ],
        "text-halo-color": T.halo,
        "text-halo-width": ["case", OUT_OF_TIME, 0, 1.5],
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
        // A pinned name (its own layer) takes over from zoom 6.
        ["any", ["!", ["has", "pin"]], ["<", ["zoom"], 6]],
        // At a continent's view one point names each state (build_data.py lead_anchor):
        // its grid of points named Parthia three times across the screen.
        ["any", ["has", "lead"], [">=", ["zoom"], 4]],
      ],
      metadata: { group: "borders" },
      minzoom: 2.5,
      layout: {
        // A vassal's second line, smaller: "JUDAH / under Assyria".
        "text-field": [
          "case",
          ["has", "v"],
          ["format", ["upcase", NAME], {}, "\n", {}, inLocale("v"), { "font-scale": 0.9 }],
          ["upcase", NAME],
        ],
        "text-font": [MAP_FONT],
        // The size follows the state's area; zoomed in, never below a readable size: Judah,
        // Israel and Philistia came out at 6 px at a region's view, and went unnoticed.
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          // Far out, a small state's name came out at 6 px: no smaller than 9.
          ["max", 9, ["*", ["get", "size"], 2.6]],
          6,
          ["max", 11, ["*", ["get", "size"], 3.7]],
          8,
          ["max", 13, ["*", ["get", "size"], 4.4]],
        ],
        "text-letter-spacing": 0.28,
        "text-max-width": 7,
        "symbol-sort-key": ["-", 0, ["get", "size"]],
        // Some padding keeps an empire's anchors from crowding one view; 48 px made the
        // box so large that a river label nearby left the Neo-Babylonian Empire unnamed.
        "text-padding": 16,
        // Room to move off a town instead of disappearing: two ems in eight directions.
        // Assyria's point lies at Nineveh; a step of 1.2 ems up or down left it unnamed at
        // 701 BC (over 28 years at the first view, 18 large states unnamed, then 12).
        "text-variable-anchor-offset": POLITY_LABEL_OFFSETS,
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
      filter: [
        "all",
        isSettlement,
        visibleAtZoom,
        labelledAtZoom,
        LABEL_IN_TIME,
        NOT_HIDDEN,
        HAS_LOCAL_NAME,
        NOT_DUP,
        ["!", OFF_TOUR],
        // Another name of a place on the same point (Zion for Jerusalem) is named only up
        // close, unless it is the one picked: at a region's zoom it crowded out its city.
        ["any", ["!=", ["get", "where_tpl"], "same"], [">=", ["zoom"], 11], IS_SELECTED, IN_TOUR],
      ],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT],
        // A chapter's or a tour's places, picked out, in one size, as their marks are.
        // The great cities grow from zoom 9 in: at zoom 10 Jerusalem stood at the villages'
        // size among 150 names. Not before: the tiles lay names out at the size one zoom in,
        // and growing from 8 already cost Bethlehem its name at 8.
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          ["case", IN_TOUR, 13.5, ["match", ["get", "rank"], 0, 15, 1, 13.5, 2, 12.5, 11.5]],
          11,
          ["case", IN_TOUR, 13.5, ["match", ["get", "rank"], 0, 17, 1, 14.5, 2, 12.5, 11]],
        ],
        "text-variable-anchor": ["top", "bottom", "right", "left"],
        "text-radial-offset": 0.8,
        "text-justify": "auto",
        "symbol-sort-key": PLACE_ORDER,
        "text-padding": LABEL_PADDING,
      },
      paint: {
        "text-color": ["case", ["boolean", ["feature-state", "selected"], false], T.accent, T.ink],
        "text-halo-color": T.halo,
        // A faded name has no halo: on the dark sea a light one read as a smudge.
        "text-halo-width": ["case", OUT_OF_TIME, 0, 1.6],
        "text-opacity": fadeBeforeNT(0.45),
      },
    },
    // Seas and lakes above the towns' names, so placed before them: the Salt Sea and the Sea
    // of Galilee lost to Capernaum and Jericho and went unnamed at zoom 8. Rivers and wadis
    // stay below (place-label-water): placed first, Ahava took Babylon's room.
    {
      id: "place-label-sea",
      type: "symbol",
      source: "sea-labels",
      metadata: { group: "places" },
      filter: [
        "all",
        isWater,
        NOT_HIDDEN,
        ["==", ["get", "kind"], "body of water"],
        visibleAtZoom,
        NOT_DUP,
        ["!", IS_SELECTED],
        ["!", OFF_TOUR],
      ],
      layout: {
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["match", ["get", "rank"], 0, 14, 1, 12.5, 11.5],
        "text-letter-spacing": 0.06,
        "symbol-sort-key": PLACE_ORDER,
        // A sea's name on two short lines rather than one long one across the coast.
        "text-max-width": 5,
      },
      // Seas are labelled on the dark sea; rivers, wadis and canals on land.
      paint: {
        "text-color": ["match", ["get", "kind"], "body of water", "#d7e7f2", T.water],
        "text-halo-color": ["match", ["get", "kind"], "body of water", "#1d4a66", T.halo],
        "text-halo-width": 1.3,
      },
    },
    {
      id: "polity-label-pin",
      type: "symbol",
      source: "polity-labels",
      // The fine grid of an empire's label points only when zoomed in (build_data.py). A
      // filter sees the tile's whole zoom, so this is from zoom 6.
      filter: [
        "all",
        ERA_FILTER,
        ["any", ["<", ["coalesce", ["get", "tier"], 0], 2], [">=", ["zoom"], 6]],
        ["has", "pin"],
      ],
      metadata: { group: "borders" },
      // The small states among the Bible's towns (Judah, Israel, Philistia), their label
      // moved by build-content.ts to the emptiest point of its shape near the middle, from
      // zoom 6. Placed before the towns' names (this layer sits above them): its point is
      // the one farthest from any town named at that zoom, so it rarely costs one, and
      // placed after them it never found room. Never drawn across a name.
      minzoom: 6,
      layout: {
        // A vassal's second line, smaller: "JUDAH / under Assyria".
        "text-field": [
          "case",
          ["has", "v"],
          ["format", ["upcase", NAME], {}, "\n", {}, inLocale("v"), { "font-scale": 0.9 }],
          ["upcase", NAME],
        ],
        "text-font": [MAP_FONT],
        // The size follows the state's area; zoomed in, never below a readable size: Judah,
        // Israel and Philistia came out at 6 px at a region's view, and went unnoticed.
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          // Far out, a small state's name came out at 6 px: no smaller than 9.
          ["max", 9, ["*", ["get", "size"], 2.6]],
          6,
          ["max", 11, ["*", ["get", "size"], 3.7]],
          8,
          ["max", 13, ["*", ["get", "size"], 4.4]],
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
        // Drawn over the thick of the towns (Judah's middle is Jerusalem's hills): a full
        // halo, so the letters read over the dots rather than among them.
        "text-opacity": 0.88,
        "text-halo-color": T.halo,
        "text-halo-width": 2.4,
        "text-halo-blur": 0.6,
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
      filter: ["all", ["has", "place"], hasInLocale("name")],
      minzoom: 4.5,
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": [MAP_FONT_ITALIC],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11.5, 10, 14],
        "text-letter-spacing": 0.12,
        // Once or twice a screen: at 280 px the Euphrates was named four times in one view.
        "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 5, 700, 10, 450],
        "text-max-angle": 55,
      },
      paint: { "text-color": T.water, "text-halo-color": T.halo, "text-halo-width": 1.4 },
    },
    // Candidate locations of the selected place, when its location is disputed.
    {
      id: "site-alt",
      type: "circle",
      source: "sites",
      filter: ["all", SITES_OF_SELECTED, NOT_TOURING],
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
      // During a tour the candidates of a disputed stop would crowd the route: the card
      // shows them when the place is opened.
      filter: [
        "all",
        SITES_OF_SELECTED,
        NOT_TOURING,
        ["any", ["!", ["has", "share"]], [">", SHARE, 0]],
      ],
      layout: {
        "text-field": [
          "case",
          // A sole candidate (Capernaum at Tell Hum) is the place: no “100 %” beside it.
          ["all", ["has", "share"], ["<", SHARE, 100]],
          ["concat", SITE_LABEL, " · ", ["to-string", SHARE], "%"],
          SITE_LABEL,
        ],
        "text-font": [MAP_FONT_ITALIC],
        "text-size": 12,
        "text-variable-anchor": ["left", "right", "top", "bottom"],
        "text-radial-offset": 1.3,
        // Candidates close together keep apart rather than print over each other.
        "text-padding": 6,
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
        NOT_HIDDEN,
        ["!", isSettlement],
        ["!", ["has", "line"]],
        visibleAtZoom,
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

  // A town not standing in the year (Antioch in 1300 BC) is named faded, and below the
  // ancient world's sites that do stand then: Ugarit's name wins the room over it.
  const label = layers.find((l) => l.id === "place-label");
  const ancient = layers.findIndex((l) => l.id === "ancient-label");
  if (label?.type === "symbol" && label.filter && ancient >= 0) {
    const shown: ExpressionSpecification = ["any", ["!", OUT_OF_TIME], IS_SELECTED, IN_TOUR];
    const base = label.filter as ExpressionSpecification;
    const past: ExpressionSpecification = ["all", base, ["!", shown]];
    const now: ExpressionSpecification = ["all", base, shown];
    layers.splice(ancient, 0, { ...label, id: "place-label-past", filter: past });
    label.filter = now;
  }

  // A large state at the edge of the view whose own points are off screen (Parthia east of
  // the first view): MapLibreRenderer.nameEdgeStates writes a point inside its part in view,
  // named after the main labels have their room.
  const polityLabel = layers.findIndex((l) => l.id === "polity-label");
  const main = layers[polityLabel];
  if (main?.type === "symbol")
    layers.splice(polityLabel, 0, {
      ...main,
      id: "polity-label-edge",
      source: "polity-edge-labels",
      filter: ERA_FILTER,
    });

  return {
    version: 8,
    projection: { type: "globe" },
    state: {
      year: { default: o.initialYear },
      locale: { default: o.initialLocale },
      selected: { default: "" },
      tourPlaces: { default: [] },
      bibleOnly: { default: false },
      hiddenNames: { default: [] },
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
        attribution: "Cliopatria / Seshat (CC BY 4.0, modified)",
      },
      "polity-labels": { type: "geojson", data: `${o.dataUrl}/polity-labels.geojson` },
      // Filled from the view (MapLibreRenderer.nameEdgeStates).
      "polity-edge-labels": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      rivers: {
        type: "geojson",
        data: `${o.dataUrl}/rivers.geojson`,
        attribution: "Natural Earth",
      },
      "river-labels": { type: "geojson", data: `${o.dataUrl}/river-labels.geojson` },
      places: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        attribution: "OpenBible.info (CC BY 4.0, modified)",
      },
      // The seas' and lakes' names at their own points (seaLabels): filled with the places.
      "sea-labels": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      mask: { type: "geojson", data: focusMask() },
      sites: { type: "geojson", data: `${o.dataUrl}/sites.geojson` },
      route: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      measure: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      // Filled on demand (MapLibreRenderer.loadRoads): 1.3 MB the first frame does not need.
      "roads-major": {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        attribution:
          'Roman roads: <a href="https://doi.org/10.5281/zenodo.17122148">Itiner-e</a> (de Soto, Pažout, Brughmans et al. 2025), CC BY 4.0',
      },
      "roads-minor": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      // Filled once the map has loaded (MapLibreRenderer.loadBattles).
      battles: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      // Filled once the map has loaded (MapLibreRenderer.loadAncient).
      ancient: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        attribution:
          'Ancient sites: <a href="https://pleiades.stoa.org">Pleiades</a> (CC BY 3.0), <a href="https://www.wikidata.org">Wikidata</a> (CC0)',
      },
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

/**
 * Where a sea's name is written, when its point is not a good place for it: OpenBible puts
 * the Great Sea just off Ashdod, where its name lay over the coast's towns. A cartographer's
 * choice, not the place's location (the point itself is unchanged).
 */
const SEA_LABEL_AT: Readonly<Record<string, readonly [number, number]>> = {
  aa805fb: [33.3, 33.0], // the Great Sea: open water between Cyprus and the Levant
};

/** The seas and lakes among the places, each at the point its name is written. */
export function seaLabels<F extends { properties: unknown; geometry: unknown }>(places: {
  readonly features: readonly F[];
}): { type: "FeatureCollection"; features: F[] } {
  return {
    type: "FeatureCollection",
    features: places.features
      .filter((f) => (f.properties as { kind?: string } | null)?.kind === "body of water")
      .map((f) => {
        const at = SEA_LABEL_AT[(f.properties as { id?: string }).id ?? ""];
        return at ? { ...f, geometry: { type: "Point", coordinates: [...at] } } : f;
      }),
  };
}
