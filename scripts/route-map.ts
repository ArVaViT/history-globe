/**
 * A route drawn as a small static map, an SVG with no words in it, so one file serves every
 * language (build-pages.ts writes it once per tour, data/tour-maps/<id>.svg, and the pages
 * link it as an image): the sea from water.geojson, the states of the year from
 * polities.geojson (Cliopatria, as the map draws them), the way through the stops (along the
 * Roman roads where road-paths.json has one; at sea dashed and blue, through the points a
 * voyage keeps to; dotted and grey where the text does not trace it) and the stops' numbers.
 * Its colours are its own, for the reader's light or dark scheme (an image does not read the
 * page's stylesheet), in an inner <style> the pages' CSP allows (style-src 'unsafe-inline').
 *
 * Reusable for any set of points with an order: build-pages.ts draws each tour with it.
 * Pure: the layers are passed in, so a page without `pnpm data` draws the way alone.
 */
import { pointInRing, type Ring } from "./geo.ts";

export type LonLat = readonly [number, number];

/** The sea and the states, as read once from the data build. */
export interface MapLayers {
  /** Water polygons, each a list of rings (outer first), in [lon, lat]. */
  readonly water: readonly (readonly Ring[])[];
  readonly polities: readonly MapPolity[];
}

export interface MapPolity {
  /** Polygons, each a list of rings (outer first). */
  readonly polygons: readonly (readonly Ring[])[];
  /** Shown when y0 ≤ year < y1 (ADR 0003, as the map's ERA_FILTER). */
  readonly y0: number;
  readonly y1: number;
  /** The colour index of the data build (POLITY_COLORS). */
  readonly c: number;
  /** The record's properties, for its name in a language (name, name_ru, …). */
  readonly names: Readonly<Record<string, string | undefined>>;
}

export interface RouteStop {
  readonly at: LonLat;
  /** The place's id: a place stopped at twice is one marker; two places are never merged. */
  readonly id?: string | undefined;
  /** How the leg to this stop went: sailed, or not traced by the text. */
  readonly by?: "sea" | "untold" | undefined;
  /** The way along the roads from the stop before, where there is one. */
  readonly road?: readonly LonLat[] | undefined;
  /** The points at sea a voyage keeps to on its way here (a tour stop's `via`). */
  readonly via?: readonly LonLat[] | undefined;
  /** The year at this stop where it is not the map's (a tour stop's own `year`). */
  readonly year?: number | undefined;
}

/** The kinds of leg drawn: on foot (solid), by sea (dashed), not traced (dotted). */
export interface LegKinds {
  readonly foot: boolean;
  readonly sea: boolean;
  readonly untold: boolean;
}

export interface RouteMap {
  readonly svg: string;
  /**
   * The states to name: each a stop lies in (in its own year, in the stops' order), then
   * the others a fair part of the frame shows, largest first (their name records).
   */
  readonly states: readonly Readonly<Record<string, string | undefined>>[];
  /** How many of `states`, from the first, are states a stop lies in. */
  readonly touched: number;
  /** The kinds of leg the map draws, for its legend. */
  readonly kinds: LegKinds;
}

const W = 800;
const H = 500;
/** States smaller than this share of the frame are not named in the caption. */
const NAMED_SHARE = 0.015;

type Pt = [number, number];

/** Sutherland–Hodgman: a ring cut to the frame (a little beyond it, so no edge shows). */
function clipRing(ring: readonly Pt[], x0: number, y0: number, x1: number, y1: number): Pt[] {
  let out: Pt[] = [...ring];
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i] as Pt;
      const prev = input[(i + input.length - 1) % input.length] as Pt;
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (out.length === 0) break;
  }
  return out;
}

/** Points closer than a pixel and a bit to the last one kept are dropped. */
function thin(ring: readonly Pt[], tol = 1.4): Pt[] {
  const out: Pt[] = [];
  for (const p of ring) {
    const q = out.at(-1);
    if (!q || Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) >= tol) out.push(p);
  }
  return out;
}

const area = (ring: readonly Pt[]) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as Pt;
    const q = ring[(i + 1) % ring.length] as Pt;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

const num = (x: number) => String(Math.round(x));
const pathOf = (rings: readonly Pt[][]) =>
  rings.map((r) => `M${r.map((p) => `${num(p[0])} ${num(p[1])}`).join("L")}Z`).join("");

/**
 * The frame around the stops: an equirectangular plane with longitude scaled at the middle
 * latitude, the stops inside a margin, never closer than about 1.2° across (a walk in one
 * city does not shrink to a blot), at the drawing's proportions.
 */
export function frameOf(points: readonly LonLat[]): (p: LonLat) => Pt {
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const [lo0, lo1, la0, la1] = [
    Math.min(...lons),
    Math.max(...lons),
    Math.min(...lats),
    Math.max(...lats),
  ];
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  let spanX = Math.max((lo1 - lo0) * k, 1.2) * 1.3;
  let spanY = Math.max(la1 - la0, 0.75) * 1.3;
  if (spanX / spanY > W / H) spanY = (spanX * H) / W;
  else spanX = (spanY * W) / H;
  const cx = ((lo0 + lo1) / 2) * k;
  const cy = (la0 + la1) / 2;
  return (p) => [((p[0] * k - cx) / spanX + 0.5) * W, (0.5 - (p[1] - cy) / spanY) * H];
}

/** Whether a point lies in a polygon: inside its outer ring and in none of its holes. */
const inPolygon = (p: LonLat, rings: readonly Ring[]): boolean =>
  rings.length > 0 &&
  pointInRing([p[0], p[1]], rings[0] as Ring) &&
  rings.slice(1).every((hole) => !pointInRing([p[0], p[1]], hole));

/**
 * The drawing's own colours, light and dark (pages.css's paper and accent): an image does
 * not read the page's stylesheet. The way on foot is solid in the accent, at sea dashed in
 * the sea's blue, untold dotted in grey; the states are the map's colours (POLITY_COLORS).
 */
const STYLE = `.l{fill:#ece6d8}.w{fill:#d9e3e8}.s{fill-opacity:.2;stroke:rgb(31 26 19/.22);stroke-width:1}.c0{fill:#b5652f}.c1{fill:#6f8a3a}.c2{fill:#3b7c88}.c3{fill:#8d4f7b}.c4{fill:#a8862f}.c5{fill:#5a6fa8}.c6{fill:#9c3d3d}.c7{fill:#4f8a5b}.c8{fill:#b07a52}.c9{fill:#6d5a9c}.f,.e,.u{fill:none;stroke-linecap:round;stroke-linejoin:round}.f{stroke:#9a3b1f;stroke-width:3}.e{stroke:#2c6b94;stroke-width:2.5;stroke-dasharray:9 6;stroke-linecap:butt}.u{stroke:#7b7366;stroke-width:2;stroke-dasharray:.1 6}.k{stroke:#9a3b1f;stroke-width:1.5}.d{fill:#9a3b1f}.m rect{fill:#9a3b1f;stroke:#fcfbf8;stroke-width:2}.m text{fill:#fff;font:600 15px system-ui,-apple-system,"Segoe UI",sans-serif;text-anchor:middle}@media (prefers-color-scheme:dark){.l{fill:#1d2732}.w{fill:#0f171f}.s{fill-opacity:.28;stroke:rgb(236 230 218/.2)}.f{stroke:#ec9a72}.e{stroke:#7fb6dc}.u{stroke:#9aa3ad}.k{stroke:#ec9a72}.d{fill:#ec9a72}.m rect{fill:#ec9a72;stroke:#0c1218}.m text{fill:#1b140c}}`;

/** The map of a route: its stops in order, the layers when the data build is there. */
export function routeMap(o: {
  readonly stops: readonly RouteStop[];
  readonly year: number;
  /** False when the stops are not a way travelled (the letters' readers): no line drawn. */
  readonly walked: boolean;
  readonly layers?: MapLayers | undefined;
}): RouteMap | null {
  if (o.stops.length === 0) return null;
  // The frame holds the points at sea too, so a voyage round a cape is not cut off.
  const at = frameOf(
    o.stops.flatMap((s) => [s.at, ...(o.walked && s.by === "sea" ? (s.via ?? []) : [])]),
  );
  const M = 4;
  const shapes = (polygons: readonly (readonly Ring[])[]) => {
    const rings: Pt[][] = [];
    let a = 0;
    for (const poly of polygons)
      for (const ring of poly) {
        const px = ring.map((p) => at(p));
        // Off the frame altogether: not worth cutting.
        if (
          px.every((p) => p[0] < -M) ||
          px.every((p) => p[0] > W + M) ||
          px.every((p) => p[1] < -M) ||
          px.every((p) => p[1] > H + M)
        )
          continue;
        const cut = thin(clipRing(px, -M, -M, W + M, H + M));
        if (cut.length < 3 || area(cut) < 3) continue;
        rings.push(cut);
        a += area(cut);
      }
    return { rings, area: a };
  };
  const water = o.layers ? shapes(o.layers.water) : { rings: [], area: 0 };
  const states = (o.layers?.polities ?? [])
    .filter((p) => p.y0 <= o.year && o.year < p.y1)
    .map((p) => ({ p, ...shapes(p.polygons) }))
    .filter((s) => s.rings.length > 0)
    .sort((a, b) => b.area - a.area);
  // Named in the caption: every state a stop lies in, in its own year (a stop dated apart
  // from the tour), then those a fair part of the frame shows.
  const touched = new Set<MapPolity>();
  for (const s of o.stops) {
    const year = s.year ?? o.year;
    for (const p of o.layers?.polities ?? [])
      if (p.y0 <= year && year < p.y1 && p.polygons.some((poly) => inPolygon(s.at, poly)))
        touched.add(p);
  }
  const named = [
    ...touched,
    ...states.filter((s) => s.area >= NAMED_SHARE * W * H && !touched.has(s.p)).map((s) => s.p),
  ].map((p) => p.names);

  const pts = o.stops.map((s) => at(s.at));
  const legs = { land: [] as string[], sea: [] as string[], untold: [] as string[] };
  if (o.walked)
    for (let i = 1; i < o.stops.length; i++) {
      const s = o.stops[i] as RouteStop;
      const way =
        s.road && !s.by
          ? s.road.map((p) => at(p))
          : [
              pts[i - 1] as Pt,
              ...(s.by === "sea" ? (s.via ?? []).map((p) => at(p)) : []),
              pts[i] as Pt,
            ];
      const d = `M${way.map((p) => `${num(p[0])} ${num(p[1])}`).join("L")}`;
      (s.by === "sea" ? legs.sea : s.by === "untold" ? legs.untold : legs.land).push(d);
    }
  // A place stopped at twice (a way back) is one marker with both numbers. Two places at
  // the same spot on the drawing (Cherith and Abel-meholah) stay two: the second moves aside.
  const markers: { p: Pt; id: string | undefined; n: number[] }[] = [];
  pts.forEach((p, i) => {
    const id = o.stops[i]?.id;
    const m = markers.find((x) =>
      id === undefined ? x.id === undefined && x.p[0] === p[0] && x.p[1] === p[1] : x.id === id,
    );
    if (m) m.n.push(i + 1);
    else markers.push({ p, id, n: [i + 1] });
  });
  // A label that would cover one already placed moves aside (down, then up, right, left,
  // further each round), with a thin line back to its dot.
  const placed: { x: number; y: number; w: number }[] = [];
  const clash = (x: number, y: number, w: number) =>
    placed.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 2 && Math.abs(q.y - y) < 28);
  const leads: string[] = [];
  const marks = markers
    .map(({ p, n }) => {
      const text = n.join(",");
      const w = Math.max(26, 10 + text.length * 9);
      let [x, y] = p;
      for (let r = 1; clash(x, y, w) && r < 8; r++) {
        const tries: Pt[] = [
          [p[0], p[1] + 28 * r],
          [p[0], p[1] - 28 * r],
          [p[0] + (w + 4) * r, p[1]],
          [p[0] - (w + 4) * r, p[1]],
        ];
        const free = tries.find(
          ([a, b]) => !clash(a, b, w) && a > w / 2 && a < W - w / 2 && b > 12 && b < H - 12,
        );
        if (free) [x, y] = free;
      }
      placed.push({ x, y, w });
      const moved = x !== p[0] || y !== p[1];
      if (moved)
        leads.push(
          `<path class="k" d="M${num(p[0])} ${num(p[1])}L${num(x)} ${num(y)}"/><circle class="d" cx="${num(p[0])}" cy="${num(p[1])}" r="3.5"/>`,
        );
      return `<g class="m" transform="translate(${num(x)} ${num(y)})"><rect x="${num(-w / 2)}" y="-13" width="${num(w)}" height="26" rx="13"/><text y="5">${text}</text></g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(W)} ${String(H)}" width="${String(W)}" height="${String(H)}"><style>${STYLE}</style><rect class="l" width="${String(W)}" height="${String(H)}"/>${states.map((s) => `<path class="s c${String(s.p.c % 10)}" fill-rule="evenodd" d="${pathOf(s.rings)}"/>`).join("")}${water.rings.length ? `<path class="w" fill-rule="evenodd" d="${pathOf(water.rings)}"/>` : ""}${legs.land.length ? `<path class="f" d="${legs.land.join("")}"/>` : ""}${legs.sea.length ? `<path class="e" d="${legs.sea.join("")}"/>` : ""}${legs.untold.length ? `<path class="u" d="${legs.untold.join("")}"/>` : ""}${leads.join("")}${marks}</svg>`;
  return {
    svg,
    states: named,
    touched: touched.size,
    kinds: { foot: legs.land.length > 0, sea: legs.sea.length > 0, untold: legs.untold.length > 0 },
  };
}
