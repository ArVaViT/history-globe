/**
 * Boolean operations and repairs on lon/lat polygons, for the corrections to the states'
 * shapes (scripts/build-polities.ts): a state drawn by hand, land added to a state's shape,
 * land cut away and given to another. Plane geometry on degrees, as the rest of the build.
 *
 * A shape is a list of rings read even-odd (a point inside an odd number of them is inside),
 * so it may have several parts and holes. Each shape alone must not cross itself (repair
 * that first, `repairRings`); the two shapes may cross each other anywhere, share edges and
 * touch at points. The result comes back as GeoJSON MultiPolygon coordinates: outer rings
 * counter-clockwise, holes clockwise, every ring closed.
 */
import { pointInRing, type Ring } from "./geo.ts";

type Pt = [number, number];
type Op = "union" | "intersection" | "difference";

const EPS = 1e-12;

/** A ring without its closing point and without repeated consecutive points. */
function open(ring: Ring): Pt[] {
  const out: Pt[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push([p[0], p[1]]);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

/** Twice the signed area: positive for a counter-clockwise ring. */
function signedArea2(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] ?? [0, 0];
    const [x1, y1] = ring[(i + 1) % ring.length] ?? [0, 0];
    a += x0 * y1 - x1 * y0;
  }
  return a;
}

/** Inside the shape, even-odd over its rings. */
function inside(p: Pt, rings: Pt[][]): boolean {
  let n = 0;
  for (const r of rings) if (pointInRing(p, r)) n++;
  return n % 2 === 1;
}

/**
 * The rings oriented so that the shape lies to the left of every edge: a ring inside an even
 * number of the others counter-clockwise, inside an odd number clockwise.
 */
function orient(rings: Pt[][]): Pt[][] {
  return rings.map((r, i) => {
    // A point just inside the ring's first edge stands for it: a vertex may lie on another ring.
    const depth = rings.filter((o, j) => j !== i && pointInRing(probe(r), o)).length;
    const ccw = signedArea2(r) > 0;
    return ccw === (depth % 2 === 0) ? r : [...r].reverse();
  });
}

/** The middle of the ring's longest edge: a point of the ring away from its vertices. */
function probe(r: Pt[]): Pt {
  let best = 0;
  let at: Pt = r[0] ?? [0, 0];
  for (let i = 0; i < r.length; i++) {
    const a = r[i] ?? [0, 0];
    const b = r[(i + 1) % r.length] ?? [0, 0];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > best) {
      best = d;
      at = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
  }
  return at;
}

type Seg = { a: Pt; b: Pt; cuts: { t: number; p: Pt }[] };

function segments(rings: Pt[][]): Seg[] {
  const out: Seg[] = [];
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i] ?? [0, 0];
      const b = r[(i + 1) % r.length] ?? [0, 0];
      out.push({ a, b, cuts: [] });
    }
  return out;
}

const bbox = (s: Seg) =>
  [
    Math.min(s.a[0], s.b[0]),
    Math.min(s.a[1], s.b[1]),
    Math.max(s.a[0], s.b[0]),
    Math.max(s.a[1], s.b[1]),
  ] as const;

/** Where `p` falls along a→b, 0 at a and 1 at b. */
const along = (s: Seg, p: Pt) => {
  const dx = s.b[0] - s.a[0];
  const dy = s.b[1] - s.a[1];
  const len = dx * dx + dy * dy;
  return len === 0 ? 0 : ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / len;
};

/** Distance from p to the segment a→b. */
function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Every point where a segment of one shape meets one of the other, as cuts on both. */
function cutAll(sa: Seg[], sb: Seg[]): void {
  // A grid of cells, so that only segments near each other are compared.
  const all = [...sa, ...sb];
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const g of all) {
    const [x0, y0, x1, y1] = bbox(g);
    w = Math.min(w, x0);
    s = Math.min(s, y0);
    e = Math.max(e, x1);
    n = Math.max(n, y1);
  }
  const cell = Math.max((e - w) / 64, (n - s) / 64, 1e-6);
  const grid = new Map<string, Seg[]>();
  for (const g of sb) {
    const [x0, y0, x1, y1] = bbox(g);
    for (let i = Math.floor((x0 - w) / cell); i <= Math.floor((x1 - w) / cell); i++)
      for (let j = Math.floor((y0 - s) / cell); j <= Math.floor((y1 - s) / cell); j++) {
        const k = `${String(i)}:${String(j)}`;
        const list = grid.get(k) ?? [];
        list.push(g);
        grid.set(k, list);
      }
  }
  for (const g of sa) {
    const [x0, y0, x1, y1] = bbox(g);
    const seen = new Set<Seg>();
    for (let i = Math.floor((x0 - w) / cell); i <= Math.floor((x1 - w) / cell); i++)
      for (let j = Math.floor((y0 - s) / cell); j <= Math.floor((y1 - s) / cell); j++)
        for (const h of grid.get(`${String(i)}:${String(j)}`) ?? []) {
          if (seen.has(h)) continue;
          seen.add(h);
          meet(g, h);
        }
  }
}

/** Cuts g and h where they meet: a crossing, a vertex of one on the other, or an overlap. */
function meet(g: Seg, h: Seg): void {
  const [gx0, gy0, gx1, gy1] = bbox(g);
  const [hx0, hy0, hx1, hy1] = bbox(h);
  if (gx1 < hx0 || hx1 < gx0 || gy1 < hy0 || hy1 < gy0) return;
  const rx = g.b[0] - g.a[0];
  const ry = g.b[1] - g.a[1];
  const sx = h.b[0] - h.a[0];
  const sy = h.b[1] - h.a[1];
  const det = rx * sy - ry * sx;
  const scale = Math.hypot(rx, ry) * Math.hypot(sx, sy);
  // A vertex of one lying on the other: a cut there, at the vertex itself.
  const touch = (p: Pt, on: Seg) => {
    if (toSegment(p, on.a, on.b) > 1e-11) return;
    const t = along(on, p);
    if (t > EPS && t < 1 - EPS) on.cuts.push({ t, p });
  };
  touch(g.a, h);
  touch(g.b, h);
  touch(h.a, g);
  touch(h.b, g);
  if (Math.abs(det) <= 1e-12 * scale) return; // parallel: only the touches above
  const qx = h.a[0] - g.a[0];
  const qy = h.a[1] - g.a[1];
  const t = (qx * sy - qy * sx) / det;
  const u = (qx * ry - qy * rx) / det;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return;
  const p: Pt = [g.a[0] + t * rx, g.a[1] + t * ry];
  g.cuts.push({ t, p });
  h.cuts.push({ t: u, p });
}

type Piece = { a: Pt; b: Pt };

function pieces(segs: Seg[]): Piece[] {
  const out: Piece[] = [];
  for (const s of segs) {
    const pts = [s.a, ...s.cuts.sort((x, y) => x.t - y.t).map((c) => c.p), s.b];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i] ?? [0, 0];
      const b = pts[i + 1] ?? [0, 0];
      if (a[0] !== b[0] || a[1] !== b[1]) out.push({ a, b });
    }
  }
  return out;
}

/**
 * Where a piece lies against the other shape: inside, outside, or on its border running the
 * same way as the other's edge there (both regions on one side) or the opposite way.
 */
function where(p: Piece, other: Pt[][], otherSegs: Seg[]): "in" | "out" | "same" | "opposite" {
  const mid: Pt = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
  for (const s of otherSegs) {
    if (toSegment(mid, s.a, s.b) > 1e-11) continue;
    const dot = (p.b[0] - p.a[0]) * (s.b[0] - s.a[0]) + (p.b[1] - p.a[1]) * (s.b[1] - s.a[1]);
    return dot > 0 ? "same" : "opposite";
  }
  return inside(mid, other) ? "in" : "out";
}

const key = (p: Pt) => `${String(p[0])},${String(p[1])}`;

/** The kept pieces joined into rings, the region on the left of each. */
function chain(kept: Piece[]): Pt[][] {
  const from = new Map<string, Piece[]>();
  for (const p of kept) {
    const list = from.get(key(p.a)) ?? [];
    list.push(p);
    from.set(key(p.a), list);
  }
  const used = new Set<Piece>();
  const rings: Pt[][] = [];
  for (const start of kept) {
    if (used.has(start)) continue;
    const ring: Pt[] = [];
    let cur: Piece | undefined = start;
    while (cur && !used.has(cur)) {
      used.add(cur);
      ring.push(cur.a);
      const back = Math.atan2(cur.a[1] - cur.b[1], cur.a[0] - cur.b[0]);
      const next: Piece[] = (from.get(key(cur.b)) ?? []).filter((q) => !used.has(q));
      // At a point where the region pinches (two parts touching), the widest left turn
      // keeps each part its own ring: the largest angle counter-clockwise from the way back.
      let best: Piece | undefined;
      let bestAngle = -Infinity;
      for (const q of next) {
        let ang = Math.atan2(q.b[1] - q.a[1], q.b[0] - q.a[0]) - back;
        while (ang <= 0) ang += 2 * Math.PI;
        while (ang > 2 * Math.PI) ang -= 2 * Math.PI;
        if (ang > bestAngle) {
          bestAngle = ang;
          best = q;
        }
      }
      cur = best;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/** Rings as MultiPolygon coordinates: each hole under the smallest outer ring holding it. */
function assemble(rings: Pt[][]): Ring[][] {
  const outers = rings.filter((r) => signedArea2(r) > 0);
  const holes = rings.filter((r) => signedArea2(r) < 0);
  const polys: Pt[][][] = outers.sort((a, b) => signedArea2(a) - signedArea2(b)).map((r) => [r]);
  for (const h of holes) {
    const at = probe(h);
    const home = polys.find((poly) => pointInRing(at, poly[0] ?? []));
    if (home) home.push(h);
  }
  const close = (r: Pt[]): Ring => [...r, r[0] ?? [0, 0]];
  return polys.reverse().map((poly) => poly.map(close));
}

/**
 * `a` op `b`, each a list of rings read even-odd (MultiPolygon coordinates flattened, or
 * plain rings). Neither shape may cross itself.
 */
export function booleanOp(a: Ring[], b: Ring[], op: Op): Ring[][] {
  const ra = orient(a.map(open).filter((r) => r.length >= 3));
  const rb = orient(b.map(open).filter((r) => r.length >= 3));
  const sa = segments(ra);
  const sb = segments(rb);
  cutAll(sa, sb);
  const pa = pieces(sa);
  const pb = pieces(sb);
  const kept: Piece[] = [];
  for (const p of pa) {
    const w = where(p, rb, sb);
    if (op === "union" && (w === "out" || w === "same")) kept.push(p);
    if (op === "intersection" && (w === "in" || w === "same")) kept.push(p);
    if (op === "difference" && (w === "out" || w === "opposite")) kept.push(p);
  }
  for (const p of pb) {
    const w = where(p, ra, sa);
    if (op === "union" && w === "out") kept.push(p);
    if (op === "intersection" && w === "in") kept.push(p);
    if (op === "difference" && w === "in") kept.push({ a: p.b, b: p.a });
  }
  return assemble(chain(kept));
}

/** The rings of MultiPolygon or Polygon coordinates, flattened. */
export const ringsOf = (geometry: { type: string; coordinates: unknown }): Ring[] =>
  geometry.type === "MultiPolygon"
    ? (geometry.coordinates as Ring[][]).flat()
    : geometry.type === "Polygon"
      ? (geometry.coordinates as Ring[])
      : [];

/** Every place where a ring of the shape crosses itself or another ring of it. */
export function selfCrossings(rings: Ring[]): Pt[] {
  const segs: { a: Pt; b: Pt; ring: number; i: number; n: number }[] = [];
  rings.forEach((r0, ring) => {
    const r = open(r0);
    for (let i = 0; i < r.length; i++)
      segs.push({ a: r[i] ?? [0, 0], b: r[(i + 1) % r.length] ?? [0, 0], ring, i, n: r.length });
  });
  if (segs.length === 0) return [];
  const xs = segs.flatMap((s) => [s.a[0], s.b[0]]);
  const ys = segs.flatMap((s) => [s.a[1], s.b[1]]);
  const w = Math.min(...xs);
  const s = Math.min(...ys);
  const cell = Math.max((Math.max(...xs) - w) / 128, (Math.max(...ys) - s) / 128, 1e-6);
  const grid = new Map<string, number[]>();
  segs.forEach((g, k) => {
    const x0 = Math.floor((Math.min(g.a[0], g.b[0]) - w) / cell);
    const x1 = Math.floor((Math.max(g.a[0], g.b[0]) - w) / cell);
    const y0 = Math.floor((Math.min(g.a[1], g.b[1]) - s) / cell);
    const y1 = Math.floor((Math.max(g.a[1], g.b[1]) - s) / cell);
    for (let i = x0; i <= x1; i++)
      for (let j = y0; j <= y1; j++) {
        const id = `${String(i)}:${String(j)}`;
        const list = grid.get(id) ?? [];
        list.push(k);
        grid.set(id, list);
      }
  });
  const found: Pt[] = [];
  const done = new Set<string>();
  for (const list of grid.values())
    for (let x = 0; x < list.length; x++)
      for (let y = x + 1; y < list.length; y++) {
        const p = segs[list[x] ?? 0];
        const q = segs[list[y] ?? 0];
        if (!p || !q) continue;
        const id = `${String(list[x])}:${String(list[y])}`;
        if (done.has(id)) continue;
        done.add(id);
        // Neighbours in one ring share a vertex, which is no crossing.
        if (p.ring === q.ring && (Math.abs(p.i - q.i) === 1 || Math.abs(p.i - q.i) === p.n - 1)) {
          continue;
        }
        const hit = properCross(p.a, p.b, q.a, q.b);
        if (hit) found.push(hit);
      }
  return found;
}

/** Where two segments cross or overlap, away from the ends both share. */
function properCross(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const det = rx * sy - ry * sx;
  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  if (det === 0) {
    // Parallel: a crossing only if collinear and overlapping over a length.
    if (qx * ry - qy * rx !== 0) return null;
    const len = rx * rx + ry * ry;
    if (len === 0) return null;
    const t0 = (qx * rx + qy * ry) / len;
    const t1 = ((d[0] - a[0]) * rx + (d[1] - a[1]) * ry) / len;
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(1, Math.max(t0, t1));
    return hi - lo > 1e-9 ? [a[0] + ((lo + hi) / 2) * rx, a[1] + ((lo + hi) / 2) * ry] : null;
  }
  const t = (qx * sy - qy * sx) / det;
  const u = (qx * ry - qy * rx) / det;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  const p: Pt = [a[0] + t * rx, a[1] + t * ry];
  // Touching at a vertex both have (two parts meeting at a point) is allowed.
  const end = (x: Pt) => Math.abs(x[0] - p[0]) < 1e-9 && Math.abs(x[1] - p[1]) < 1e-9;
  if ((end(a) || end(b)) && (end(c) || end(d))) return null;
  return p;
}

/**
 * The shape made valid: repeated points dropped, a ring that crosses itself split at the
 * crossings into its loops and the loops joined (union), holes cut out again, the parts
 * joined, so that no ring of the result crosses another. Pieces of `minArea` (square
 * degrees) or less are dropped.
 */
export function repairPolygons(polys: Ring[][], minArea = 0): Ring[][] {
  const loopsOf = (r0: Ring): Ring[][] => {
    let acc: Ring[][] = [];
    for (const loop of splitLoops(open(r0))) {
      const ccw = signedArea2(loop) > 0 ? loop : [...loop].reverse();
      if (Math.abs(signedArea2(ccw)) / 2 <= minArea) continue;
      const piece: Ring = [...ccw, ccw[0] ?? [0, 0]];
      acc = acc.length === 0 ? [[piece]] : booleanOp(acc.flat(), [piece], "union");
    }
    return acc;
  };
  let acc: Ring[][] = [];
  for (const poly of polys) {
    const [outer, ...holes] = poly;
    if (!outer || open(outer).length < 3) continue;
    let piece = loopsOf(outer);
    for (const h of holes) {
      const cut = loopsOf(h);
      if (cut.length > 0 && piece.length > 0)
        piece = booleanOp(piece.flat(), cut.flat(), "difference");
    }
    if (piece.length === 0) continue;
    acc = acc.length === 0 ? piece : booleanOp(acc.flat(), piece.flat(), "union");
  }
  return acc.filter((poly) => areaOf(poly[0] ?? []) > minArea);
}

/** A ring cut into simple loops at the points where it crosses itself. */
function splitLoops(r: Pt[]): Pt[][] {
  const segs = segments([r]);
  // Each segment against the others of the same ring (not its neighbours).
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 2; j < segs.length; j++) {
      if (i === 0 && j === segs.length - 1) continue;
      const g = segs[i];
      const h = segs[j];
      if (g && h) meet(g, h);
    }
  const pts: Pt[] = [];
  for (const p of pieces(segs)) pts.push(p.a);
  // Walk the points; on coming back to a point already on the path, the loop since is cut off.
  const out: Pt[][] = [];
  const stack: Pt[] = [];
  const at = new Map<string, number>();
  for (const p of [...pts, pts[0] ?? [0, 0]]) {
    const k = key(p);
    const seen = at.get(k);
    if (seen !== undefined) {
      const loop = stack.splice(seen);
      for (const q of loop) at.delete(key(q));
      if (loop.length >= 3) out.push(loop);
    }
    at.set(k, stack.length);
    stack.push(p);
  }
  if (stack.length >= 4) out.push(stack.slice(0, -1));
  return out;
}

/** The area of a ring in square degrees. */
export const areaOf = (ring: Ring): number => Math.abs(signedArea2(open(ring))) / 2;

/** Whether the point lies inside the shape (rings read even-odd). */
export const insideRings = (p: Pt, rings: Ring[]): boolean => inside(p, rings);
