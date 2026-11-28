/**
 * What a place's static page shows around it (scripts/build-pages.ts): the nearby places, the
 * questions about it, its small map (place-map.ts) and the breadcrumb, as HTML and as
 * structured data. The choices are here and tested (place-related.test.ts); build-pages.ts
 * only places the blocks.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { distanceKm, roundKm } from "../packages/model/src/distance.ts";
import { type ChapterYears, medianYear } from "../packages/model/src/chapter-years.ts";
import { siteCertainty } from "../packages/model/src/sites.ts";
import { shortHash } from "./content-hash.ts";
import { pointInRing, type Ring, ringArea } from "./geo.ts";
import { type Frame, type Layers, meets, placeMapSvg, type Pt, SPAN } from "./place-map.ts";

export interface RelatedPlace {
  readonly id: string;
  readonly kind: string;
  readonly coords: readonly [number, number];
  readonly disputed: boolean;
  readonly confidence?: number | undefined;
  readonly dup?: boolean | undefined;
}

/**
 * Kinds a point stands for well enough to measure from: a town, a hill, a spring. A land, a
 * sea, a river or a road has a point too, but "12 km from Galilee" says nothing, and a gate
 * or a pool inside Jerusalem is part of the town, not a place near it.
 */
export const POINT_KINDS: ReadonlySet<string> = new Set([
  "settlement",
  "mountain",
  "hill",
  "island",
  "campsite",
  "spring",
  "well",
  "fortification",
  "promontory",
  "ford",
  "mountain pass",
  "cliff",
]);
/** Kinds the map shows from farther out: a town's frame would show only part of them. */
export const WIDE_KINDS: ReadonlySet<string> = new Set([
  "region",
  "people group",
  "mountain range",
  "body of water",
  "river",
  "natural area",
  "road",
  "canal",
  "forest",
]);
/** How many nearby places, and how far at most. */
export const NEARBY_MAX = 6;
export const NEARBY_KM = 40;
/** Closer than this, two points are one place (another record on its point, an alias). */
export const SAME_POINT_KM = 1;

/** Whether a point is sure enough to measure from or to. */
const measurable = (p: RelatedPlace, strict: boolean) => {
  const c = siteCertainty(p);
  return strict ? c === "agreed" || c === "likely" : c !== "disputed" && c !== "unknown";
};

/**
 * The nearest places to `p` whose pages may be linked, nearest first, with the distance in
 * whole kilometres as the site rounds it: only towns and other point-like places, none on
 * its own point, none farther than NEARBY_KM. A place whose location is disputed or unknown
 * gets none (a distance from a guess is a guess); the places listed are agreed or likely.
 */
export function nearbyPlaces(
  p: RelatedPlace,
  all: readonly RelatedPlace[],
  linkable: (id: string) => boolean,
): { id: string; km: number }[] {
  if (p.dup || !POINT_KINDS.has(p.kind) || !measurable(p, false)) return [];
  return all
    .filter(
      (q) =>
        q.id !== p.id && !q.dup && POINT_KINDS.has(q.kind) && measurable(q, true) && linkable(q.id),
    )
    .map((q) => ({ id: q.id, d: distanceKm(p.coords, q.coords) }))
    .filter((x) => x.d >= SAME_POINT_KM && x.d <= NEARBY_KM)
    .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))
    .slice(0, NEARBY_MAX)
    .map((x) => ({ id: x.id, km: roundKm(x.d) }));
}

/** The questions about a place: those whose map opens on it or measures from or to it. */
export function questionsAbout<
  Q extends { readonly map?: { readonly place?: string; readonly measure?: readonly string[] } },
>(id: string, questions: readonly Q[]): Q[] {
  return questions.filter((q) => q.map?.place === id || (q.map?.measure ?? []).includes(id));
}

/**
 * The year a place's map shows its states in: the middle year of the chapters that name it
 * (content/chapter-years.yaml, verse by verse; Susa is Esther's and Nehemiah's, 480 BC, not
 * the judges'), kept within the years the town stood (content/place-life.yaml: Samaria not
 * before Omri built it). A place named only in undated books (Psalms, Job) takes AD 30 when
 * the New Testament names it more, else 1000 BC (astronomical years, ADR 0003: -999).
 */
export const MAP_YEARS = { nt: 30, ot: -999 } as const;
export function mapYear(
  p: {
    readonly nt?: number | undefined;
    readonly ot?: number | undefined;
    readonly osis?: readonly string[] | undefined;
  },
  chapters: ChapterYears = {},
  life?: { readonly from?: { readonly year: number }; readonly until?: { readonly year: number } },
): number {
  let y =
    medianYear(p.osis ?? [], chapters) ?? ((p.nt ?? 0) > (p.ot ?? 0) ? MAP_YEARS.nt : MAP_YEARS.ot);
  if (life?.from && y < life.from.year) y = life.from.year;
  if (life?.until && y > life.until.year) y = life.until.year;
  return y;
}

/** A breadcrumb as schema.org's BreadcrumbList: names, and absolute URLs but the last. */
export function breadcrumbLd(items: readonly { name: string; url?: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: it.url } : {}),
    })),
  };
}

type Geometry =
  | { type: "Polygon"; coordinates: Pt[][] }
  | { type: "MultiPolygon"; coordinates: Pt[][][] }
  | { type: "LineString"; coordinates: Pt[] }
  | { type: "MultiLineString"; coordinates: Pt[][] };
type Box = [number, number, number, number];
const boxOf = (pts: readonly Pt[]): Box => {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  }
  return [w, s, e, n];
};
const polysOf = (g: Geometry): Pt[][][] =>
  g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
const linesOf = (g: Geometry): Pt[][] =>
  g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];

/** A state that holds a point: its shape's box and area (the smallest is the ruler, rulers.ts). */
interface State {
  readonly y0: number;
  readonly y1: number;
  readonly c: number;
  readonly vassal: boolean;
  /** Drawn inside its overlord, with no fill of its own (polity-overrides `vin`). */
  readonly inside: boolean;
  readonly names: Readonly<Record<string, string>>;
  readonly polys: Pt[][][];
  readonly box: Box;
  readonly area: number;
}
const holds = (s: State, [x, y]: Pt) =>
  x >= s.box[0] &&
  x <= s.box[2] &&
  y >= s.box[1] &&
  y <= s.box[3] &&
  s.polys.some(
    (poly) =>
      pointInRing([x, y], (poly[0] ?? []) as Ring) &&
      !poly.slice(1).some((h) => pointInRing([x, y], h as Ring)),
  );

/**
 * The state that held a point in a year, as the place card's band picks it (rulers.ts): the
 * smallest of the states whose shape holds it, alliances left out. Nothing when none does.
 */
export function stateAt(states: readonly State[], at: Pt, year: number): State | undefined {
  return states
    .filter((s) => s.y0 <= year && year < s.y1 && holds(s, at))
    .sort((a, b) => a.area - b.area)[0];
}

/**
 * The year shown, near the one asked: the asked year when a state holds the place then, else
 * the nearest within MAP_YEAR_REACH that has one (a decade apart first), else the asked year,
 * with no state named. The caption and the shapes drawn are of the same year.
 */
export const MAP_YEAR_REACH = 150;
export function yearWithState(
  states: readonly State[],
  at: Pt,
  year: number,
): { year: number; state?: State } {
  for (let d = 0; d <= MAP_YEAR_REACH; d += 10)
    for (const y of d ? [year - d, year + d] : [year]) {
      const state = stateAt(states, at, y);
      if (state) return { year: y, state };
    }
  return { year };
}

/** The frames tried for a place, closest first: a town's, an island's, a land's. */
export function spansFor(kind: string): number[] {
  if (WIDE_KINDS.has(kind)) return [SPAN.wide];
  if (kind === "island") return [SPAN.island, SPAN.wide];
  return [SPAN.near, SPAN.island, SPAN.wide];
}

export interface PlaceMap {
  /** The image's address from the site's root, with its content's hash. */
  readonly src: string;
  /** The year of the states drawn and named. */
  readonly year: number;
  /** The state that held the place then, by language (English as `en`), if any. */
  readonly state?: Readonly<Record<string, string>>;
  /** What the picture draws beyond the sea, so the page credits only that (place-map.ts). */
  readonly drawn: { readonly states: boolean; readonly rivers: boolean };
}

/**
 * The maps of the places, written to apps/web/public/data/maps/<id>.svg (only when they
 * change) from the built data: `render(id, coords, kind, year)` draws one and gives its
 * address, year and state, or nothing when even the widest frame holds nothing but land (a
 * place in the Arabian desert: a beige rectangle tells nothing). `finish()` removes the maps
 * of places no longer built and says how many and how large the maps are. Nothing at all when
 * the data is not there.
 */
export function placeMaps(data: string) {
  const files = ["water.geojson", "rivers.geojson", "polities.geojson", "coast.geojson"].map((f) =>
    join(data, f),
  );
  if (!files.every((f) => existsSync(f))) return undefined;
  const read = (f: string) =>
    (
      JSON.parse(readFileSync(f, "utf8")) as {
        features: { geometry: Geometry; properties: Record<string, unknown> }[];
      }
    ).features;
  const [waterF, riverF, stateF, coastF] = files.map(read) as [
    ReturnType<typeof read>,
    ReturnType<typeof read>,
    ReturnType<typeof read>,
    ReturnType<typeof read>,
  ];
  const coast = coastF
    .flatMap((f) => linesOf(f.geometry))
    .map((line) => ({
      line,
      box: boxOf(line),
    }));
  const water = waterF
    .flatMap((f) => polysOf(f.geometry))
    .map((poly) => ({
      poly,
      box: boxOf(poly[0] ?? []),
    }));
  const rivers = riverF.map((f) => {
    const lines = linesOf(f.geometry);
    return { rank: Number(f.properties.rank ?? 9), lines, box: boxOf(lines.flat()) };
  });
  // The states the globe draws, alliances left out, as its polity layers filter them.
  const states: State[] = stateF
    .filter((f) => !f.properties.rel)
    .map((f) => {
      const polys = polysOf(f.geometry);
      const names: Record<string, string> = { en: String(f.properties.name) };
      for (const [k, v] of Object.entries(f.properties))
        if (k.startsWith("name_") && typeof v === "string") names[k.slice(5)] = v;
      return {
        y0: Number(f.properties.y0),
        y1: Number(f.properties.y1),
        c: Number(f.properties.c ?? 0),
        vassal: f.properties.v !== undefined,
        inside: !!f.properties.vin,
        names,
        polys,
        box: boxOf(polys.flatMap((p) => p[0] ?? [])),
        area: polys.reduce((a, p) => a + ringArea((p[0] ?? []) as Ring), 0),
      };
    });
  const dir = join(data, "maps");
  mkdirSync(dir, { recursive: true });
  const written = new Map<string, number>();
  const render = (id: string, coords: Pt, kind: string, asked: number): PlaceMap | undefined => {
    const { year, state } = yearWithState(states, coords, asked);
    for (const span of spansFor(kind)) {
      const f: Frame = { lon: coords[0], lat: coords[1], span };
      const layers: Layers = {
        water: water.filter((w) => meets(f, w.box)).map((w) => w.poly),
        coast: coast.filter((c) => meets(f, c.box)).map((c) => c.line),
        rivers: rivers.filter((r) => meets(f, r.box)),
        // Visible when y0 ≤ year < y1 (style-expressions.ts, ADR 0003).
        states: states.filter((s) => s.y0 <= year && year < s.y1 && meets(f, s.box)),
      };
      const svg = placeMapSvg(f, layers);
      if (!svg.includes("<path")) continue;
      const file = join(dir, `${id}.svg`);
      if (!existsSync(file) || readFileSync(file, "utf8") !== svg) writeFileSync(file, svg);
      written.set(id, svg.length);
      return {
        src: `data/maps/${id}.svg?v=${shortHash(svg)}`,
        year,
        ...(state ? { state: state.names } : {}),
        // The states are the dashed paths, the rivers the round-capped ones (placeMapSvg).
        drawn: {
          states: svg.includes("stroke-dasharray"),
          rivers: svg.includes('stroke-linecap="round"'),
        },
      };
    }
    return undefined;
  };
  const finish = () => {
    let removed = 0;
    for (const f of readdirSync(dir))
      if (f.endsWith(".svg") && !written.has(f.slice(0, -4))) {
        rmSync(join(dir, f));
        removed++;
      }
    const sizes = [...written.values()];
    return {
      count: sizes.length,
      kb: Math.round(sizes.reduce((a, b) => a + b, 0) / 1000),
      largestKb: Math.round(Math.max(0, ...sizes) / 1000),
      removed,
    };
  };
  return { render, finish };
}
