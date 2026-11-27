// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import type { Map as MLMap } from "maplibre-gl";

type Box = readonly [number, number, number, number];

const polygonsOf = (g: GeoJSON.Geometry): GeoJSON.Position[][][] =>
  g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];

/** A shape's bounding box: west, south, east, north. */
export function bboxOf(g: GeoJSON.Geometry): Box {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [outer = []] of polygonsOf(g))
    for (const [x = 0, y = 0] of outer) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return [w, s, e, n];
}

const inBox = (b: Box, x: number, y: number) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

/** Whether a polygon (a tile's piece of a shape) covers a point: even-odd over its rings. */
export function covers(g: GeoJSON.Geometry, lon: number, lat: number): boolean {
  return polygonsOf(g).some((rings) => {
    let inside = false;
    for (const ring of rings) {
      let prev = ring.at(-1);
      for (const point of ring) {
        const [xi = 0, yi = 0] = point;
        const [xj = 0, yj = 0] = prev ?? point;
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
          inside = !inside;
        prev = point;
      }
    }
    return inside;
  });
}

/** Screen pixels between samples of the view. */
const STEP = 80;

/**
 * Labels for the large states the view shows unnamed: their own label points are off screen
 * (Parthia east of the first view, the Sasanians at AD 400) or crowded out. Each goes at a
 * point inside the state's part in view, in the open (not under a panel, not at sea).
 */
export function edgeStateLabels(map: MLMap): GeoJSON.Feature[] {
  const canvas = map.getCanvas();
  const doc = map.getContainer().ownerDocument;
  const box = canvas.getBoundingClientRect();
  // One query for the view, then the samples tested in memory: a query per sample takes half
  // a second.
  const shapes = (layer: string) =>
    map.getLayer(layer) && map.getLayoutProperty(layer, "visibility") !== "none"
      ? map.queryRenderedFeatures({ layers: [layer] })
      : [];
  const states = shapes("polity-fill");
  if (states.length === 0) return [];
  const water = shapes("water").map((f) => ({ f, box: bboxOf(f.geometry) }));
  const seen = new Map<string, { p: Record<string, unknown>; at: [number, number][] }>();
  let cells = 0;
  for (let x = STEP / 2; x < box.width; x += STEP)
    for (let y = STEP / 2; y < box.height; y += STEP) {
      if (doc.elementFromPoint(box.left + x, box.top + y) !== canvas) continue;
      const { lng, lat } = map.unproject([x, y]);
      // Off the globe (in space, or the sky when tilted) a pixel unprojects to the horizon:
      // such a sample is not map.
      const back = map.project([lng, lat]);
      if (Math.hypot(back.x - x, back.y - y) > 2) continue;
      cells += 1;
      if (water.some(({ f, box }) => inBox(box, lng, lat) && covers(f.geometry, lng, lat)))
        continue;
      // A state comes in a piece per tile: counted once a sample.
      const here = new Set<string>();
      for (const f of states) {
        const name = (f.properties as { name?: string }).name;
        if (!name || here.has(name) || !covers(f.geometry, lng, lat)) continue;
        here.add(name);
        let s = seen.get(name);
        if (!s) {
          s = { p: f.properties, at: [] };
          seen.set(name, s);
        }
        s.at.push([x, y]);
      }
    }
  const named = new Set(
    map
      .queryRenderedFeatures({ layers: ["polity-label", "polity-label-pin"] })
      .map((f) => (f.properties as { name?: string }).name),
  );
  // The label goes where it is farthest from the names already written, near the middle of
  // the state's part in view: at its middle alone Rome loses to the towns of Judea on a phone.
  // Only the names placed before it (the layers above) count: it cannot push those away, so
  // the choice does not swing between two points as it pushes a town's name in and out.
  const order = map.getLayersOrder();
  const symbols = order
    .slice(order.indexOf("polity-label-edge") + 1)
    .filter((id) => map.getLayer(id)?.type === "symbol");
  const written = map
    .queryRenderedFeatures({ layers: symbols })
    .flatMap((f) => (f.geometry.type === "Point" ? [f.geometry.coordinates] : []))
    .map(([lon = 0, lat = 0]) => map.project([lon, lat]));
  // Room to the names around and to the edges of the screen: a name at the edge is cut.
  const room = ([x, y]: [number, number]) =>
    Math.min(
      160,
      x,
      box.width - x,
      y * 2,
      (box.height - y) * 2,
      ...written.map((q) => Math.hypot(q.x - x, (q.y - y) * 2)),
    );
  const features: GeoJSON.Feature[] = [];
  for (const [name, { p, at }] of seen) {
    // A state over a twentieth of the open map at least: a sliver at the edge goes unnamed.
    if (named.has(name) || at.length < Math.max(3, cells / 20)) continue;
    const mx = at.reduce((a, [x]) => a + x, 0) / at.length;
    const my = at.reduce((a, [, y]) => a + y, 0) / at.length;
    const score = (q: [number, number]) => room(q) - 0.25 * Math.hypot(q[0] - mx, q[1] - my);
    const [x, y] = at.reduce((a, b) => (score(b) > score(a) ? b : a));
    const { lng, lat } = map.unproject([x, y]);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [+lng.toFixed(3), +lat.toFixed(3)] },
      properties: {
        // The names and vassal lines in every language the state has them in.
        ...Object.fromEntries(
          Object.entries(p).filter(([k]) => k.startsWith("name_") || k.startsWith("v_")),
        ),
        name,
        y0: p["y0"],
        y1: p["y1"],
        size: 3.4,
        ...(p["v"] ? { v: p["v"] } : {}),
      },
    });
  }
  return features;
}
