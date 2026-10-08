/**
 * The sea as MapLibre draws it: water.geojson cut into tiles by geojson-vt with the
 * options MapLibre gives a GeoJSON source, and each tile's polygons triangulated by earcut
 * as the fill layer does. A triangle in the middle of the land is sea painted over it: a
 * hole (an island) that crossed the simplified coast once joined itself to a shore 1,500 km
 * away and drew a straight band across Arabia at the zooms of a whole-region view
 * (pipeline/build_data.py, join_holes).
 */
import { readFileSync } from "node:fs";
import { GeoJSONVT } from "@maplibre/geojson-vt";
import earcut from "earcut";
import type { FeatureCollection } from "geojson";
import { describe, expect, it } from "vitest";
import { buildStyle } from "../packages/core/src/style.ts";

const FILE = new URL("../apps/web/public/data/water.geojson", import.meta.url);
// MapLibre 6 for a GeoJSON source: 512 px tiles of 8192 units, a 128 px buffer, and the
// style's tolerance (0.375 px when it gives none).
const EXTENT = 8192;
const PX = EXTENT / 512;
const source = buildStyle({
  dataUrl: "/data",
  terrainTiles: "https://example.test/{z}/{x}/{y}.webp",
  terrainAttribution: "test",
  fonts: {},
  initialYear: 30,
  initialLocale: "en",
}).sources.water;
const TOLERANCE = (source?.type === "geojson" ? (source.tolerance ?? 0.375) : 0.375) * PX;
const MAX_ZOOM = 6;
// A sliver along a simplified shore is within a pixel or two of it; the band was hundreds.
const FAR = 2 * PX;

type Pt = [number, number];

/** Rings into polygons by winding, as MapLibre's classifyRings does. */
function polygons(rings: Pt[][]): Pt[][][] {
  const out: Pt[][][] = [];
  let ccw: boolean | undefined;
  for (const ring of rings) {
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j] as Pt;
      const [x2, y2] = ring[i] as Pt;
      area += (x1 - x2) * (y2 + y1);
    }
    if (area === 0) continue;
    ccw ??= area < 0;
    if (ccw === area < 0) out.push([ring]);
    else out.at(-1)?.push(ring);
  }
  return out;
}

type Edge = [number, number, number, number];

/** A feature's edges in horizontal bands, so a point is tested against its band only. */
function bands(rings: Pt[][]): (y: number) => Edge[] {
  const n = 512;
  const lo = -2 * EXTENT;
  const size = (5 * EXTENT) / n;
  const out: Edge[][] = Array.from({ length: n }, () => []);
  const band = (y: number) => Math.max(0, Math.min(n - 1, Math.floor((y - lo) / size)));
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as Pt;
      const [xj, yj] = ring[j] as Pt;
      for (let b = band(Math.min(yi, yj)); b <= band(Math.max(yi, yj)); b++)
        out[b]?.push([xi, yi, xj, yj]);
    }
  return (y) => out[band(y)] ?? [];
}

function inside([x, y]: Pt, edges: Edge[]): boolean {
  let odd = false;
  for (const [xi, yi, xj, yj] of edges)
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
  return odd;
}

function distance([x, y]: Pt, rings: Pt[][]): number {
  let best = Infinity;
  for (const ring of rings)
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1] as Pt;
      const [bx, by] = ring[i] as Pt;
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
    }
  return best;
}

/** Triangles whose centre is on land, away from every shore, as "z/x/y lon,lat". */
export function seaOverLand(
  water: FeatureCollection,
  maxZoom = MAX_ZOOM,
  tolerance = TOLERANCE,
): string[] {
  const index = new GeoJSONVT(water, {
    extent: EXTENT,
    buffer: 128 * PX,
    tolerance,
    maxZoom: 18,
    indexMaxZoom: maxZoom,
  });
  const found: string[] = [];
  for (let z = 0; z <= maxZoom; z++) {
    const n = 2 ** z;
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++) {
        for (const feature of index.getTile(z, x, y)?.features ?? []) {
          if (feature.type !== 3) continue;
          const rings = feature.geometry as Pt[][];
          const edgesAt = bands(rings);
          for (const polygon of polygons(rings)) {
            const flat: number[] = [];
            const holes: number[] = [];
            for (const ring of polygon) {
              if (flat.length) holes.push(flat.length / 2);
              for (const [px, py] of ring) flat.push(px, py);
            }
            const tri = earcut(flat, holes);
            for (let i = 0; i < tri.length; i += 3) {
              const v = [tri[i], tri[i + 1], tri[i + 2]] as number[];
              const c: Pt = [
                v.reduce((s, k) => s + (flat[2 * k] as number), 0) / 3,
                v.reduce((s, k) => s + (flat[2 * k + 1] as number), 0) / 3,
              ];
              if (c[0] < 0 || c[1] < 0 || c[0] >= EXTENT || c[1] >= EXTENT) continue;
              if (inside(c, edgesAt(c[1])) || distance(c, rings) <= FAR) continue;
              const lon = ((x + c[0] / EXTENT) / n) * 360 - 180;
              const lat =
                (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + c[1] / EXTENT)) / n))) * 180) /
                Math.PI;
              found.push(
                `${String(z)}/${String(x)}/${String(y)} ${lon.toFixed(1)},${lat.toFixed(1)}`,
              );
            }
          }
        }
      }
  }
  return found;
}

describe("the sea in map tiles", () => {
  it("is not simplified, so the cuts that join islands to the sea stay closed", () => {
    expect(TOLERANCE).toBe(0);
    const water = JSON.parse(readFileSync(FILE, "utf8")) as FeatureCollection;
    for (const f of water.features) {
      const g = f.geometry;
      const polygons =
        g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
      for (const p of polygons) expect(p).toHaveLength(1);
    }
  });

  it("finds sea drawn over land when an island crosses the coast", () => {
    // A gulf with an island in its strait: simplified, the island crosses the coast, and
    // earcut joins it to the next shore west, across the land.
    const ring = (pts: Pt[]): Pt[] => [...pts, pts[0] as Pt];
    const gulf = ring([
      [0, 20],
      [40, 20],
      [40, 30],
      [30, 30],
      [30, 22],
      [10, 22],
      [10, 30],
      [0, 30],
    ]);
    const island = ring([
      [29.9, 25],
      [29.9, 27],
      [31, 27],
      [31, 25],
    ]);
    const broken: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [gulf, island] },
        },
      ],
    };
    expect(seaOverLand(broken, 2, 0.375 * PX).length).toBeGreaterThan(0);
  });

  it("has no sea over land in water.geojson at any zoom up to 6", () => {
    // Built by `pnpm data` (pipeline/build_data.py), like the rest of the gate's data.
    const water = JSON.parse(readFileSync(FILE, "utf8")) as FeatureCollection;
    expect(seaOverLand(water)).toEqual([]);
  }, 60_000);
});
