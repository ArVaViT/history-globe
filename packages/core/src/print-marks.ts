// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import type { Map as MLMap } from "maplibre-gl";
import type { LonLat } from "./renderer.ts";
import { groupByPoint } from "./route-stops.ts";
import { MAP_FONT, T } from "./style-expressions.ts";

const MARKS = "print-marks";

/**
 * Numbered discs on top of everything, as a tour's stops are. Places on one point (Ezra 2 names
 * five there) are one disc, the first number in it and the others beside it.
 */
export function addPrintMarks(map: MLMap, marks: readonly { at: LonLat; n: number }[]): void {
  map.addSource(MARKS, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: groupByPoint(marks, (m) => m.at).map(([first, ...rest]) => ({
        type: "Feature",
        properties: {
          n: first.n,
          ...(rest.length > 0 ? { also: rest.map((m) => String(m.n)).join(" · ") } : {}),
        },
        geometry: { type: "Point", coordinates: [first.at[0], first.at[1]] },
      })),
    },
  });
  map.addLayer({
    id: `${MARKS}-dot`,
    type: "circle",
    source: MARKS,
    paint: {
      "circle-radius": 7.5,
      "circle-color": T.accent,
      "circle-stroke-color": T.halo,
      "circle-stroke-width": 1.5,
    },
  });
  map.addLayer({
    id: MARKS,
    type: "symbol",
    source: MARKS,
    layout: {
      "text-field": ["to-string", ["get", "n"]],
      "text-font": [MAP_FONT],
      "text-size": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: `${MARKS}-also`,
    type: "symbol",
    source: MARKS,
    filter: ["has", "also"],
    layout: {
      "text-field": ["get", "also"],
      "text-font": [MAP_FONT],
      "text-size": 10,
      "text-anchor": "left",
      "text-offset": [1.2, 0],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": T.accent, "text-halo-color": T.halo, "text-halo-width": 1.5 },
  });
}

/** Takes the printed marks away, whatever part of them was added. */
export function removePrintMarks(map: MLMap): void {
  for (const id of [`${MARKS}-also`, MARKS, `${MARKS}-dot`])
    if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(MARKS)) map.removeSource(MARKS);
}
