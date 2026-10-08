/**
 * The great towns (rank 0) kept on the map at each zoom. Their rings are drawn whatever
 * names, states, battles or seas lie near (style.ts place-label-major), so MapLibre's
 * collision cannot thin them: it is done here instead, between the great towns themselves.
 * At each zoom the most named town standing in the year keeps its ring, and a lesser one
 * within MIN_PX of a ring already kept waits for a closer view. The selected place counts
 * as kept first (its gold dot is drawn whatever lies near).
 *
 * Placed by MapLibre with their names, Tyre's name and the room kept round it took
 * Damascus off the map at zoom 4 (8.10.2026).
 */
import type { Feature, FeatureCollection, Point } from "geojson";
import { NT_FROM } from "./style-expressions.ts";

/** Closest two rings may stand, in px: a ring is 20 px across with its halo's room. */
export const MIN_PX = 24;
/** Zooms thinned; from the last one up every great town keeps its ring. */
export const LAST_ZOOM = 15;

interface Life {
  readonly gap_from?: number;
  readonly gap_until?: number;
  readonly life_from?: number;
  readonly life_until?: number;
  readonly life_own?: boolean;
  readonly ot?: number;
}

/** The place did not stand in the year: style-expressions.ts OUT_OF_TIME, in code. */
export function outOfTime(p: Life, year: number): boolean {
  if (p.gap_from !== undefined && year >= p.gap_from && year < (p.gap_until ?? 100000)) return true;
  if (year >= (p.life_until ?? 100000)) return true;
  if (p.life_from !== undefined) return year < p.life_from;
  if (p.life_own !== undefined) return false;
  return p.ot === 0 && year < NT_FROM;
}

/** A great town drawn by place-label-major: a settlement of rank 0, not a second name. */
export function isMajor(p: Record<string, unknown> | null): boolean {
  return p?.["kind"] === "settlement" && p["rank"] === 0 && p["where_tpl"] !== "same";
}

const KM_PER_WORLD = 40075;

/** Distance between two points in px at a zoom (512 px tiles), at their latitude. */
export function pxApart(a: readonly number[], b: readonly number[], zoom: number): number {
  const [lon1 = 0, lat1 = 0] = a;
  const [lon2 = 0, lat2 = 0] = b;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  const lat = ((lat1 + lat2) / 2) * rad;
  return (km * 512 * 2 ** zoom) / (KM_PER_WORLD * Math.cos(lat));
}

type PlaceFeature = Feature<Point, Record<string, unknown>>;

/**
 * The great towns standing in the year, each with `keep`: bit z set where its ring is
 * drawn at zoom z (a tile's zoom, an integer).
 */
export function thinMajors(
  places: FeatureCollection,
  year: number,
  selected: string | null,
): FeatureCollection<Point> {
  const point = (f: Feature): f is PlaceFeature => f.geometry.type === "Point";
  const all = places.features.filter(point);
  const majors = all
    .filter((f) => isMajor(f.properties) && !outOfTime(f.properties as Life, year))
    .filter((f) => f.properties["id"] !== selected)
    .sort(
      (a, b) =>
        Number(b.properties["verses"] ?? 0) - Number(a.properties["verses"] ?? 0) ||
        String(a.properties["id"]).localeCompare(String(b.properties["id"])),
    );
  const picked = all.find((f) => selected !== null && f.properties["id"] === selected);
  const keep = new Map<PlaceFeature, number>(majors.map((f) => [f, 0]));
  for (let z = 0; z <= LAST_ZOOM; z++) {
    const kept: PlaceFeature[] = picked ? [picked] : [];
    for (const f of majors) {
      const near = kept.some(
        (k) => pxApart(k.geometry.coordinates, f.geometry.coordinates, z) < MIN_PX,
      );
      if (near && z < LAST_ZOOM) continue;
      kept.push(f);
      keep.set(f, (keep.get(f) ?? 0) + 2 ** z);
    }
  }
  return {
    type: "FeatureCollection",
    features: majors.map((f) => ({
      ...f,
      properties: { ...f.properties, keep: keep.get(f) ?? 0 },
    })),
  };
}
