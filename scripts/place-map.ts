/**
 * A small map of a place for its static pages (scripts/build-pages.ts): an SVG drawn at build
 * time from the data the globe itself draws, in the globe's colours. The sea and the lakes
 * (water.geojson, and their shores, coast.geojson: Natural Earth, public domain), the rivers (rivers.geojson: Natural Earth,
 * and RiverATLAS, CC BY 4.0), the states of one year (polities.geojson: Cliopatria, CC BY 4.0,
 * with our corrections) and the place's point. No words in the picture, so one file serves
 * all 21 languages; the page gives its alt text, its year and its credits.
 *
 * One file per place, apps/web/public/data/maps/<id>.svg, linked with its content's hash
 * (`?v=`), so a browser keeps it until the picture changes. An SVG of 2–8 kB is crisp at
 * any density and lighter than a raster that would be sharp on a phone's screen.
 *
 * The plane: equirectangular, longitude scaled by the cosine of the place's latitude, the
 * place in the middle. Everything is clipped to the frame and simplified to half a pixel.
 */
import { POLITY_COLORS, T } from "../packages/core/src/style-expressions.ts";

export type Pt = readonly [number, number];
type Ring = readonly Pt[];

export const W = 360;
export const H = 240;
/**
 * Half the frame's height in degrees: about 60 km for a town, 180 km for an island (Cyprus and
 * Crete whole), 450 km for a land or a sea.
 */
export const SPAN = { near: 0.55, island: 1.6, wide: 4 } as const;
/**
 * How far, in pixels, a simplified line may stray from the line it stands for: half a pixel
 * close in, more on a wide map, whose shores at Natural Earth's 1:10m are mostly detail too
 * small to see (and kilobytes).
 */
const TOLERANCE = 0.5;
const tolerance = (f: Frame) => (f.span > SPAN.near ? 0.9 : TOLERANCE);
/** Specks smaller than this, in square pixels, are left out. */
const SPECK = { near: 2, wide: 6 } as const;

export interface Frame {
  readonly lon: number;
  readonly lat: number;
  /** Degrees of latitude per half height. */
  readonly span: number;
}

/** A point of the plane of `f`, in pixels from the top left. */
export function project(f: Frame, [lon, lat]: Pt): Pt {
  const k = Math.cos((f.lat * Math.PI) / 180);
  const scale = H / 2 / f.span;
  return [W / 2 + (lon - f.lon) * k * scale, H / 2 - (lat - f.lat) * scale];
}

/** The frame's corners in degrees: west, south, east, north (for a quick test of a box). */
export function bounds(f: Frame): [number, number, number, number] {
  const k = Math.cos((f.lat * Math.PI) / 180);
  const half = (f.span * W) / H / k;
  return [f.lon - half, f.lat - f.span, f.lon + half, f.lat + f.span];
}

/**
 * A ring clipped to the frame grown by a margin (Sutherland–Hodgman, convex window): the
 * parts outside are drawn along the frame's edges, out of sight. Nothing when none is left.
 */
export function clipRing(ring: Ring, m = 2): Pt[] {
  const edges: ((p: Pt) => boolean)[] = [
    (p) => p[0] >= -m,
    (p) => p[0] <= W + m,
    (p) => p[1] >= -m,
    (p) => p[1] <= H + m,
  ];
  const cross = (a: Pt, b: Pt, e: number): Pt => {
    const [x0, y0] = a;
    const [x1, y1] = b;
    if (e < 2) {
      const x = e === 0 ? -m : W + m;
      return [x, y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)];
    }
    const y = e === 2 ? -m : H + m;
    return [x0 + ((x1 - x0) * (y - y0)) / (y1 - y0), y];
  };
  let out: Pt[] = [...ring];
  edges.forEach((inside, e) => {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i] as Pt;
      const prev = input[(i + input.length - 1) % input.length] as Pt;
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur, e));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur, e));
    }
  });
  return out.length >= 3 ? out : [];
}

/**
 * A line cut to the frame grown by a margin: its runs of segments whose box meets the frame
 * (a segment may overshoot it; the picture's edge hides that).
 */
export function clipLine(line: Ring, m = 2): Pt[][] {
  const meetsFrame = (a: Pt, b: Pt) =>
    Math.max(a[0], b[0]) >= -m &&
    Math.min(a[0], b[0]) <= W + m &&
    Math.max(a[1], b[1]) >= -m &&
    Math.min(a[1], b[1]) <= H + m;
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Pt;
    const b = line[i] as Pt;
    if (meetsFrame(a, b)) {
      if (run.length === 0) run.push(a);
      run.push(b);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/** Douglas–Peucker: the points that keep the line within `tol` of itself. */
export function simplify(pts: readonly Pt[], tol = TOLERANCE): Pt[] {
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (!a || !b || pts.length < 3) return [...pts];
  let far = 0;
  let at = 0;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  pts.forEach(([x, y], i) => {
    if (i === 0 || i === pts.length - 1) return;
    const d =
      len === 0
        ? Math.hypot(x - a[0], y - a[1])
        : Math.abs((b[1] - a[1]) * x - (b[0] - a[0]) * y + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > far) [far, at] = [d, i];
  });
  return far <= tol
    ? [a, b]
    : [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

const num = (x: number) => {
  const s = x.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s === "-0" ? "0" : s;
};
/** A number of tenths as SVG writes it shortest: 15 → "1.5", -3 → "-.3", 20 → "2". */
const tenths = (t: number) => {
  const sign = t < 0 ? "-" : "";
  const a = Math.abs(t);
  const whole = Math.floor(a / 10);
  const frac = a % 10;
  return `${sign}${whole || !frac ? String(whole) : ""}${frac ? `.${String(frac)}` : ""}`;
};
/** Numbers in a row, parted by a space, or by nothing before a minus sign. */
const row = (ns: readonly number[]) =>
  ns.map(tenths).reduce((s, n, i) => (i === 0 ? n : `${s}${n.startsWith("-") ? "" : " "}${n}`), "");
/**
 * A path's data, rings closed with Z, lines open: each part's first point absolute, the rest
 * relative ("l"), on a grid of a tenth of a pixel, the steps taken between the rounded
 * points so that no error adds up along a shore.
 */
const pathOf = (parts: readonly (readonly Pt[])[], closed: boolean) =>
  parts
    .map((pts) => {
      const t = pts.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)] as const);
      const [x0, y0] = t[0] ?? [0, 0];
      const steps = t.slice(1).flatMap(([x, y], i) => {
        const [px, py] = t[i] ?? [0, 0];
        return [x - px, y - py];
      });
      return `M${row([x0, y0])}${steps.length ? `l${row(steps)}` : ""}${closed ? "z" : ""}`;
    })
    .join("");

/** A ring's area in pixels (shoelace). */
const area = (r: readonly Pt[]) =>
  Math.abs(
    r.reduce((s, [x0, y0], i) => {
      const [x1, y1] = r[(i + 1) % r.length] ?? [x0, y0];
      return s + x0 * y1 - x1 * y0;
    }, 0),
  ) / 2;

/**
 * A ring on a grid of `grid` pixels: points that fall together are one, and a point on the
 * straight line between its neighbours, going on the same way, is dropped. Two edges that
 * coincide stay coincident, which Douglas–Peucker does not promise: the water's islands hang
 * on the sea's outline by cuts of no width (pipeline, join_holes), and a cut simplified
 * apart opens to a hairline of land.
 */
export function snap(ring: readonly Pt[], grid: number): Pt[] {
  const out: Pt[] = [];
  for (const [x, y] of ring) {
    const p: Pt = [Math.round(x / grid) * grid, Math.round(y / grid) * grid];
    const last = out.at(-1);
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    const prev = out.at(-2);
    if (prev && last) {
      const [ax, ay] = [last[0] - prev[0], last[1] - prev[1]];
      const [bx, by] = [p[0] - last[0], p[1] - last[1]];
      // Straight on: the middle point says nothing. A turn back (a cut's end) is kept.
      if (ax * by - ay * bx === 0 && ax * bx + ay * by > 0) out.pop();
    }
    out.push(p);
  }
  const first = out[0];
  const last = out.at(-1);
  if (first && last && out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

/**
 * Rings projected, clipped and simplified (Douglas–Peucker, or on a grid with `grid`);
 * specks dropped.
 */
function rings(f: Frame, polys: readonly (readonly Ring[])[], grid?: number): Pt[][] {
  const out: Pt[][] = [];
  for (const poly of polys)
    for (const ring of poly) {
      const clipped = clipRing(ring.map((p) => project(f, p)));
      if (clipped.length === 0) continue;
      const closed = [...clipped, clipped[0] as Pt];
      const s = grid ? snap(clipped, grid) : simplify(closed, tolerance(f)).slice(0, -1);
      if (s.length >= 3 && area(s) >= (f.span > SPAN.near ? SPECK.wide : SPECK.near)) out.push(s);
    }
  return out;
}

/** Lines projected, cut to the frame and simplified. */
function lines(f: Frame, ls: readonly Ring[]): Pt[][] {
  const out: Pt[][] = [];
  for (const line of ls)
    for (const run of clipLine(line.map((p) => project(f, p)))) {
      const s = simplify(run, tolerance(f));
      if (s.length >= 2) out.push(s);
    }
  return out;
}

export interface Layers {
  /** Sea and lakes: polygons (outer ring, holes) in lon/lat. */
  readonly water: readonly (readonly Ring[])[];
  /** The shores of the sea and the lakes: lines in lon/lat. */
  readonly coast: readonly Ring[];
  /** Rivers: lines with their rank (1 the largest). */
  readonly rivers: readonly { readonly rank: number; readonly lines: readonly Ring[] }[];
  /** The states of the year: polygons, colour index, and whether drawn at half strength. */
  readonly states: readonly {
    readonly c: number;
    readonly vassal: boolean;
    /** A vassal drawn inside its overlord: its outline only, as on the globe. */
    readonly inside?: boolean;
    readonly polys: readonly (readonly Ring[])[];
  }[];
}

/** Whether a box in degrees meets the frame. */
export const meets = (
  f: Frame,
  [w, s, e, n]: readonly [number, number, number, number],
): boolean => {
  const [fw, fs, fe, fn] = bounds(f);
  return w <= fe && e >= fw && s <= fn && n >= fs;
};

/** The SVG of a place's map: its frame's layers and the point in the middle. */
export function placeMapSvg(f: Frame, layers: Layers): string {
  const parts: string[] = [];
  // States under the sea, as on the globe: their shapes are coarse offshore.
  for (const s of layers.states) {
    const r = rings(f, s.polys);
    if (r.length === 0) continue;
    const color = POLITY_COLORS[s.c] ?? POLITY_COLORS[0];
    parts.push(
      `<path d="${pathOf(r, true)}" ${s.inside ? 'fill="none"' : `fill="${color}" fill-opacity="${s.vassal ? "0.09" : "0.18"}"`} stroke="${color}" stroke-opacity="0.85" stroke-dasharray="4 2"/>`,
    );
  }
  // The water on a grid (`snap`): its cuts of no width stay closed. Filled by the nonzero
  // rule: an island hung on a cut winds the other way and stays land, while the parts of the
  // water that overlap (1:10m and 1:50m meet off Cyprus) stay water, which evenodd would not.
  const water = rings(f, layers.water, f.span > SPAN.near ? 1 : 0.5);
  if (water.length) parts.push(`<path d="${pathOf(water, true)}" fill="${T.oceanShallow}"/>`);
  // The shores as lines of their own: the water's outline has seams where its parts meet.
  const coast = lines(f, layers.coast);
  if (coast.length)
    parts.push(
      `<path d="${pathOf(coast, false)}" fill="none" stroke="${T.coast}" stroke-opacity="0.55" stroke-width="0.6"/>`,
    );
  // Rivers: the large ones on a wide map, all of them close in.
  const maxRank = f.span > SPAN.near ? 6 : 9;
  const byWidth = new Map<string, Pt[][]>();
  for (const r of layers.rivers) {
    if (r.rank > maxRank) continue;
    const width = r.rank <= 3 ? "1.6" : r.rank <= 6 ? "1.2" : "0.9";
    byWidth.set(width, [...(byWidth.get(width) ?? []), ...lines(f, r.lines)]);
  }
  for (const [width, lines] of byWidth)
    parts.push(
      `<path d="${pathOf(lines, false)}" fill="none" stroke="${T.oceanShallow}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  // The place: a dot with a light ring, readable on land and on water.
  const cx = num(W / 2);
  const cy = num(H / 2);
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="7.5" fill="none" stroke="#9a3b1f" stroke-opacity="0.4" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="3.8" fill="#9a3b1f" stroke="#fff8ea" stroke-width="1.5"/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(W)} ${String(H)}" width="${String(W)}" height="${String(H)}"><rect width="${String(W)}" height="${String(H)}" fill="${T.land}"/>${parts.join("")}</svg>\n`;
}
