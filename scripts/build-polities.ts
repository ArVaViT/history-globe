/**
 * The states for the map (Cliopatria, ADR 0004) with our corrections
 * (content/polity-overrides.yaml): shapes copied forward and back, clipped, recoloured,
 * renamed, cut out of years, bridged, annexed, made vassals; one lead label each; the
 * small states' labels moved into the open; Russian names (content/polity-names.yaml).
 * Read from the pipeline's states (pipeline/.cache, `pnpm data`), never from what it wrote
 * before, and written through `writes`. Part of scripts/build-content.ts, which calls it.
 */
import { rulersOf, shapeOf } from "./rulers.ts";
import { pointInRing, type Ring, ringArea } from "./geo.ts";
import { areaOf, booleanOp, insideRings, repairPolygons, selfCrossings } from "./polygon-ops.ts";
import { join } from "node:path";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import {
  AncientSitesFile,
  AncientWaveFile,
  PolityAnchorsFile,
  PolityNamesFile,
  PolityOverridesFile,
} from "../packages/model/src/content.ts";
import { POLITY_SPLIT_YEAR } from "../packages/model/src/time.ts";
import { undocumented } from "./release-doc.ts";
import { REACH, reachCoast, WaterGrid } from "./polity-coast.ts";

const root = join(import.meta.dirname, "..");

type Seamed = { properties: { name: string; y0: number; y1: number; rel?: boolean } };

/**
 * Overrides `seams`: the shapes and labels of a polity that begin in `data_year` begin in
 * `first_year`, and those that end in it end then. Each feature list is changed in place.
 */
export function moveSeams(
  features: Seamed[],
  seams: readonly { polity: string; data_year: number; first_year: number }[],
  errors: string[],
): void {
  for (const s of seams) {
    const own = features.filter((f) => f.properties.name === s.polity && !f.properties.rel);
    const after = own.filter((f) => f.properties.y0 === s.data_year);
    const before = own.filter((f) => f.properties.y1 === s.data_year);
    if (after.length === 0 || s.first_year === s.data_year) {
      errors.push(
        `polity-overrides: seam "${s.polity}": no shape begins in ${String(s.data_year)}`,
      );
      continue;
    }
    if (
      after.some((f) => f.properties.y1 <= s.first_year) ||
      before.some((f) => f.properties.y0 >= s.first_year)
    ) {
      errors.push(`polity-overrides: seam "${s.polity}" moves past a whole shape`);
      continue;
    }
    for (const f of after) f.properties.y0 = s.first_year;
    for (const f of before) f.properties.y1 = s.first_year;
  }
}

type Drawn = { geometry: unknown; properties: Record<string, unknown> };

/**
 * Overrides `clips` with `drawn_from_cut`: the land a clip cut away, as a shape of the state
 * in `to` for those years, with the properties of `like` (its shape nearest in time) and a
 * label at the middle of its largest part. Nothing when the land is empty.
 */
export function drawnFromCut(
  like: { properties: object },
  y0: number,
  y1: number,
  rings: Ring[],
): { shape: Drawn & PolityLike; label: Drawn & PolityLike } | undefined {
  const shape = tidy(booleanOp(rings, [], "union"));
  if (shape.length === 0) return undefined;
  const props: PolityLike["properties"] & { clipped?: number } = {
    ...(like.properties as PolityLike["properties"]),
    y0,
    y1,
    src: "override",
  };
  delete props.clipped;
  const total = shape.reduce((sum, poly) => sum + ringArea(poly[0] ?? []), 0);
  return {
    shape: { geometry: { type: "MultiPolygon", coordinates: shape }, properties: props },
    label: {
      geometry: { type: "Point", coordinates: middleOf(shape) },
      properties: {
        ...props,
        size: Math.round((Math.log10(Math.max(total, 0.01)) + 2) * 100) / 100,
        tier: 0,
        lead: 1,
      },
    },
  };
}
type PolityLike = {
  properties: { name: string; y0: number; y1: number; rel?: boolean; src?: string };
};

export interface PolityBuild {
  readonly out: string;
  /** Where the pipeline left the states as Cliopatria draws them (pipeline/.cache). */
  readonly from: string;
  readonly load: (path: string) => unknown;
  readonly places: {
    features: {
      geometry: { coordinates: number[] };
      properties: { rank: number };
    }[];
  };
  readonly errors: string[];
  readonly writes: [path: string, text: string][];
  /** The states' names in the other languages (content/names-<code>.yaml), by language. */
  readonly namesIn?: Readonly<
    Record<string, { readonly polities: Readonly<Record<string, string>> }>
  >;
}

type Geometry = { type: string; coordinates: unknown };

/** The polygons of a Polygon or MultiPolygon, each its outer ring and holes. */
const polysOf = (g: Geometry): Ring[][] =>
  g.type === "MultiPolygon"
    ? (g.coordinates as Ring[][])
    : g.type === "Polygon"
      ? [g.coordinates as Ring[]]
      : [];

/** The rings of a shape, repaired first if one crosses another (polygon-ops needs that). */
const valid = (g: Geometry): Ring[] => {
  const polys = polysOf(g);
  return selfCrossings(polys.flat()).length > 0 ? repairPolygons(polys).flat() : polys.flat();
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const closeRing = (r: Ring): Ring => {
  const first = r[0];
  const last = r[r.length - 1];
  return first && last && (first[0] !== last[0] || first[1] !== last[1]) ? [...r, first] : r;
};

/** A point inside the largest part: the mean of its points, or the nearest inside of a grid. */
function middleOf(shape: Ring[][]): [number, number] {
  const ring = shape
    .map((poly) => poly[0] ?? [])
    .reduce((a, r) => (ringArea(r) > ringArea(a) ? r : a));
  const pts = ring.slice(0, -1);
  const mid: [number, number] = [
    Math.round((pts.reduce((a, [x]) => a + x, 0) / pts.length) * 1000) / 1000,
    Math.round((pts.reduce((a, [, y]) => a + y, 0) / pts.length) * 1000) / 1000,
  ];
  if (insideRings(mid, shape.flat())) return mid;
  let best: [number, number] = ring[0] ?? mid;
  let dist = Infinity;
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.02)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.02) {
      const c: [number, number] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
      const d = Math.hypot(c[0] - mid[0], c[1] - mid[1]);
      if (d < dist && insideRings(c, shape.flat())) {
        dist = d;
        best = c;
      }
    }
  return best;
}

/** About 0.5 km² and 5 km² near 32 degrees N, in square degrees. */
const SPECK = 0.00005;
const SLIVER = 0.0005;
/** 4πA/P²: 1 for a circle, near 0 for a thin strip. */
const roundness = (r: Ring): number => {
  let per = 0;
  for (let i = 0; i + 1 < r.length; i++) {
    const [x0, y0] = r[i] ?? [0, 0];
    const [x1, y1] = r[i + 1] ?? [0, 0];
    per += Math.hypot(x1 - x0, y1 - y0);
  }
  return per === 0 ? 0 : (4 * Math.PI * areaOf(r)) / (per * per);
};
/** A piece no one would see as land: a speck, or a thin strip a clip left along its edge. */
export const isSliver = (r: Ring): boolean => {
  const a = areaOf(r);
  return a < SPECK || (a < SLIVER && roundness(r) < 0.1);
};

/**
 * A shape as it ships: points at three decimals, none repeated, no ring crossing another
 * (repaired, polygon-ops.ts), no specks or slivers. Running it again changes nothing.
 */
export function tidy(polys: Ring[][]): Ring[][] {
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const clean = (ps: Ring[][]): Ring[][] =>
    ps
      .map((poly) =>
        poly
          .map((ring) => {
            const out: Ring = [];
            // A spike (the ring running out and straight back, as a clip leaves along its
            // edge) is no land: its tip is dropped, here and across the ring's closing point.
            const spike = (a: [number, number], b: [number, number], c: [number, number]) =>
              Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-12 &&
              (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) <= 0;
            const push = (p: [number, number]) => {
              const last = out[out.length - 1];
              if (last && last[0] === p[0] && last[1] === p[1]) return;
              while (out.length >= 2) {
                const a = out[out.length - 2] ?? p;
                const b = out[out.length - 1] ?? p;
                if (!spike(a, b, p)) break;
                out.pop();
              }
              const top = out[out.length - 1];
              if (!top || top[0] !== p[0] || top[1] !== p[1]) out.push(p);
            };
            for (const [x, y] of ring) push([r3(x), r3(y)]);
            // Open, then trim spikes at the seam.
            const first = out[0];
            const end = out[out.length - 1];
            if (first && end && first[0] === end[0] && first[1] === end[1]) out.pop();
            for (let guard = 0; out.length >= 3 && guard < out.length; guard++) {
              const n = out.length;
              if (spike(out[n - 1] ?? [0, 0], out[0] ?? [0, 0], out[1] ?? [0, 0])) out.shift();
              else if (spike(out[n - 2] ?? [0, 0], out[n - 1] ?? [0, 0], out[0] ?? [0, 0]))
                out.pop();
              else break;
            }
            return closeRing(out);
          })
          .filter((ring) => ring.length >= 4),
      )
      .filter((poly) => poly.length > 0);
  let out = clean(polys);
  // Rounding a repaired shape can make it cross again where two edges ran a hair apart.
  for (let i = 0; i < 3 && selfCrossings(out.flat()).length > 0; i++)
    out = clean(repairPolygons(out, SPECK));
  return out
    .filter((poly) => !isSliver(poly[0] ?? []))
    .map((poly) => [poly[0] ?? [], ...poly.slice(1).filter((h) => !isSliver(h))]);
}

export function buildPolities({
  out,
  from,
  load,
  places,
  errors,
  writes,
  namesIn = {},
}: PolityBuild): void {
  // Our corrections to Cliopatria (content/polity-overrides.yaml): a polity's last shape and
  // labels are copied forward to its real end.
  type PolityFeature = {
    geometry: unknown;
    properties: {
      name: string;
      y0: number;
      y1: number;
      rel?: boolean;
      src?: string;
      /** A copy clipped for some years only (overrides \`clips\` with years); not published. */
      clipped?: number;
    };
  };
  /** A vassal's marks: the overlord's colour in `c`, the second line. */
  type VassalProps = { c?: number; v?: string; v_ru?: string };
  // The states ship twice (below): what the first frame needs, to AD 500, and all of them,
  // which the map switches to when the slider first passes AD 500.
  const readFeatures = (path: string): PolityFeature[] => {
    if (!existsSync(path)) {
      errors.push(`polities: ${path} is missing; run pnpm data`);
      return [];
    }
    return (JSON.parse(readFileSync(path, "utf8")) as { features: PolityFeature[] }).features;
  };
  const polities = { features: readFeatures(join(from, "polities.geojson")) };
  const polityLabels = { features: readFeatures(join(from, "polity-labels.geojson")) };
  // The ancient world's sites (content/ancient-sites*.json), read once.
  let sites: { id: string; lon: number; lat: number }[] | undefined;
  const ancientSites = () =>
    (sites ??= [
      ...AncientSitesFile.parse(load("content/ancient-sites.json")).sites,
      ...readdirSync(join(root, "content"))
        .filter((f) => /^ancient-sites-wave\d+\.json$/.test(f))
        .flatMap((f) => AncientWaveFile.parse(load(`content/${f}`)).sites),
    ]);
  // Cliopatria's coasts run up to 15 km inland: each shape is carried out to the shore
  // (scripts/polity-coast.ts), where no other state of those years holds the land between.
  {
    const water = new WaterGrid(
      readWater(join(out, "water.geojson")).map((w) => w.ring),
      [-30, -5, 90, 65],
      0.02,
    );
    const shown = polities.features
      .filter((f) => !f.properties.rel && f.properties.y0 < f.properties.y1)
      .map((f) => {
        const polys = polysOf(f.geometry as Geometry);
        const rings = polys.flat();
        const xs = rings.flatMap((r) => r.map(([x]) => x));
        const ys = rings.flatMap((r) => r.map(([, y]) => y));
        return {
          f,
          shape: { polys, y0: f.properties.y0, y1: f.properties.y1, name: f.properties.name },
          box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const,
        };
      });
    for (const me of shown) {
      const others = shown
        .filter(
          (o) =>
            o.shape.name !== me.shape.name &&
            o.shape.y0 < me.shape.y1 &&
            me.shape.y0 < o.shape.y1 &&
            o.box[0] <= me.box[2] + REACH &&
            me.box[0] <= o.box[2] + REACH &&
            o.box[1] <= me.box[3] + REACH &&
            me.box[1] <= o.box[3] + REACH,
        )
        .map((o) => o.shape);
      const reached = reachCoast(me.shape, others, water);
      if (reached) me.f.geometry = { type: "MultiPolygon", coordinates: reached };
    }
  }
  // Every shape made valid before any correction, as it is written (below).
  for (const f of polities.features) {
    if (f.properties.rel) continue;
    f.geometry = { type: "MultiPolygon", coordinates: tidy(polysOf(f.geometry as Geometry)) };
  }
  const overridesFile = PolityOverridesFile.parse(load("content/polity-overrides.yaml"));
  // A change of shape moved from Cliopatria's round year to the year it happened (overrides
  // `seams`): the shapes and labels beginning in that year begin in the new one, those
  // ending there end then. First, so that every later correction sees the years as moved.
  moveSeams([...polities.features, ...polityLabels.features], overridesFile.seams ?? [], errors);
  for (const o of overridesFile.overrides) {
    const own = polities.features.filter(
      (f) => f.properties.name === o.polity && !f.properties.rel,
    );
    if (own.length === 0) {
      errors.push(`polity-overrides: "${o.polity}" is not in the data build`);
      continue;
    }
    const end = Math.max(...own.map((f) => f.properties.y1));
    const until = o.last_year + 1; // half-open, ADR 0003
    if (until === end) {
      errors.push(`polity-overrides: "${o.polity}" already lasts to ${String(end - 1)}`);
      continue;
    }
    // Ended sooner than Cliopatria has it: its later shapes and labels are cut at the end
    // (a shape wholly after it gets an empty span, and is left out of the files).
    if (until < end) {
      for (const f of [...polities.features, ...polityLabels.features]) {
        if (f.properties.name !== o.polity || f.properties.y1 <= until) continue;
        f.properties.y1 = Math.max(f.properties.y0, until);
        f.properties.y0 = Math.min(f.properties.y0, f.properties.y1);
      }
      continue;
    }
    const extend = (f: PolityFeature): PolityFeature => ({
      ...f,
      properties: { ...f.properties, y0: end, y1: until, src: "override" },
    });
    polities.features.push(...own.filter((f) => f.properties.y1 === end).map(extend));
    polityLabels.features.push(
      ...polityLabels.features
        .filter((f) => f.properties.name === o.polity && f.properties.y1 === end)
        .map(extend),
    );
  }

  // Polities drawn from earlier than Cliopatria has them (overrides `starts`): their first
  // shape and labels copied back to the year given, marked as overrides.
  for (const o of overridesFile.starts ?? []) {
    const own = polities.features.filter(
      (f) => f.properties.name === o.polity && !f.properties.rel,
    );
    if (own.length === 0) {
      errors.push(`polity-overrides: start "${o.polity}" is not in the data build`);
      continue;
    }
    const start = Math.min(...own.map((f) => f.properties.y0));
    if (o.first_year === start) {
      errors.push(`polity-overrides: "${o.polity}" already starts in ${String(start)}`);
      continue;
    }
    // Started later than Cliopatria has it: its earlier shapes and labels are cut at the
    // start (a shape wholly before it gets an empty span, and is left out of the files).
    if (o.first_year > start) {
      for (const f of [...polities.features, ...polityLabels.features]) {
        if (f.properties.name !== o.polity || f.properties.y0 >= o.first_year) continue;
        f.properties.y0 = Math.min(o.first_year, f.properties.y1);
      }
      continue;
    }
    const back = (f: PolityFeature): PolityFeature => ({
      ...f,
      properties: { ...f.properties, y0: o.first_year, y1: start, src: "override" },
    });
    polities.features.push(...own.filter((f) => f.properties.y0 === start).map(back));
    polityLabels.features.push(
      ...polityLabels.features
        .filter((f) => f.properties.name === o.polity && f.properties.y0 === start)
        .map(back),
    );
  }

  // Shapes cut to where the polity was (overrides `clips`): each ring is clipped to a convex
  // polygon (Sutherland-Hodgman), a label outside it moves to the middle of what is left.
  const clipRing = (ring: Ring, clip: Ring): Ring => {
    // Inside = left of each clip edge for a counter-clockwise clip polygon.
    const ccw =
      clip.reduce((a, [x1, y1], i) => {
        const [x2, y2] = clip[(i + 1) % clip.length] ?? [0, 0];
        return a + (x2 - x1) * (y2 + y1);
      }, 0) < 0;
    const edges = ccw ? clip : [...clip].reverse();
    let out: Ring = ring;
    for (let i = 0; i < edges.length && out.length > 0; i++) {
      const [ax, ay] = edges[i] ?? [0, 0];
      const [bx, by] = edges[(i + 1) % edges.length] ?? [0, 0];
      // Within 0.002° of the edge counts as inside: a point on the edge, written at three
      // decimals, may fall just outside it.
      const len = Math.hypot(bx - ax, by - ay);
      const inside = ([x, y]: [number, number]) =>
        (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -0.002 * len;
      const cross = ([px, py]: [number, number], [qx, qy]: [number, number]): [number, number] => {
        const a1 = by - ay;
        const b1 = ax - bx;
        const c1 = a1 * ax + b1 * ay;
        const a2 = qy - py;
        const b2 = px - qx;
        const c2 = a2 * px + b2 * py;
        const det = a1 * b2 - a2 * b1;
        return det === 0 ? [px, py] : [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
      };
      const input = out;
      out = [];
      for (let j = 0; j < input.length; j++) {
        const cur = input[j] ?? [0, 0];
        const prev = input[(j + input.length - 1) % input.length] ?? [0, 0];
        if (inside(cur)) {
          if (!inside(prev)) out.push(cross(prev, cur));
          out.push(cur);
        } else if (inside(prev)) out.push(cross(prev, cur));
      }
    }
    return out;
  };
  // Clips for all years first: they cut the shapes themselves, and a clip for some years
  // then copies the shapes as cut. `k` stays the clip's place in the file.
  const clipsInOrder = [...(overridesFile.clips ?? []).entries()].sort(
    ([, x], [, y]) =>
      Number(x.first_year !== undefined || x.last_year !== undefined) -
      Number(y.first_year !== undefined || y.last_year !== undefined),
  );
  // The land each clip with years cut away, for the polity it went to (`to`) and for the
  // check that a clip leaves no land without a state unless it says so (below).
  const cutAways: {
    k: number;
    y0: number;
    y1: number;
    rings: Ring[];
  }[] = [];
  for (const [k, c] of clipsInOrder) {
    // A clip for some years only: the shapes and labels standing in them are copied for
    // those years (overrides) and only the copies are clipped; the originals keep their
    // geometry and give up those years.
    const a = c.first_year ?? -Infinity;
    const b = c.last_year === undefined ? Infinity : c.last_year + 1;
    const limited = Number.isFinite(a) || Number.isFinite(b);
    if (limited)
      for (const list of [polities.features, polityLabels.features])
        for (const f of list.filter(
          // Any shape of the polity standing in those years, a copy made by another
          // correction too (an extension, another clip's copy of overlapping years: the
          // Seljuk coast of 1072-1103 and Antioch in 1098), but not one this clip made.
          (g) =>
            g.properties.name === c.polity &&
            g.properties.clipped !== k &&
            g.properties.y0 < b &&
            a < g.properties.y1,
        )) {
          const p = f.properties;
          const { y0, y1 } = p;
          list.push({
            ...f,
            geometry: JSON.parse(JSON.stringify(f.geometry)) as unknown,
            properties: {
              ...p,
              y0: Math.max(y0, a),
              y1: Math.min(y1, b),
              src: "override",
              clipped: k,
            },
          });
          // Its own geometry: a label moved later must not move the original with it.
          if (b < y1)
            list.push({
              ...f,
              geometry: JSON.parse(JSON.stringify(f.geometry)) as unknown,
              properties: { ...p, y0: b, y1, src: "override" },
            });
          p.y1 = Math.max(y0, Math.min(y1, a));
        }
    const shapes = polities.features.filter(
      (f) => f.properties.name === c.polity && (!limited || f.properties.clipped === k),
    );
    if (shapes.length === 0)
      errors.push(`polity-overrides: clip "${c.polity}" is not in the data build`);
    for (const f of shapes) {
      const g = f.geometry as { type: string; coordinates: Ring[] | Ring[][] };
      const before = valid(g);
      if (c.within) {
        const clip = c.within;
        const polys = (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]) as Ring[][];
        const kept = polys
          .map((poly) => {
            // Open the ring, clip it, close it again.
            const outer = (poly[0] ?? []).slice(0, -1);
            const cut = clipRing(outer, clip);
            return cut.length >= 3 ? [[...cut, cut[0] ?? [0, 0]]] : null;
          })
          .filter((p): p is Ring[] => p !== null);
        f.geometry = { type: "MultiPolygon", coordinates: kept };
      } else if (c.without) {
        f.geometry = {
          type: "MultiPolygon",
          coordinates: booleanOp(before, [c.without], "difference"),
        };
      }
      // A clip for all years cuts Cliopatria's own shape in place, so a rerun no longer sees
      // what it took: only the clips with years are followed.
      if (limited) {
        const away = c.within
          ? booleanOp(before, [c.within], "difference")
          : booleanOp(before, [c.without ?? []], "intersection");
        cutAways.push({ k, y0: f.properties.y0, y1: f.properties.y1, rings: away.flat() });
      }
    }
    // Label size follows the area left, as pipeline/build_data.py sets it from the whole:
    // log10 of the shoelace area in square degrees, plus 2.
    // A label's own shape: of its years, and of its copy (another clip's years are another
    // copy, with another cut); the first that stands in its years otherwise.
    const ownShape = (f: (typeof polityLabels.features)[number]) => {
      const inYears = shapes.filter(
        (s) => s.properties.y0 <= f.properties.y0 && f.properties.y0 < s.properties.y1,
      );
      return inYears.find((s) => s.properties.clipped === f.properties.clipped) ?? inYears[0];
    };
    for (const f of polityLabels.features) {
      if (f.properties.name !== c.polity || (limited && f.properties.clipped !== k)) continue;
      const own = ownShape(f);
      const polys = (own?.geometry as { coordinates: Ring[][] } | undefined)?.coordinates ?? [];
      const total = polys.reduce((a, p) => a + ringArea(p[0] ?? []), 0);
      (f.properties as { size?: number }).size =
        Math.round((Math.log10(Math.max(total, 0.01)) + 2) * 100) / 100;
    }
    // A label off the cut shape of its years moves to the middle of it (the mean of its
    // outer ring's points), if that lands inside: ray casting, as the shape may be concave.
    for (const f of polityLabels.features) {
      if (f.properties.name !== c.polity || (limited && f.properties.clipped !== k)) continue;
      const at = f.geometry as { coordinates: [number, number] };
      const own = ownShape(f);
      const rings = ((own?.geometry as { coordinates: Ring[][] } | undefined)?.coordinates ?? [])
        .map((p) => p[0] ?? [])
        .filter((r) => r.length >= 4);
      // Its shape cut away whole (a raid's land given back): it names nothing.
      if (own && rings.length === 0) {
        f.properties.y1 = f.properties.y0;
        continue;
      }
      // Inside any of its pieces, it stays.
      if (rings.length === 0 || rings.some((r) => pointInRing(at.coordinates, r))) continue;
      // One of the grid of points an empire is named at up close (tier 1, 2): off the cut
      // shape it is not needed, and moved it would sit on the main one.
      if (((f.properties as { tier?: number }).tier ?? 0) > 0) {
        f.properties.y1 = f.properties.y0;
        continue;
      }
      // The main one goes to the middle of the largest piece.
      const ring = rings.reduce((a, r) => (ringArea(r) > ringArea(a) ? r : a));
      const pts = ring.slice(0, -1);
      const mid: [number, number] = [
        Math.round((pts.reduce((a, [x]) => a + x, 0) / pts.length) * 1000) / 1000,
        Math.round((pts.reduce((a, [, y]) => a + y, 0) / pts.length) * 1000) / 1000,
      ];
      if (pointInRing(mid, ring)) {
        at.coordinates = mid;
        continue;
      }
      // A concave piece whose mean falls outside: the middle of the widest stretch of it
      // along the mean's latitude.
      const xs = ring
        .slice(0, -1)
        .flatMap(([x0, y0], j) => {
          const [x1, y1] = ring[j + 1] ?? [x0, y0];
          return y0 > mid[1] !== y1 > mid[1] ? [x0 + ((mid[1] - y0) * (x1 - x0)) / (y1 - y0)] : [];
        })
        .sort((a, b) => a - b);
      let best: [number, number] | null = null;
      for (let j = 0; j + 1 < xs.length; j += 2) {
        const [x0 = 0, x1 = 0] = [xs[j], xs[j + 1]];
        if (!best || x1 - x0 > best[1] - best[0]) best = [x0, x1];
      }
      if (best) at.coordinates = [Math.round(((best[0] + best[1]) / 2) * 1000) / 1000, mid[1]];
    }
    // A shape cut away whole draws nothing in its years.
    for (const f of shapes)
      if (polysOf(f.geometry as Geometry).length === 0) f.properties.y1 = f.properties.y0;
  }

  // Land a polity held that its shape leaves out (overrides `extends`), and land a clip cut
  // away and gave to another (`to`): the outline is joined to every shape of the polity
  // standing in those years, as copies for those years (made again on every build).
  const clipsByIndex = overridesFile.clips ?? [];
  const extensions = [
    ...(overridesFile.extends ?? []).map((x) => ({
      polity: x.polity,
      a: x.first_year,
      b: x.last_year + 1, // half-open, ADR 0003
      add: [x.outline],
      what: `extends "${x.polity}"`,
      fromCut: false,
    })),
    ...cutAways.flatMap((w) => {
      const c = clipsByIndex[w.k];
      return c?.to && w.rings.length > 0
        ? [
            {
              polity: c.to,
              a: w.y0,
              b: w.y1,
              add: w.rings,
              what: `clip "${c.polity}" to "${c.to}"`,
              fromCut: c.drawn_from_cut === true,
            },
          ]
        : [];
    }),
  ];
  for (const x of extensions) {
    if (x.b <= x.a) continue;
    const own = polities.features.filter(
      (g) =>
        g.properties.name === x.polity &&
        !g.properties.rel &&
        g.properties.y0 < g.properties.y1 &&
        g.properties.y0 < x.b &&
        x.a < g.properties.y1,
    );
    // Land a clip gives to a state the data does not draw in those years (Syria to the
    // Ayyubids of Damascus, 1250-1259): the land itself is its shape, named at its middle,
    // in the colour and names of the state's shape nearest in time.
    const like = polities.features
      .filter((g) => g.properties.name === x.polity && !g.properties.rel)
      .sort(
        (g, h) =>
          Math.min(Math.abs(g.properties.y1 - x.a), Math.abs(g.properties.y0 - x.b)) -
          Math.min(Math.abs(h.properties.y1 - x.a), Math.abs(h.properties.y0 - x.b)),
      )[0];
    if (own.length === 0 && x.fromCut && like) {
      const made = drawnFromCut(like, x.a, x.b, x.add);
      if (made) {
        polities.features.push(made.shape);
        polityLabels.features.push(made.label);
      }
      continue;
    }
    if (own.length > 0 && x.fromCut) {
      errors.push(`polity-overrides: ${x.what}: drawn_from_cut, but it is on the map then`);
      continue;
    }
    if (own.length === 0) {
      errors.push(`polity-overrides: ${x.what}: not on the map in those years`);
      continue;
    }
    for (const f of own) {
      const p = f.properties;
      const { y0, y1 } = p;
      const copy = (from: number, to: number, geometry: unknown): PolityFeature => ({
        ...f,
        geometry,
        properties: { ...p, y0: from, y1: to, src: "override" },
      });
      const grown = booleanOp(valid(f.geometry as Geometry), x.add, "union");
      polities.features.push(
        copy(Math.max(y0, x.a), Math.min(y1, x.b), { type: "MultiPolygon", coordinates: grown }),
      );
      if (x.b < y1) polities.features.push(copy(x.b, y1, clone(f.geometry)));
      // The shape keeps its years before.
      p.y1 = Math.max(y0, Math.min(y1, x.a));
    }
  }

  // States Cliopatria does not draw (overrides `drawn`): our outline, less the land of the
  // polities in `minus`, one shape for each stretch of years in which those stand still.
  for (const d of overridesFile.drawn ?? []) {
    const a = d.first_year;
    const b = d.last_year + 1; // half-open, ADR 0003
    if (b <= a) {
      errors.push(`polity-overrides: drawn "${d.polity}" ends before it starts`);
      continue;
    }
    if (
      polities.features.some(
        (f) => f.properties.name === d.polity && f.properties.src !== "override",
      )
    )
      errors.push(
        `polity-overrides: drawn "${d.polity}" is a polity of the data: extend it instead`,
      );
    const minus = new Set(d.minus ?? []);
    const others = polities.features.filter(
      (f) =>
        minus.has(f.properties.name) &&
        !f.properties.rel &&
        f.properties.y0 < f.properties.y1 &&
        f.properties.y0 < b &&
        a < f.properties.y1,
    );
    const cuts = [...new Set([a, b, ...others.flatMap((f) => [f.properties.y0, f.properties.y1])])]
      .filter((y) => y >= a && y <= b)
      .sort((p, q) => p - q);
    let last: { y1: number; json: string; shape: PolityFeature; label: PolityFeature } | null =
      null;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const s = cuts[i] ?? a;
      const t = cuts[i + 1] ?? b;
      let shape: Ring[][] = [[closeRing(d.outline)]];
      for (const o of others)
        if (o.properties.y0 < t && s < o.properties.y1)
          shape = booleanOp(shape.flat(), valid(o.geometry as Geometry), "difference");
      if (shape.length === 0) {
        errors.push(
          `polity-overrides: drawn "${d.polity}" is covered by its neighbours in ${String(s)}`,
        );
        continue;
      }
      const json = JSON.stringify(shape);
      if (last && last.y1 === s && last.json === json) {
        last.y1 = t;
        last.shape.properties.y1 = t;
        last.label.properties.y1 = t;
        continue;
      }
      const props = { name: d.polity, y0: s, y1: t, rel: false, c: 0, src: "override" };
      const feature: PolityFeature = {
        geometry: { type: "MultiPolygon", coordinates: shape },
        properties: { ...props },
      };
      const total = shape.reduce((sum, poly) => sum + ringArea(poly[0] ?? []), 0);
      // Named at the point given, if this stretch's shape still holds it; else at the middle
      // of its largest part (the pins below move the small states' names into the open).
      const at = insideRings(d.label, shape.flat()) ? d.label : middleOf(shape);
      const label = {
        geometry: { type: "Point", coordinates: at },
        properties: {
          ...props,
          size: Math.round((Math.log10(Math.max(total, 0.01)) + 2) * 100) / 100,
          tier: 0,
          lead: 1,
        },
      } as PolityFeature;
      polities.features.push(feature);
      polityLabels.features.push(label);
      last = { y1: t, json, shape: feature, label };
    }
  }

  // Every shape drawn made valid, so that what ships is what the checks below pass: points
  // at three decimals as written (about 100 m), no point repeated, a ring that crosses
  // itself or another part (Cliopatria's own, or the bridges a clip leaves along its edge)
  // split at the crossings and joined again, specks and slivers dropped.
  for (const f of polities.features) {
    if (f.properties.rel || f.properties.y1 <= f.properties.y0) continue;
    f.geometry = { type: "MultiPolygon", coordinates: tidy(polysOf(f.geometry as Geometry)) };
  }

  // Colours: the pipeline gives each polity the next of ten in turn, so neighbours that
  // stood in the same years often shared one (Judah and the Neo-Babylonian Empire, Egypt
  // and Assyria in two greens). Recoloured here as a map is: polities are neighbours when
  // they coexist and their borders come within a cell (1°) of each other; the largest are
  // coloured first, each with a colour whose family of hue (style.ts: two greens, two
  // browns, two violets) no coloured neighbour has, else a colour none has, else the least
  // used. Deterministic, and done after the clips, which cut some shapes in place
  // (Assyria's without years).
  {
    // POLITY_COLORS as they look laid thin on the land: the greens and the teal read as one
    // grey-green, the plum, the violet and the red as one pink (design sweep).
    const FAMILY = [0, 1, 1, 3, 4, 5, 3, 1, 0, 3];
    // Neighbours shape by shape: two states are neighbours only if shapes of theirs stand in
    // the same years within a cell (1°) of each other, not if one's border of some century
    // came near the other's of another.
    type Shape = { name: string; y0: number; y1: number; cells: Set<string> };
    const shapes: Shape[] = [];
    const size = new Map<string, number>();
    for (const f of polities.features) {
      if (f.properties.rel || f.properties.y1 <= f.properties.y0) continue;
      const sh: Shape = {
        name: f.properties.name,
        y0: f.properties.y0,
        y1: f.properties.y1,
        cells: new Set(),
      };
      const g = f.geometry as { type: string; coordinates: unknown };
      const polys = (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]) as [
        number,
        number,
      ][][][];
      for (const poly of polys)
        for (const [x, y] of poly[0] ?? []) {
          sh.cells.add(`${String(Math.floor(x))}:${String(Math.floor(y))}`);
          size.set(sh.name, (size.get(sh.name) ?? 0) + 1);
        }
      shapes.push(sh);
    }
    const byCell = new Map<string, number[]>();
    shapes.forEach((sh, k) => {
      for (const cell of sh.cells) {
        const list = byCell.get(cell) ?? [];
        list.push(k);
        byCell.set(cell, list);
      }
    });
    const neighbours = new Map<string, Set<string>>();
    shapes.forEach((sh) => {
      const near = neighbours.get(sh.name) ?? new Set<string>();
      neighbours.set(sh.name, near);
      for (const cell of sh.cells) {
        const [cx, cy] = cell.split(":").map(Number) as [number, number];
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (const k of byCell.get(`${String(cx + dx)}:${String(cy + dy)}`) ?? []) {
              const other = shapes[k];
              if (other && other.name !== sh.name && sh.y0 < other.y1 && other.y0 < sh.y1)
                near.add(other.name);
            }
      }
    });
    const order = [...size.keys()].sort(
      (a, b) => (size.get(b) ?? 0) - (size.get(a) ?? 0) || a.localeCompare(b),
    );
    const colour = new Map<string, number>();
    for (const name of order) {
      const used = [...(neighbours.get(name) ?? [])]
        .map((o) => colour.get(o))
        .filter((c): c is number => c !== undefined);
      const families = new Set(used.map((c) => FAMILY[c]));
      const all = [...FAMILY.keys()];
      const pick =
        all.find((c) => !families.has(FAMILY[c])) ??
        all.find((c) => !used.includes(c)) ??
        all.sort(
          (a, b) => used.filter((u) => u === a).length - used.filter((u) => u === b).length,
        )[0] ??
        0;
      colour.set(name, pick);
    }
    for (const f of [...polities.features, ...polityLabels.features]) {
      const c = colour.get(f.properties.name);
      if (c !== undefined) (f.properties as VassalProps).c = c;
    }
  }

  // A new name from a year on (overrides `renamed`): a shape running across the year is
  // split, the copy after it (an override) takes the new name; the original keeps its years
  // before. The colours were given before, so a renamed shape keeps
  // its land's colour; its label is placed and pinned as any other.
  for (const x of overridesFile.renamed ?? []) {
    const a = x.first_year.year;
    let hit = false;
    // Renamed to a polity already on the map (Egypt as Kush's), the shape takes its colour;
    // to a new name, it keeps its land's.
    const known = polities.features.find(
      (g) => g.properties.name === x.name && !g.properties.rel && g.properties.src !== "override",
    ) as { properties: { c?: number } } | undefined;
    const colour = known?.properties.c === undefined ? {} : { c: known.properties.c };
    for (const list of [polities.features, polityLabels.features]) {
      for (const f of list.filter((g) => g.properties.name === x.polity && g.properties.y1 > a)) {
        hit = true;
        const p = f.properties;
        if (p.y0 >= a) {
          list.push({ ...f, properties: { ...p, ...colour, name: x.name, src: "override" } });
          p.y1 = p.y0; // an empty span: the renamed copy draws these years
        } else {
          list.push({
            ...f,
            properties: { ...p, ...colour, name: x.name, y0: a, src: "override" },
          });
          p.y1 = a;
        }
      }
    }
    if (!hit) errors.push(`polity-overrides: renamed "${x.polity}" is not on the map from then`);
  }

  // Years a polity did not exist (overrides `absent`): its shapes and labels are cut out of
  // them; a shape running past the gap keeps its own years before it and a copy, marked as
  // an override, takes the years after.
  for (const x of overridesFile.absent ?? []) {
    const a = x.first_year;
    const b = x.last_year + 1; // half-open, ADR 0003
    let hit = false;
    for (const list of [polities.features, polityLabels.features]) {
      for (const f of list.filter(
        (g) =>
          g.properties.name === x.polity &&
          !g.properties.rel &&
          g.properties.y0 < b &&
          a < g.properties.y1,
      )) {
        hit = true;
        const p = f.properties;
        const { y0, y1 } = p;
        if (b < y1) list.push({ ...f, properties: { ...p, y0: b, y1, src: "override" } });
        // Before the gap, or nothing (an empty span) when the shape starts inside it.
        p.y1 = Math.max(y0, Math.min(y1, a));
        p.y0 = Math.min(y0, p.y1);
      }
    }
    if (!hit)
      errors.push(`polity-overrides: absent "${x.polity}" is not on the map in those years`);
  }

  // Years the data leaves a polity off the map (overrides `bridges`): its shapes and labels
  // from just before are drawn on through them, as overrides.
  for (const x of overridesFile.bridges ?? []) {
    const a = x.first_year;
    const b = x.last_year + 1; // half-open, ADR 0003
    const own = polities.features.filter(
      (f) =>
        f.properties.name === x.polity &&
        !f.properties.rel &&
        f.properties.y1 <= a &&
        f.properties.y1 > f.properties.y0,
    );
    const end = Math.max(...own.map((f) => f.properties.y1));
    if (
      own.length === 0 ||
      polities.features.some(
        (f) =>
          f.properties.name === x.polity &&
          !f.properties.rel &&
          f.properties.y0 < b &&
          a < f.properties.y1 &&
          f.properties.y1 > f.properties.y0,
      )
    ) {
      errors.push(
        `polity-overrides: bridge "${x.polity}": nothing before, or already drawn in those years`,
      );
      continue;
    }
    const carry = (f: PolityFeature): PolityFeature => ({
      ...f,
      properties: { ...f.properties, y0: a, y1: b, src: "override" },
    });
    polities.features.push(...own.filter((f) => f.properties.y1 === end).map(carry));
    polityLabels.features.push(
      ...polityLabels.features
        .filter(
          (f) => f.properties.name === x.polity && f.properties.y1 === end && !f.properties.rel,
        )
        .map(carry),
    );
  }

  // Lands an empire took over (overrides `annexed`): the polity's last shape, drawn under
  // the empire's name and colour for those years, marked as an override.
  for (const x of overridesFile.annexed ?? []) {
    const a = x.first_year;
    const b = x.last_year + 1; // half-open, ADR 0003
    const last = polities.features
      .filter((f) => f.properties.name === x.polity && !f.properties.rel && f.properties.y1 <= a)
      .sort((f1, f2) => f2.properties.y1 - f1.properties.y1)[0];
    const by = polities.features.find(
      (f) =>
        f.properties.name === x.by &&
        !f.properties.rel &&
        f.properties.y0 < b &&
        a < f.properties.y1,
    );
    if (!last || !by || b <= a) {
      errors.push(
        `polity-overrides: annexed "${x.polity}" by "${x.by}": nothing to draw in those years`,
      );
      continue;
    }
    polities.features.push({
      ...last,
      properties: { ...by.properties, y0: a, y1: b, src: "override" },
    });
  }

  // Vassals (overrides `vassals`): in the years a polity paid tribute to an empire or ruled
  // as its client, its shapes take the overlord's colour (drawn lighter, style.ts) and its
  // label a second line, "under Assyria". A shape that runs past those years is split: the
  // shape itself keeps the vassal years, copies marked as overrides take the years before
  // and after.
  for (const v of overridesFile.vassals ?? []) {
    const a = v.first_year.year;
    const b = v.last_year.year + 1; // half-open, ADR 0003
    const overlaps = (f: PolityFeature) =>
      f.properties.name === v.polity &&
      !f.properties.rel &&
      f.properties.y0 < b &&
      a < f.properties.y1;
    const lord = polities.features.find(
      (f) =>
        f.properties.name === v.of &&
        !f.properties.rel &&
        f.properties.y0 < b &&
        a < f.properties.y1,
    ) as { properties: { c: number } } | undefined;
    if (!lord) {
      errors.push(
        `polity-overrides: vassal "${v.polity}": "${v.of}" is not on the map in those years`,
      );
      continue;
    }
    if (b <= a) {
      errors.push(`polity-overrides: vassal "${v.polity}" ends before it starts`);
      continue;
    }
    const own = [...polities.features, ...polityLabels.features].filter(overlaps);
    if (!own.some((f) => polities.features.includes(f))) {
      errors.push(`polity-overrides: vassal "${v.polity}" is not on the map in those years`);
      continue;
    }
    for (const list of [polities.features, polityLabels.features]) {
      for (const f of list.filter(overlaps)) {
        const p = f.properties as PolityFeature["properties"] & VassalProps;
        if (p.v !== undefined) {
          errors.push(`polity-overrides: vassal years of "${v.polity}" overlap`);
          continue;
        }
        const { y0, y1 } = p;
        const copy = (from: number, to: number): PolityFeature => ({
          ...f,
          properties: { ...p, y0: from, y1: to, src: "override" },
        });
        if (y0 < a) list.push(copy(y0, a));
        if (b < y1) list.push(copy(b, y1));
        p.y0 = Math.max(y0, a);
        p.y1 = Math.min(y1, b);
        p.c = lord.properties.c;
        p.v = v.label.en;
        // The second line in every language it is written in: v_ru, v_uk, …
        for (const [l, text] of Object.entries(v.label))
          if (l !== "en" && text) (p as Record<string, unknown>)[`v_${l}`] = text;
      }
    }
    // Where the overlord's own shape already covers the vassal in those years (Cliopatria
    // draws Judah inside Assyria in 700-628 BC), a second fill would make the vassal darker
    // than its empire: such a shape keeps its border and label and drops its fill (\`vin\`).
    const lordShapes = polities.features.filter(
      (f) =>
        f.properties.name === v.of &&
        !f.properties.rel &&
        f.properties.y0 < b &&
        a < f.properties.y1,
    );
    for (const f of polities.features.filter(overlaps)) {
      const ring = ((f.geometry as { coordinates: Ring[][] }).coordinates[0] ?? [])[0] ?? [];
      if (ring.length < 4) continue;
      const mid: [number, number] = [
        ring.reduce((t, [x]) => t + x, 0) / ring.length,
        ring.reduce((t, [, y]) => t + y, 0) / ring.length,
      ];
      const covered = lordShapes.some(
        (l) =>
          l.properties.y0 < f.properties.y1 &&
          f.properties.y0 < l.properties.y1 &&
          (l.geometry as { coordinates: Ring[][] }).coordinates.some((poly) =>
            pointInRing(mid, poly[0] ?? []),
          ),
      );
      if (covered) (f.properties as VassalProps & { vin?: boolean }).vin = true;
    }
  }

  // A polity of many parts (the Greek city-states, Phoenicia) had a centre label on each:
  // seven "Greek city-states" at a region's view. One per shape and years keeps tier 0;
  // the others become tier 2, shown from zoom 6 (style.ts), where they no longer crowd.
  // The same pass picks the one lead point (build_data.py lead_anchor) that names the state
  // at a continent's view: the kept centre label where there is one. Each part brought its
  // own lead, and a demoted lead left the state unnamed far out (the Roman Empire, Venice).
  {
    type Label = { properties: PolityFeature["properties"] & { tier?: number; lead?: number } };
    const groups = new Map<string, Label[]>();
    for (const f of polityLabels.features as Label[]) {
      // A label left with no years by a correction must not take the place of the one drawn.
      if (f.properties.rel || f.properties.y1 <= f.properties.y0) continue;
      const key = `${f.properties.name}|${String(f.properties.y0)}`;
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    for (const group of groups.values()) {
      const centres = group.filter((f) => f.properties.tier === 0);
      const keep = centres.find((f) => f.properties.lead) ?? centres[0];
      for (const f of centres) if (f !== keep) f.properties.tier = 2;
      const lead =
        keep ??
        group.find((f) => f.properties.lead && (f.properties.tier ?? 0) < 2) ??
        group.find((f) => (f.properties.tier ?? 0) < 2) ??
        group[0];
      for (const f of group) {
        if (f === lead) f.properties.lead = 1;
        else delete f.properties.lead;
      }
    }
  }

  // Small states among the Bible's places (Judah, Israel, Philistia): their label point,
  // the middle of the shape, fell among the towns of the hills, whose names always win
  // (style.ts places them first), so at a region's view the kingdoms went unnamed. Their
  // label moves to the point of the shape farthest from any place named by zoom 6 (rank 2
  // or less), at least 0.12° inside the border. Deterministic: a build keeps the point.
  // A state whose shape takes in conquered land keeps its label near its own heartland:
  // Hasmonean and Herodian Judea in Cliopatria includes Idumea and the Negev, and the
  // emptiest point of that shape lay in the Negev, far south of Judea proper (the hill
  // country of Jerusalem and Hebron). Its label is searched within 0.3° of Jerusalem.
  const HEARTLAND: Record<string, { at: [number, number]; radius: number }> = {
    Judea: { at: [35.21, 31.72], radius: 0.3 },
  };
  {
    const LEVANT = { w: 33.5, s: 28.5, e: 38, n: 35 };
    const cos = Math.cos((32 * Math.PI) / 180);
    const marks = places.features
      .filter((f) => f.properties.rank <= 2)
      .map((f) => f.geometry.coordinates as [number, number]);
    const near = ([x, y]: [number, number]) =>
      Math.min(...marks.map(([mx, my]) => Math.hypot((mx - x) * cos, my - y)));
    const toEdge = ([x, y]: [number, number], ring: Ring) => {
      let best = Infinity;
      for (let k = 0; k + 1 < ring.length; k++) {
        const [ax, ay] = ring[k] ?? [0, 0];
        const [bx, by] = ring[k + 1] ?? [0, 0];
        const dx = (bx - ax) * cos;
        const dy = by - ay;
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, ((x - ax) * cos * dx + (y - ay) * dy) / len)) : 0;
        best = Math.min(best, Math.hypot((x - ax) * cos - t * dx, y - ay - t * dy));
      }
      return best;
    };
    // Never on water: the shapes run over the Dead Sea and the coast, and a label there
    // reads as the sea's name. The outer rings of water.geojson, cut to the Levant.
    const waterPath = join(out, "water.geojson");
    const water: Ring[] = existsSync(waterPath)
      ? (
          JSON.parse(readFileSync(waterPath, "utf8")) as {
            features: { geometry: { type: string; coordinates: unknown } }[];
          }
        ).features
          .flatMap(({ geometry: g }) =>
            g.type === "Polygon"
              ? [(g.coordinates as Ring[])[0] ?? []]
              : (g.coordinates as Ring[][]).map((poly) => poly[0] ?? []),
          )
          .filter((r) =>
            r.some(([x, y]) => x > LEVANT.w && x < LEVANT.e && y > LEVANT.s && y < LEVANT.n),
          )
      : [];
    const boxes = water.map((r) => {
      const xs = r.map(([x]) => x);
      const ys = r.map(([, y]) => y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
    });
    const onWater = (c: [number, number]) =>
      water.some((r, k) => {
        const [w, s, e, n] = boxes[k] ?? [0, 0, 0, 0];
        return c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n && pointInRing(c, r);
      });
    for (const f of polityLabels.features as {
      geometry: { coordinates: [number, number] };
      properties: PolityFeature["properties"] & { tier?: number; size?: number };
    }[]) {
      const at = f.geometry.coordinates;
      const p = f.properties;
      // Pinned afresh on every build.
      delete (p as { pin?: boolean }).pin;
      if (p.rel || (p.tier ?? 0) !== 0 || (p.size ?? 9) > 2.6) continue;
      if (at[0] < LEVANT.w || at[0] > LEVANT.e || at[1] < LEVANT.s || at[1] > LEVANT.n) continue;
      const shape = polities.features.find(
        (s) =>
          s.properties.name === p.name &&
          !s.properties.rel &&
          s.properties.y0 <= p.y0 &&
          p.y0 < s.properties.y1,
      );
      const polys = (shape?.geometry as { coordinates: Ring[][] } | undefined)?.coordinates ?? [];
      // The largest part by area: where the label belongs; and its middle, which the label
      // stays near (within 0.5°), so a kingdom is not named in an empty corner of it.
      const parts = polys.map((poly) => {
        const r = poly[0] ?? [];
        let a2 = 0;
        let cx = 0;
        let cy = 0;
        for (let k = 0; k + 1 < r.length; k++) {
          const [x0, y0] = r[k] ?? [0, 0];
          const [x1, y1] = r[k + 1] ?? [0, 0];
          const c = x0 * y1 - x1 * y0;
          a2 += c;
          cx += (x0 + x1) * c;
          cy += (y0 + y1) * c;
        }
        return {
          ring: r,
          area: Math.abs(a2) / 2,
          mid: [cx / (3 * a2), cy / (3 * a2)] as [number, number],
        };
      });
      const part = parts.sort((p1, p2) => p2.area - p1.area)[0];
      if (!part || part.ring.length < 4 || !Number.isFinite(part.mid[0])) continue;
      const { ring } = part;
      const home = HEARTLAND[p.name];
      const mid = home?.at ?? part.mid;
      const xs = ring.map(([x]) => x);
      const ys = ring.map(([, y]) => y);
      const RADIUS = home?.radius ?? 0.5;
      let best: [number, number] | null = null;
      let score = -1;
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.04)
        for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.04) {
          const c: [number, number] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
          if (Math.hypot((c[0] - mid[0]) * cos, c[1] - mid[1]) > RADIUS) continue;
          if (!pointInRing(c, ring) || toEdge(c, ring) < 0.12) continue;
          const d = near(c);
          // The water test is the costly one: only for a point that would win.
          if (d > score + 1e-9 && !onWater(c)) {
            score = d;
            best = c;
          }
        }
      // No room inside (a sliver of a shape): the label stays where the pipeline put it.
      if (!best) continue;
      f.geometry.coordinates = best;
      (p as { pin?: boolean }).pin = true;
    }
  }

  // Shapes and labels a correction left with no years (cut out, or a copy renamed twice in
  // a swap) draw nothing: they are left out.
  polities.features = polities.features.filter((f) => f.properties.y1 > f.properties.y0);
  polityLabels.features = polityLabels.features.filter((f) => f.properties.y1 > f.properties.y0);

  checkPolities({
    shapes: polities.features as ShipFeature[],
    clips: (overridesFile.clips ?? []).map((c) => ({
      name: c.polity,
      to: c.to,
      blank: c.leaves_blank === true,
    })),
    cutAways,
    water: readWater(join(out, "water.geojson")),
    // Required: a missing file would pass every anchor unseen.
    anchors: PolityAnchorsFile.parse(load("content/polity-anchors.yaml")).anchors,
    pointOf: (id) => {
      const place = (
        places.features as { geometry: { coordinates: number[] }; properties: { id?: string } }[]
      ).find((f) => f.properties.id === id);
      if (place) return place.geometry.coordinates as [number, number];
      const site = ancientSites().find((a) => a.id === id);
      return site ? [site.lon, site.lat] : undefined;
    },
    drawn: new Set((overridesFile.drawn ?? []).map((d) => d.polity)),
    errors,
  });

  // Polity labels get their Russian name; every label on the map must have one.
  const polityNames = PolityNamesFile.parse(load("content/polity-names.yaml")).polities;
  const labels = polityLabels as { features: { properties: { name: string; name_ru?: string } }[] };
  const missing = new Set<string>();
  for (const f of labels.features) {
    const ru = polityNames[f.properties.name];
    if (ru) f.properties.name_ru = ru;
    else missing.add(f.properties.name);
  }
  for (const name of missing) errors.push(`polity-names: no Russian name for "${name}"`);
  // The other languages' names (content/names-<code>.yaml): every label needs one too.
  for (const [l, file] of Object.entries(namesIn)) {
    const lost = new Set<string>();
    for (const f of labels.features) {
      const n = file.polities[f.properties.name];
      if (n) (f.properties as Record<string, string>)[`name_${l}`] = n;
      else lost.add(f.properties.name);
    }
    for (const name of lost) errors.push(`names-${l}: no name for the state "${name}"`);
    for (const f of polities.features as {
      properties: Record<string, unknown> & { name: string };
    }[]) {
      const n = file.polities[f.properties.name];
      if (n) f.properties[`name_${l}`] = n;
    }
  }
  // The shapes carry the name too: the map names a territory under the pointer.
  for (const f of polities.features as { properties: { name: string; name_ru?: string } }[]) {
    const ru = polityNames[f.properties.name];
    if (ru) f.properties.name_ru = ru;
  }
  const early = <T extends { properties: { y0?: number } }>(fs: T[]) =>
    fs.filter((f) => (f.properties.y0 ?? 0) <= POLITY_SPLIT_YEAR);
  // The order the map draws them in: Cliopatria's shapes, the first frame's before the later
  // ones, then the copies our corrections made, over them.
  const inDrawingOrder = <T extends { properties: { y0?: number; src?: string } }>(fs: T[]) => {
    const own = fs.filter((f) => f.properties.src !== "override");
    return [
      ...early(own),
      ...own.filter((f) => (f.properties.y0 ?? 0) > POLITY_SPLIT_YEAR),
      ...fs.filter((f) => f.properties.src === "override"),
    ];
  };
  polities.features = inDrawingOrder(polities.features);
  polityLabels.features = inDrawingOrder(polityLabels.features);
  // Three decimals (about 100 m) for borders drawn at a region's zoom: the float noise some
  // points carried ("31.593257904052734") was 16% of the first frame's states. The build's
  // own marks (`clipped`) stay out.
  const fc = (features: unknown[]) =>
    JSON.stringify({ type: "FeatureCollection", features }, (k, v: unknown) =>
      k === "clipped"
        ? undefined
        : typeof v === "number" && !Number.isInteger(v)
          ? Math.round(v * 1000) / 1000
          : v,
    );
  writes.push([join(out, "polities.geojson"), fc(early(polities.features))]);
  // Each field the files carry is described for their readers (docs/data-release.md).
  const fields = (fs: { properties: object }[]) =>
    fs.flatMap((f) => Object.keys(f.properties)).filter((k) => k !== "clipped");
  errors.push(
    ...undocumented("polities.geojson", fields(polities.features)),
    ...undocumented("polity-labels.geojson", fields(polityLabels.features)),
  );
  const all = fc(polities.features);
  writes.push([join(out, "polities-all.geojson"), all]);
  writes.push([join(out, "polity-labels.geojson"), fc(early(labels.features as PolityFeature[]))]);
  writes.push([join(out, "polity-labels-all.geojson"), fc(labels.features)]);

  // Who ruled each place, century by century, for the card's timeline (scripts/rulers.ts):
  // the ancient world's places too, which the card opens as any other.
  const ancient = ancientSites().map((a) => ({
    geometry: { coordinates: [a.lon, a.lat] },
    properties: { id: a.id },
  }));
  // Read from the shapes as written, at three decimals: a place a few metres from a border
  // falls on the side the map draws it.
  const written = (JSON.parse(all) as { features: typeof polities.features }).features;
  const { states, rulers } = rulersOf(written, [...places.features, ...ancient]);
  writes.push([join(out, "rulers.json"), JSON.stringify({ states, places: rulers })]);
}

type ShipFeature = {
  geometry: Geometry;
  properties: { name: string; y0: number; y1: number; rel?: boolean; v?: string };
};

/** The outer rings of water.geojson with their boxes: the sea and the lakes. */
function readWater(path: string): { ring: Ring; box: [number, number, number, number] }[] {
  if (!existsSync(path)) return [];
  const features = (
    JSON.parse(readFileSync(path, "utf8")) as { features: { geometry: Geometry }[] }
  ).features;
  return features
    .flatMap(({ geometry }) => polysOf(geometry).map((poly) => poly[0] ?? []))
    .map((ring) => {
      const xs = ring.map(([x]) => x);
      const ys = ring.map(([, y]) => y);
      return {
        ring,
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [
          number,
          number,
          number,
          number,
        ],
      };
    });
}

const yearText = (y: number) => (y <= 0 ? `${String(1 - y)} BC` : `AD ${String(y)}`);
const spanText = (a: number, b: number) =>
  a === b ? yearText(a) : `${yearText(a)}-${yearText(b)}`;

/** Runs of consecutive years, as "900-851 BC, 800 BC". */
function runs(years: number[]): string {
  const out: string[] = [];
  let start: number | undefined;
  let prev: number | undefined;
  for (const y of [...years, Infinity]) {
    if (start !== undefined && prev !== undefined && y !== prev + 1) {
      out.push(spanText(start, prev));
      start = undefined;
    }
    start ??= y;
    prev = y;
  }
  return out.join(", ");
}

/**
 * The checks on the states as they ship (docs/data-checks.md):
 * - every shape is valid: no ring crosses itself or another, no point repeated, no specks
 *   or slivers (`tidy` makes them so; this catches a step that undoes it);
 * - a clip with years that cuts away land no other state covers says so (`leaves_blank`)
 *   or gives the land to the state that took it (`to`): more than half of the land it took
 *   left blank fails;
 * - a state drawn by us covers no state it does not cut itself out of (`minus`), save as a
 *   vassal over its overlord;
 * - the anchors (content/polity-anchors.yaml): the state named for each of a place's
 *   periods is the one its card names (the smallest holding it), some state holds it in
 *   the years between, or the years are listed as a gap with the reason.
 */
export function checkPolities({
  shapes,
  clips,
  cutAways,
  water,
  anchors,
  pointOf,
  drawn,
  errors,
}: {
  shapes: ShipFeature[];
  clips: { name: string; to?: string | undefined; blank: boolean }[];
  cutAways: { k: number; y0: number; y1: number; rings: Ring[] }[];
  water: { ring: Ring; box: [number, number, number, number] }[];
  anchors: {
    name: string;
    place?: string | undefined;
    at?: [number, number] | undefined;
    periods: { first_year: number; last_year: number; polity: string }[];
    blank?: { first_year: number; last_year: number; reason: string }[] | undefined;
  }[];
  pointOf: (id: string) => [number, number] | undefined;
  drawn: ReadonlySet<string>;
  errors: string[];
}): void {
  const shown = shapes
    .filter((f) => !f.properties.rel && f.properties.y0 < f.properties.y1)
    .map((f) => {
      const rings = polysOf(f.geometry).flat();
      const xs = rings.flatMap((r) => r.map(([x]) => x));
      const ys = rings.flatMap((r) => r.map(([, y]) => y));
      return {
        f,
        rings,
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const,
        // Measured as the card measures it (scripts/rulers.ts).
        area: shapeOf(f.geometry).area,
      };
    });
  const holding = (p: [number, number]) =>
    shown.filter(
      ({ rings, box }) =>
        p[0] >= box[0] &&
        p[0] <= box[2] &&
        p[1] >= box[1] &&
        p[1] <= box[3] &&
        insideRings(p, rings),
    );
  const onLand = (p: [number, number]) =>
    !water.some(
      ({ ring, box }) =>
        p[0] >= box[0] &&
        p[0] <= box[2] &&
        p[1] >= box[1] &&
        p[1] <= box[3] &&
        pointInRing(p, ring),
    );

  // Valid shapes.
  const bad = new Map<string, string[]>();
  for (const { f } of shown) {
    const polys = polysOf(f.geometry);
    const what: string[] = [];
    if (
      polys.some((poly) =>
        poly.some((r) =>
          r.some((p, i) => i > 0 && p[0] === r[i - 1]?.[0] && p[1] === r[i - 1]?.[1]),
        ),
      )
    )
      what.push("a repeated point");
    if (polys.some((poly) => poly.some((r) => isSliver(r)))) what.push("a sliver");
    const x = selfCrossings(polys.flat())[0];
    if (x) what.push(`a crossing at ${x[0].toFixed(3)},${x[1].toFixed(3)}`);
    if (what.length === 0) continue;
    const key = `${f.properties.name}: ${what.join(", ")}`;
    bad.set(key, [...(bad.get(key) ?? []), spanText(f.properties.y0, f.properties.y1 - 1)]);
  }
  for (const [key, years] of bad) errors.push(`polities: ${key} (${years.join("; ")})`);

  // Clips that leave land blank.
  const sample = (rings: Ring[]): [number, number][] => {
    const xs = rings.flatMap((r) => r.map(([x]) => x));
    const ys = rings.flatMap((r) => r.map(([, y]) => y));
    if (xs.length === 0) return [];
    const [w, s, e, n] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const step = Math.max((e - w) / 24, (n - s) / 24, 0.02);
    const out: [number, number][] = [];
    for (let x = w + step / 2; x < e; x += step)
      for (let y = s + step / 2; y < n; y += step) {
        const p: [number, number] = [x, y];
        if (insideRings(p, rings) && onLand(p)) out.push(p);
      }
    return out;
  };
  const tally = new Map<number, { blank: number; all: number; years: number[] }>();
  for (const w of cutAways) {
    const c = clips[w.k];
    if (!c || c.to || c.blank) continue;
    const year = w.y0;
    const t = tally.get(w.k) ?? { blank: 0, all: 0, years: [] };
    for (const p of sample(w.rings)) {
      t.all++;
      if (!holding(p).some(({ f }) => f.properties.y0 <= year && year < f.properties.y1)) t.blank++;
    }
    t.years.push(year);
    tally.set(w.k, t);
  }
  for (const [k, t] of tally)
    if (t.all > 0 && t.blank / t.all > 0.5)
      errors.push(
        `polity-overrides: clip ${String(k + 1)} of "${clips[k]?.name ?? ""}" leaves ${String(Math.round((100 * t.blank) / t.all))}% of the land it cuts away without a state (${runs([...new Set(t.years)].sort((a, b) => a - b))}): give it \`to\` the state that took it or say \`leaves_blank\``,
      );

  // States we draw cover no other, save as a vassal over its overlord.
  for (const { f, rings } of shown) {
    if (!drawn.has(f.properties.name) || f.properties.v !== undefined) continue;
    const year = f.properties.y0;
    const pts = sample(rings);
    const over = new Map<string, number>();
    for (const p of pts)
      for (const { f: g } of holding(p))
        if (
          g.properties.name !== f.properties.name &&
          g.properties.y0 <= year &&
          year < g.properties.y1
        )
          over.set(g.properties.name, (over.get(g.properties.name) ?? 0) + 1);
    for (const [name, n] of over)
      if (n / pts.length > 0.05)
        errors.push(
          `polity-overrides: drawn "${f.properties.name}" covers ${String(Math.round((100 * n) / pts.length))}% of its land under "${name}" in ${yearText(year)}: add it to \`minus\` or make it a vassal`,
        );
  }

  // Anchors.
  for (const a of anchors) {
    const p = a.at ?? (a.place ? pointOf(a.place) : undefined);
    if (!p) {
      errors.push(`polity-anchors: ${a.name}: no point (place "${a.place ?? ""}" not found)`);
      continue;
    }
    const mine = holding(p);
    const all = [...a.periods, ...(a.blank ?? [])];
    const from = Math.min(...all.map((x) => x.first_year));
    const to = Math.max(...all.map((x) => x.last_year));
    const wrong = new Map<string, number[]>();
    for (let y = from; y <= to; y++) {
      if ((a.blank ?? []).some((g) => g.first_year <= y && y <= g.last_year)) continue;
      const want = a.periods
        .filter((x) => x.first_year <= y && y <= x.last_year)
        .map((x) => x.polity);
      // The state the place's card names in that year: of those holding it, the smallest,
      // as scripts/rulers.ts picks it (a raid drawn over a town is caught, not passed).
      const have = mine
        .filter(({ f }) => f.properties.y0 <= y && y < f.properties.y1)
        .sort((u, v) => u.area - v.area)
        .map(({ f }) => f.properties.name);
      const ok =
        want.length === 0 || want.includes("any")
          ? have.length > 0
          : have[0] !== undefined && want.includes(have[0]);
      if (ok) continue;
      const key = `in ${have.length > 0 ? [...new Set(have)].join(" within ") : "no state"}, not ${want.length > 0 ? want.join(" or ") : "any state"}`;
      wrong.set(key, [...(wrong.get(key) ?? []), y]);
    }
    for (const [key, years] of wrong)
      errors.push(`polity-anchors: ${a.name} ${runs(years)}: ${key}`);
  }
}
