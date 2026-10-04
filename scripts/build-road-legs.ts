/**
 * The length of each leg of the Roman-era tours along the Roman roads (Itiner-e, the
 * map's roads layer): how far Paul walked from Lystra to Iconium, not the straight line.
 * Written to apps/web/public/data/road-legs.json as tour id → km per stop (null for the
 * first stop, a leg off the roads, or a voyage); the tour's card reads it. The ways
 * themselves go to road-paths.json ("<place>><place>" → points), for the relief along them.
 *
 * The road lines become a graph whose nodes are their points rounded to about 100 m, so
 * roads that meet join. A stop is tied to the nearest point of a road within 10 km; a leg
 * whose way by road is more than 2.5 times the straight line (off the network) gets none,
 * and so do legs the tour marks as sailed (`by: sea`), legs to or from a region or a sea,
 * and tours that are not a way travelled (`walked: false`). Only tours from 312 BC, when
 * the roads begin on the map.
 *
 * Usage: node scripts/build-road-legs.ts  (after the data build: it reads roads-*.geojson
 * and content.json)
 */
import { distanceKm } from "../apps/web/src/distance.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const data = join(import.meta.dirname, "..", "apps/web/public/data");
const out = join(data, "road-legs.json");

type Pt = readonly [number, number];
// The same great-circle distance as the app's cards.
const km = (a: Pt, b: Pt) => distanceKm(a, b);

const FROM_YEAR = -311; // 312 BC
const SNAP_KM = 10;
const DETOUR = 2.5;

const files = ["roads-major.geojson", "roads-minor.geojson"].map((f) => join(data, f));
if (!files.every(existsSync) || !existsSync(join(data, "content.json"))) {
  writeFileSync(out, "{}");
  writeFileSync(join(data, "road-paths.json"), "{}");
  console.log("road legs: no roads in this build (pnpm roads), none written");
  process.exit(0);
}

// The graph: node id by rounded point, edges with their length.
const ids = new Map<string, number>();
const at: Pt[] = [];
const edges: { to: number; km: number }[][] = [];
/** The road's segments, to tie a stop to the nearest point of a road, not of its corners. */
const segs: { u: number; v: number; a: Pt; b: Pt; km: number }[] = [];
const node = (p: Pt) => {
  const key = `${(Math.round(p[0] * 1000) / 1000).toFixed(3)},${(Math.round(p[1] * 1000) / 1000).toFixed(3)}`;
  let id = ids.get(key);
  if (id === undefined) {
    id = at.length;
    ids.set(key, id);
    at.push(p);
    edges.push([]);
  }
  return id;
};
for (const file of files) {
  const lines = (
    JSON.parse(readFileSync(file, "utf8")) as {
      features: { geometry: { type: string; coordinates: Pt[] | Pt[][] } }[];
    }
  ).features.flatMap((f) =>
    f.geometry.type === "MultiLineString"
      ? (f.geometry.coordinates as Pt[][])
      : [f.geometry.coordinates as Pt[]],
  );
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      if (!a || !b) continue;
      const u = node(a);
      const v = node(b);
      if (u === v) continue;
      const d = km(a, b);
      edges[u]?.push({ to: v, km: d });
      edges[v]?.push({ to: u, km: d });
      segs.push({ u, v, a, b, km: d });
    }
}

/**
 * The nearest point of a road to a point, within SNAP_KM: its segment, how far along it
 * (0–1) and how far away. A stop in the middle of a long straight road is on it.
 */
const nearest = (p: Pt) => {
  let best: { u: number; v: number; t: number; len: number; km: number } | null = null;
  const k = Math.cos((p[1] * Math.PI) / 180);
  const box = SNAP_KM / 111;
  for (const sg of segs) {
    const [x0, y0] = sg.a;
    const [x1, y1] = sg.b;
    if (
      Math.min(y0, y1) - box > p[1] ||
      Math.max(y0, y1) + box < p[1] ||
      (Math.min(x0, x1) - p[0]) * k > box ||
      (p[0] - Math.max(x0, x1)) * k > box
    )
      continue;
    // The projection in a local flat frame, then the true distance to that point.
    const dx = (x1 - x0) * k;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - x0) * k * dx + (p[1] - y0) * dy) / len2)) : 0;
    const d = km(p, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    if (d < SNAP_KM && (!best || d < best.km)) best = { u: sg.u, v: sg.v, t, len: sg.km, km: d };
  }
  return best;
};

/** A point on a road as Dijkstra sees it: the two ends of its segment and the way to each. */
const ends = (n: { u: number; v: number; t: number; len: number }): [number, number][] => [
  [n.u, n.t * n.len],
  [n.v, (1 - n.t) * n.len],
];

/**
 * The shortest way between two points on roads, up to `limit` km (Dijkstra, binary heap):
 * its length, and the road's corners between the two points.
 */
function shortest(
  from: { u: number; v: number; t: number; len: number },
  to: { u: number; v: number; t: number; len: number },
  limit: number,
): { km: number; nodes: number[] } | null {
  let answer = Infinity;
  /** The node the way reaches the end's segment by; -1 along that one segment. */
  let last = -1;
  const prev = new Map<number, number>();
  // On the same segment: straight along it.
  if ((from.u === to.u && from.v === to.v) || (from.u === to.v && from.v === to.u))
    answer = Math.abs((from.u === to.u ? from.t : 1 - from.t) - to.t) * to.len;
  const target = new Map(ends(to));
  const dist = new Map<number, number>();
  const heap: [number, number][] = [];
  const push = (e: [number, number]) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      const hp = heap[p];
      const hi = heap[i];
      if (!hp || !hi || hp[0] <= hi[0]) break;
      [heap[p], heap[i]] = [hi, hp];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        const hm = () => heap[m]?.[0] ?? Infinity;
        if ((heap[l]?.[0] ?? Infinity) < hm()) m = l;
        if ((heap[r]?.[0] ?? Infinity) < hm()) m = r;
        if (m === i) break;
        const a = heap[i];
        const b = heap[m];
        if (!a || !b) break;
        [heap[i], heap[m]] = [b, a];
        i = m;
      }
    }
    return top;
  };
  for (const [n, d] of ends(from)) {
    if (d < (dist.get(n) ?? Infinity)) {
      dist.set(n, d);
      prev.set(n, -1);
      push([d, n]);
    }
  }
  while (heap.length) {
    const top = pop();
    if (!top) break;
    const [d, u] = top;
    if (d >= answer || d > limit) break;
    if (d > (dist.get(u) ?? Infinity)) continue;
    const off = target.get(u);
    if (off !== undefined && d + off < answer) {
      answer = d + off;
      last = u;
    }
    for (const e of edges[u] ?? []) {
      const nd = d + e.km;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
        push([nd, e.to]);
      }
    }
  }
  if (!Number.isFinite(answer) || answer > limit) return null;
  const nodes: number[] = [];
  for (let n = last; n !== -1; n = prev.get(n) ?? -1) nodes.unshift(n);
  return { km: answer, nodes };
}

const content = JSON.parse(readFileSync(join(data, "content.json"), "utf8")) as {
  tours: {
    id: string;
    year: number;
    walked?: boolean;
    stops: { place: string; by?: string }[];
  }[];
};
const places = new Map(
  (
    JSON.parse(readFileSync(join(data, "places.geojson"), "utf8")) as {
      features: { geometry: { coordinates: Pt }; properties: { id: string; kind: string } }[];
    }
  ).features.map((f) => [f.properties.id, { at: f.geometry.coordinates, kind: f.properties.kind }]),
);
/** A region, a sea or a river has no one point to walk to: no way by road to it. */
const NOT_A_POINT = new Set([
  "region",
  "body of water",
  "river",
  "island",
  "people group",
  "natural area",
  "mountain range",
  "valley",
]);

const legs: Record<string, (number | null)[]> = {};
/** The ways by road, by their two places (read either way round). */
const paths: Record<string, Pt[]> = {};
/** A way kept light: every corner up to 80, else evenly picked; to about 100 m. */
const thin = (way: Pt[]): Pt[] => {
  const step = Math.max(1, Math.ceil(way.length / 80));
  return way
    .filter((_, i) => i % step === 0 || i === way.length - 1)
    .map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
};
let found = 0;
let total = 0;
for (const tour of content.tours.filter((t) => t.year >= FROM_YEAR && t.walked !== false)) {
  legs[tour.id] = tour.stops.map((stop, i) => {
    const prev = tour.stops[i - 1];
    const pa = prev && places.get(prev.place);
    const pb = places.get(stop.place);
    // Sailed (the tour says so), or to or from a region: no way by road.
    if (!pa || !pb || stop.by !== undefined || NOT_A_POINT.has(pa.kind) || NOT_A_POINT.has(pb.kind))
      return null;
    const a = pa.at;
    const b = pb.at;
    const straight = km(a, b);
    if (straight < 2) return null;
    total++;
    const na = nearest(a);
    const nb = nearest(b);
    if (!na || !nb) return null;
    const way = shortest(na, nb, straight * DETOUR);
    if (way === null) return null;
    const road = way.km + na.km + nb.km;
    if (road > straight * DETOUR) return null;
    found++;
    // The way itself, for the relief along it: the stop, the road's corners, the stop.
    // One way round only: the card reads the other by turning it, so there and back agree.
    if (!paths[`${stop.place}>${prev.place}`])
      paths[`${prev.place}>${stop.place}`] ??= thin([a, ...way.nodes.map((n) => at[n] ?? a), b]);
    return Math.round(road);
  });
}
// The same legs by their two places, both ways: a teacher's lesson (lesson-tour.ts) walks
// them too, and gets the same days as the tour it was built from.
const pairs: Record<string, number> = {};
for (const tour of content.tours)
  legs[tour.id]?.forEach((km, i) => {
    const a = tour.stops[i - 1]?.place;
    const b = tour.stops[i]?.place;
    if (km !== null && a && b) pairs[`${a}>${b}`] = pairs[`${b}>${a}`] = km;
  });
writeFileSync(out, JSON.stringify({ ...legs, "@pairs": pairs }));
writeFileSync(join(data, "road-paths.json"), JSON.stringify(paths));
console.log(
  `road legs: ${String(found)} of ${String(total)} legs of ${String(Object.keys(legs).length)} tours by road (${String(at.length)} road nodes)`,
);
