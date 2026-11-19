/**
 * The states' shapes brought out to the coast (scripts/build-polities.ts). Cliopatria's
 * outlines are drawn at a scale where a coast may run a few kilometres inland of the real
 * one, so a port or a coastal capital fell outside its own state: Tyre 11 km from Rome,
 * Constantinople 7 km from the Eastern Roman Empire, Gaza and Ashkelon outside every
 * state. Where an edge of a shape faces the sea across a strip of land no other state of
 * those years holds, the strip and a little of the sea are added to the shape. The water
 * is drawn over the states (style.ts), so what is added at sea is never seen; on land it
 * fills the strip up to the shore.
 */
import { pointInRing, type Ring } from "./geo.ts";
import { booleanOp, repairPolygons, selfCrossings } from "./polygon-ops.ts";

/** How far inland of the shore an edge may run and still be taken to the coast (degrees). */
export const REACH = 0.15;
/** How far past the shore the added strip runs, so that the shore itself is inside. */
const PAST = 0.02;
/** The spacing of the points tested along an edge (degrees). */
const STEP = 0.03;

/** Water as a grid of cells, for a fast "is this point at sea" (scanline fill, even-odd). */
export class WaterGrid {
  readonly w: number;
  readonly s: number;
  readonly cell: number;
  readonly nx: number;
  readonly ny: number;
  private readonly bits: Uint8Array;
  constructor(rings: Ring[], box: [number, number, number, number], cell = 0.01) {
    const [w, s, e, n] = box;
    this.w = w;
    this.s = s;
    this.cell = cell;
    this.nx = Math.ceil((e - w) / cell);
    this.ny = Math.ceil((n - s) / cell);
    this.bits = new Uint8Array(this.nx * this.ny);
    // Each edge listed under the rows whose middle line it crosses.
    const rows: number[][] = Array.from({ length: this.ny }, () => []);
    const edges: [number, number, number, number][] = [];
    for (const r of rings)
      for (let i = 0; i + 1 < r.length; i++) {
        const [x0, y0] = r[i] ?? [0, 0];
        const [x1, y1] = r[i + 1] ?? [0, 0];
        if (y0 === y1) continue;
        // A row too many either side: the crossing test below decides, so that rounding in
        // the row's middle line never drops an edge that crosses it.
        const lo = Math.max(0, Math.floor((Math.min(y0, y1) - s) / cell - 0.5));
        const hi = Math.min(this.ny - 1, Math.ceil((Math.max(y0, y1) - s) / cell - 0.5));
        const k = edges.push([x0, y0, x1, y1]) - 1;
        for (let j = lo; j <= hi; j++) rows[j]?.push(k);
      }
    rows.forEach((list, j) => {
      const y = s + (j + 0.5) * cell;
      const xs: number[] = [];
      for (const k of list) {
        const [x0, y0, x1, y1] = edges[k] ?? [0, 0, 0, 0];
        if (y0 > y === y1 > y) continue;
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      for (let m = 0; m + 1 < xs.length; m += 2) {
        const from = Math.max(0, Math.ceil(((xs[m] ?? 0) - w) / cell - 0.5));
        const to = Math.min(this.nx - 1, Math.floor(((xs[m + 1] ?? 0) - w) / cell - 0.5));
        // A run wholly off the grid (TypedArray.fill reads a negative end from the back).
        if (to >= from) this.bits.fill(1, j * this.nx + from, j * this.nx + to + 1);
      }
    });
  }
  at([x, y]: [number, number]): boolean {
    const i = Math.floor((x - this.w) / this.cell);
    const j = Math.floor((y - this.s) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return false;
    return this.bits[j * this.nx + i] === 1;
  }
}

type Shape = {
  polys: Ring[][];
  y0: number;
  y1: number;
  name: string;
};

const signedArea = (r: Ring) => {
  let a = 0;
  for (let i = 0; i + 1 < r.length; i++) {
    const [x0, y0] = r[i] ?? [0, 0];
    const [x1, y1] = r[i + 1] ?? [0, 0];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
};

const boxOf = (rings: Ring[]): [number, number, number, number] => {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const r of rings)
    for (const [x, y] of r) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return [w, s, e, n];
};

/**
 * The shape with the strips added along the edges that face the sea across land no other
 * shape holds. `others` are the shapes of other states standing in some of the same years.
 * Returns null when nothing is added.
 */
export function reachCoast(shape: Shape, others: Shape[], water: WaterGrid): Ring[][] | null {
  const own = boxOf(shape.polys.flat());
  const cos = Math.cos((((own[1] + own[3]) / 2) * Math.PI) / 180);
  const overlaps = (a: readonly number[], b: readonly number[]) =>
    (a[0] ?? 0) <= (b[2] ?? 0) + REACH &&
    (b[0] ?? 0) <= (a[2] ?? 0) + REACH &&
    (a[1] ?? 0) <= (b[3] ?? 0) + REACH &&
    (b[1] ?? 0) <= (a[3] ?? 0) + REACH;
  const near = others
    .map((o) => ({ rings: o.polys.flat(), box: boxOf(o.polys.flat()) }))
    .filter((o) => overlaps(o.box, own));
  const held = (p: [number, number]) =>
    near.some(
      ({ rings, box }) =>
        p[0] >= box[0] &&
        p[0] <= box[2] &&
        p[1] >= box[1] &&
        p[1] <= box[3] &&
        rings.filter((r) => pointInRing(p, r)).length % 2 === 1,
    );
  const strips: Ring[] = [];
  for (const poly of shape.polys) {
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    // Outward is to the right of a counter-clockwise ring.
    const sign = signedArea(ring) > 0 ? 1 : -1;
    // Per edge: how far out the sea is (or null), from points along it.
    const reach: (number | null)[] = [];
    for (let i = 0; i + 1 < ring.length; i++) {
      const [ax, ay] = ring[i] ?? [0, 0];
      const [bx, by] = ring[i + 1] ?? [0, 0];
      const dx = (bx - ax) * cos;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      if (len === 0) {
        reach.push(null);
        continue;
      }
      // The outward normal, in degrees of longitude and latitude.
      const nx = (sign * dy) / len / cos;
      const ny = (-sign * dx) / len;
      const k = Math.max(1, Math.ceil(len / STEP));
      let hits = 0;
      let tested = 0;
      let far = 0;
      for (let j = 0; j <= k; j++) {
        const t = j / k;
        const q: [number, number] = [ax + t * (bx - ax), ay + t * (by - ay)];
        if (water.at(q)) continue; // this part of the edge is at sea already
        tested++;
        let d = 0;
        for (let step = 0.01; step <= REACH; step += 0.01)
          if (water.at([q[0] + nx * step, q[1] + ny * step])) {
            d = step;
            break;
          }
        if (d === 0) continue;
        // The strip between the edge and the shore is no other state's.
        const mid: [number, number] = [q[0] + (nx * d) / 2, q[1] + (ny * d) / 2];
        if (held(mid)) continue;
        hits++;
        far = Math.max(far, d);
      }
      reach.push(tested > 0 && hits * 2 >= tested ? far + PAST : null);
    }
    // Each run of edges that face the sea becomes one strip: the edges and, back along
    // them, the same points moved out to sea.
    const n = reach.length;
    if (reach.every((r) => r === null)) continue;
    // Start after an edge that does not face the sea, so that no run is split in two.
    const start = reach.findIndex((r) => r === null);
    const order =
      start < 0 ? [...Array(n).keys()] : [...Array(n).keys()].map((i) => (i + start + 1) % n);
    let run: number[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const inner: [number, number][] = [];
      const outer: [number, number][] = [];
      run.forEach((i, m) => {
        const [ax, ay] = ring[i] ?? [0, 0];
        const [bx, by] = ring[i + 1] ?? [0, 0];
        const dx = (bx - ax) * cos;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const d = reach[i] ?? 0;
        const ox = ((sign * dy) / len / cos) * d;
        const oy = ((-sign * dx) / len) * d;
        if (m === 0) {
          inner.push([ax, ay]);
          outer.push([ax + ox, ay + oy]);
        }
        inner.push([bx, by]);
        outer.push([bx + ox, by + oy]);
        // The far corners of consecutive edges are both kept; the strip's outer line
        // crossing itself at a sharp bend is repaired below.
        if (m > 0) outer.splice(outer.length - 1, 0, [ax + ox, ay + oy]);
      });
      strips.push([...inner, ...outer.reverse(), inner[0] ?? [0, 0]]);
      run = [];
    };
    for (const i of order) {
      if (reach[i] === null || reach[i] === undefined) flush();
      else run.push(i);
    }
    flush();
  }
  if (strips.length === 0) return null;
  let added = repairPolygons(strips.map((r) => [r]));
  // Where a strip's end runs onto a neighbour's land (a border meeting the coast), the
  // neighbour keeps it.
  const box = boxOf(added.flat());
  for (const o of near)
    if (added.length > 0 && overlaps(o.box, box))
      added = booleanOp(added.flat(), validRings(o.rings), "difference");
  if (added.length === 0) return null;
  return booleanOp(validRings(shape.polys.flat()), added.flat(), "union");
}

const validRings = (rings: Ring[]): Ring[] =>
  selfCrossings(rings).length > 0 ? repairPolygons(rings.map((r) => [r])).flat() : rings;
