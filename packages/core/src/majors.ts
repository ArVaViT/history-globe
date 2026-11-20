/**
 * The great towns (rank 0) kept on the map at each zoom. Their rings are drawn whatever
 * names, states, battles or seas lie near (style.ts place-label-major), so MapLibre's
 * collision cannot thin them: it is done here instead, between the great towns themselves.
 * At each zoom the most named town standing in the year keeps its ring, and a lesser one
 * within MIN_PX of a ring already kept waits for a closer view. The selected place takes no
 * room from them: a great town stays on the map beside it.
 *
 * Left to MapLibre's collision with their names, Tyre's name and the room kept round it would
 * take Damascus off the map at zoom 4.
 */
import { distanceKm } from "@hg/model";
import type { Feature, FeatureCollection, Point } from "geojson";
import { NO_YEAR, NT_FROM } from "./style-expressions.ts";

/** Closest two rings may stand, in px: a ring is 20 px across with its halo's room. */
export const MIN_PX = 24;
/** Zooms thinned; from the last one up every great town keeps its ring. */
export const LAST_ZOOM = 15;

export interface Life {
  readonly gap_from?: number;
  readonly gap_until?: number;
  readonly life_from?: number;
  readonly life_until?: number;
  readonly life_own?: boolean;
  readonly ot?: number;
}

/** The place did not stand in the year: style-expressions.ts OUT_OF_TIME, in code. */
export function outOfTime(p: Life, year: number): boolean {
  if (p.gap_from !== undefined && year >= p.gap_from && year < (p.gap_until ?? NO_YEAR))
    return true;
  if (year >= (p.life_until ?? NO_YEAR)) return true;
  if (p.life_from !== undefined) return year < p.life_from;
  if (p.life_own !== undefined) return false;
  return p.ot === 0 && year < NT_FROM;
}

/** A place's weight against others: its verses, or an ancient site's rank in verses. */
export function weight(f: { properties: Record<string, unknown> | null }): number {
  return Number(f.properties?.["weight"] ?? f.properties?.["verses"] ?? 0);
}

/** A great town drawn by place-label-major: a settlement of rank 0, not a second name. */
export function isMajor(
  p: { readonly kind?: unknown; readonly rank?: unknown; readonly where_tpl?: unknown } | null,
): boolean {
  return p?.kind === "settlement" && p.rank === 0 && p.where_tpl !== "same";
}

const KM_PER_WORLD = 40075;

/** Distance between two points in px at a zoom (512 px tiles), at their latitude. */
export function pxApart(a: readonly number[], b: readonly number[], zoom: number): number {
  const [lon1 = 0, lat1 = 0] = a;
  const [lon2 = 0, lat2 = 0] = b;
  const km = distanceKm([lon1, lat1], [lon2, lat2]);
  const lat = ((lat1 + lat2) / 2) * (Math.PI / 180);
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
        weight(b) - weight(a) ||
        String(a.properties["id"]).localeCompare(String(b.properties["id"])),
    );
  // The selected place never takes a great town off the map: the town is its setting. Kept
  // first, Abana (a river, 300 m from Damascus) kept Damascus off up to zoom 15, Golgotha and
  // Bethany Jerusalem, Italy Rome. Its gold dot is drawn over the ring (place-label-picked).
  const keep = new Map<PlaceFeature, number>(majors.map((f) => [f, 0]));
  for (let z = 0; z <= LAST_ZOOM; z++) {
    const kept: PlaceFeature[] = [];
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

/**
 * How far apart, in px, a selected place is set from the nearest great town: its ring and
 * the town's with room between them for both names, as a pool 550 m from Jerusalem stands
 * at zoom 13. Golgotha, 460 m off, was flown to at zoom 9.4: its ring lay on Jerusalem's
 * and its name took the town's place, so the reader saw no "Golgotha, by Jerusalem".
 */
export const BESIDE_PX = 64;
/**
 * The closest the camera flies to set a place apart from its town. Nearer still, the place
 * stands at the town's own point (a gate, a hall, a second name, by the data `at` the
 * town): no zoom parts them, and flying in would only show an empty street.
 */
export const BESIDE_MAX_ZOOM = 16;

/** A great town as the engine knows it: where it stands and when (outOfTime). */
export interface GreatTown {
  readonly id: string;
  readonly at: readonly number[];
  readonly life: Life;
}

/**
 * The zoom that frames a selected place by the nearest great town standing in the year: the
 * kind's zoom, or closer until the two lie BESIDE_PX apart. Only the nearest counts: at that
 * zoom any other town is farther still. The town stays in view, BESIDE_PX from the centre.
 */
export function zoomBeside(
  place: { readonly id: string; readonly at: readonly number[] },
  zoom: number,
  towns: Iterable<GreatTown>,
  year: number,
): number {
  let nearest = Infinity;
  for (const t of towns) {
    if (t.id === place.id || outOfTime(t.life, year)) continue;
    nearest = Math.min(nearest, pxApart(place.at, t.at, 0));
  }
  // pxApart doubles with each zoom step.
  const needed = Math.log2(BESIDE_PX / nearest);
  return needed > zoom && needed <= BESIDE_MAX_ZOOM ? needed : zoom;
}
