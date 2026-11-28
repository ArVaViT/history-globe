/**
 * A tour's voyages stay on the water (scripts/build-content.ts runs the check): a leg
 * `by: sea`, drawn and measured from stop to stop through its `via` points, must not cross
 * the land the map draws (water.geojson, today's shores, Natural Earth). A straight line
 * from Ephesus to Caesarea runs over Caria and Lycia, from Sidon to Myra over Cyprus.
 *
 * What is let pass, and why:
 * - The landfall at either end. A stop's point is the town, not its harbour: Perga lies up
 *   the Cestrus, Antioch some 25 km up the Orontes from Seleucia, an island's point stands
 *   on its hill. Land touching an end is allowed for twice the point's own distance from the
 *   shore and 5 km more (ENDS_KM); a line that leaves the town over a cape and on across the
 *   land runs longer than that.
 * - A short run in the middle, under SLIVER_KM: today's coast is not the ancient one, and a
 *   simplified shore cuts the tip of a cape or an islet a ship rounded close.
 *
 * Pure: the water is passed in (content-checks.ts Water), so the rule is tested on its own.
 */
import { distanceKm, wayKm } from "../packages/model/src/distance.ts";

type LonLat = readonly [number, number];

/** What the check asks of the water (content-checks.ts Water). */
export interface WaterLike {
  contains(p: LonLat): boolean;
  shoreKm(p: LonLat, maxKm: number): number;
}

/** A run of land in the middle shorter than this is a cape cut close or an old shore. */
export const SLIVER_KM = 2;
/** The landfall allowed at an end beyond twice the town's distance from the shore. */
export const ENDS_KM = 5;
/** How often the way is sampled. */
const STEP_KM = 0.5;

/** A stretch of land on the way: where it starts, km from the start, and how long it is. */
export interface LandRun {
  readonly fromKm: number;
  readonly km: number;
  /** Its first point on the land. */
  readonly at: LonLat;
}

/** The runs of land along a way (the stops and the points between), sampled every STEP_KM. */
export function landRuns(water: WaterLike, way: readonly LonLat[]): LandRun[] {
  const runs: LandRun[] = [];
  let along = 0;
  let run: { fromKm: number; at: LonLat; km: number } | null = null;
  const close = () => {
    if (run) runs.push(run);
    run = null;
  };
  for (let k = 1; k < way.length; k++) {
    const a = way[k - 1] as LonLat;
    const b = way[k] as LonLat;
    const seg = distanceKm(a, b);
    const n = Math.max(1, Math.ceil(seg / STEP_KM));
    // The last point of the way is sampled too: k === way.length - 1 takes m = n.
    for (let m = 0; m <= (k === way.length - 1 ? n : n - 1); m++) {
      const f = m / n;
      const p: LonLat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const at = along + seg * f;
      if (water.contains(p)) close();
      else if (run) run.km = at - run.fromKm;
      else run = { fromKm: at, at: p, km: 0 };
    }
    along += seg;
  }
  close();
  return runs;
}

/** Why a voyage crosses the land, or null when it keeps to the water. */
export function seaLegCrossing(
  water: WaterLike,
  from: LonLat,
  to: LonLat,
  via: readonly LonLat[] = [],
): string | null {
  const way = [from, ...via, to];
  const total = wayKm(from, to, via);
  const landfall = (p: LonLat) => 2 * water.shoreKm(p, 60) + ENDS_KM;
  const tol = STEP_KM + 1e-9;
  for (const r of landRuns(water, way)) {
    const atStart = r.fromKm <= tol;
    const atEnd = r.fromKm + r.km >= total - tol;
    if (atStart && atEnd) return `runs over the land the whole way (${total.toFixed(0)} km)`;
    if (atStart ? r.km <= landfall(from) : atEnd ? r.km <= landfall(to) : r.km < SLIVER_KM)
      continue;
    return `crosses ${r.km.toFixed(1)} km of land from km ${r.fromKm.toFixed(0)} (at ${r.at[0].toFixed(2)}, ${r.at[1].toFixed(2)})`;
  }
  return null;
}

/** The tours' voyages that cross the land: "tours/<id>.yaml: stop N (place) …". */
export function seaLegErrors(
  tours: readonly {
    readonly id: string;
    readonly stops: readonly {
      readonly place: string;
      readonly by?: string | undefined;
      readonly via?: readonly LonLat[] | undefined;
    }[];
  }[],
  pointOf: (id: string) => LonLat | undefined,
  water: WaterLike,
): string[] {
  const errors: string[] = [];
  for (const t of tours)
    t.stops.forEach((s, i) => {
      const prev = t.stops[i - 1];
      if (s.by !== "sea" || !prev) return;
      const a = pointOf(prev.place);
      const b = pointOf(s.place);
      if (!a || !b) return;
      const why = seaLegCrossing(water, a, b, s.via);
      if (why)
        errors.push(
          `tours/${t.id}.yaml: stop ${String(i + 1)} (${s.place}) by sea ${why}: give it a "via" round the land`,
        );
    });
  return errors;
}
