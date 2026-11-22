/**
 * Checks that hold the content's layers to one another (scripts/build-content.ts runs them):
 * a point in the drawn water, an item on a place the map draws faded in its year, the same
 * passage at the same place in different years, an event told again as a battle, and the
 * kilometres a "how far" answer states. Pure functions, so each can be tested.
 */
import { distanceKm } from "../packages/model/src/distance.ts";
import { canonicalPosition, parseOne } from "../packages/model/src/scripture.ts";
import type { PlaceLife } from "../packages/model/src/content.ts";
import { NT_FROM } from "../packages/core/src/style-expressions.ts";

type Point = readonly [number, number];
type Segment = readonly [number, number, number, number];

/** Latitude bands of the index, in degrees. */
const BAND = 0.1;
const KM_PER_DEGREE = 111.2;

/** Segments filed by the latitude bands they cross. */
class Bands {
  private readonly bands = new Map<number, Segment[]>();

  add(a: Point, b: Point): void {
    const s: Segment = [a[0], a[1], b[0], b[1]];
    const lo = Math.floor(Math.min(a[1], b[1]) / BAND);
    const hi = Math.floor(Math.max(a[1], b[1]) / BAND);
    for (let k = lo; k <= hi; k++) {
      const list = this.bands.get(k);
      if (list) list.push(s);
      else this.bands.set(k, [s]);
    }
  }

  at(lat: number): readonly Segment[] {
    return this.bands.get(Math.floor(lat / BAND)) ?? [];
  }

  /** Every segment in the bands within `deg` of the latitude (a segment may come twice). */
  near(lat: number, deg: number): Segment[] {
    const out: Segment[] = [];
    for (let k = Math.floor((lat - deg) / BAND); k <= Math.floor((lat + deg) / BAND); k++)
      out.push(...(this.bands.get(k) ?? []));
    return out;
  }
}

/**
 * The water the map draws (water.geojson: each polygon one ring, its islands joined to it
 * by zero-width cuts) and its shores (coast.geojson, without the cuts): how far inside
 * the water a point lies.
 */
export class Water {
  private readonly rings = new Bands();
  private readonly shores = new Bands();

  constructor(rings: readonly (readonly Point[])[], shores: readonly (readonly Point[])[]) {
    for (const ring of rings)
      for (let k = 1; k < ring.length; k++) {
        const a = ring[k - 1];
        const b = ring[k];
        if (a && b && a[1] !== b[1]) this.rings.add(a, b);
      }
    for (const line of shores)
      for (let k = 1; k < line.length; k++) {
        const a = line[k - 1];
        const b = line[k];
        if (a && b) this.shores.add(a, b);
      }
  }

  /** Ray casting over every ring at once: the sea and the lakes do not overlap. */
  contains([x, y]: Point): boolean {
    let inside = false;
    for (const [x0, y0, x1, y1] of this.rings.at(y))
      if (y0 > y !== y1 > y && x < ((x1 - x0) * (y - y0)) / (y1 - y0) + x0) inside = !inside;
    return inside;
  }

  /** Kilometres from the point to the nearest shore within `maxKm` (else `maxKm`). */
  shoreKm([x, y]: Point, maxKm: number): number {
    const k = Math.cos((y * Math.PI) / 180);
    const deg = maxKm / KM_PER_DEGREE;
    let best = maxKm;
    for (const [x0, y0, x1, y1] of this.shores.near(y, deg)) {
      if (Math.min(x0, x1) > x + deg / k || Math.max(x0, x1) < x - deg / k) continue;
      const dx = (x1 - x0) * k;
      const dy = y1 - y0;
      const px = (x - x0) * k;
      const py = y - y0;
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len));
      best = Math.min(best, Math.hypot(px - t * dx, py - t * dy) * KM_PER_DEGREE);
    }
    return best;
  }

  /** How far inside the water the point lies, in km; 0 on land. */
  depthKm(p: Point, maxKm = 50): number {
    return this.contains(p) ? this.shoreKm(p, maxKm) : 0;
  }
}

/**
 * Kinds of place whose point is the water itself: a sea or a lake, a river through a lake.
 * An island, a spring, a ford or a promontory stands on the land the map draws.
 */
export const WATERY_KINDS: ReadonlySet<string> = new Set(["body of water", "river"]);

/**
 * Why the map draws a place faded in `year` (apps/web/src/data.ts beforeItsTime), or null
 * when it stands: in ruins, gone, not yet built, or named only in the New Testament before
 * its events. `ot` is the number of its Old Testament verses.
 */
export function fadedState(life: PlaceLife | undefined, ot: number, year: number): string | null {
  if (life?.gap && year >= life.gap.from.year && year <= life.gap.until.year) return "in ruins";
  if (life?.until && year > life.until.year) return "gone";
  if (life?.from) return year < life.from.year ? "not yet built" : null;
  if (life && !life.inherited) return null;
  return ot === 0 && year < NT_FROM ? "named only in the New Testament, before its events" : null;
}

/** The year a place falls: an event in it marks its ruin, and the map rightly draws it so. */
export const fallsIn = (life: PlaceLife | undefined, year: number): boolean =>
  life?.gap?.from.year === year;

/** A dated passage at a place: an event, a battle, a tour stop or a question's map. */
export interface Dated {
  readonly where: string;
  readonly ref: string;
  readonly place: string;
  readonly year: number;
  /** A tour stop at its tour's year rather than one of its own. */
  readonly tourYear?: boolean;
}

/** The verses a reference covers, as comparable positions (a whole chapter to its end). */
function span(ref: string): { book: string; from: number; to: number } {
  const [start = "", end = start] = ref.split("-");
  const last = parseOne(end);
  return {
    book: parseOne(start).book,
    from: canonicalPosition(start),
    to: canonicalPosition(end) + (last.verse === null ? 999 : 0),
  };
}

/**
 * Pairs that date the same passage at the same place years apart, where one of the two is a
 * tour stop at its tour's year: the stop most likely wants the year of the passage. Two
 * stops of one tour are its own sequence. Each pair comes as "where where", in the items'
 * order, with its message.
 */
export function samePassageApart(
  items: readonly Dated[],
  minYears = 5,
): { pair: string; message: string }[] {
  const spans = items.map((it) => ({ it, ...span(it.ref) }));
  const tourOf = (w: string) => (w.startsWith("tours/") ? w.split(" ")[0] : w);
  const out: { pair: string; message: string }[] = [];
  for (const [i, a] of spans.entries())
    for (const b of spans.slice(i + 1)) {
      if (a.it.place !== b.it.place || a.book !== b.book) continue;
      if (a.from > b.to || b.from > a.to) continue;
      if (Math.abs(a.it.year - b.it.year) < minYears) continue;
      if (!a.it.tourYear && !b.it.tourYear) continue;
      if (tourOf(a.it.where) === tourOf(b.it.where)) continue;
      out.push({
        pair: `${a.it.where} ${b.it.where}`,
        message: `${a.it.where} (${a.it.ref}, ${String(a.it.year)}) and ${b.it.where} (${b.it.ref}, ${String(b.it.year)}) date the same passage at ${a.it.place} ${String(Math.abs(a.it.year - b.it.year))} years apart`,
      });
    }
  return out;
}

/** An event as the link check needs it: where it happened. */
export interface EventAt {
  readonly id: string;
  readonly year: number;
  readonly place?: string | undefined;
  readonly site?: string | undefined;
}

/** A battle as the link check needs it. */
export interface BattleAt {
  readonly id: string;
  readonly year: number;
  readonly place: string;
  readonly event?: string;
}

/**
 * An event and a battle at the same place (or ancient site) within a year tell one story:
 * the battle names the event (`event`), and the lists show it once. A link to another
 * place or year, an unknown event, or a battle id that is an event's is refused too.
 */
export function eventBattleLinks(
  events: readonly EventAt[],
  battles: readonly BattleAt[],
): string[] {
  const out: string[] = [];
  const byId = new Map(events.map((e) => [e.id, e]));
  const at = (e: EventAt) => e.place ?? e.site;
  const sameStory = (e: EventAt, b: BattleAt) =>
    at(e) === b.place && Math.abs(e.year - b.year) <= 1;
  for (const b of battles) {
    if (byId.has(b.id)) out.push(`battles: ${b.id} has the id of an event`);
    if (b.event !== undefined) {
      const e = byId.get(b.event);
      if (!e) out.push(`battles: ${b.id} names the event ${b.event}, which is not in events.yaml`);
      else if (!sameStory(e, b))
        out.push(`battles: ${b.id} names the event ${b.event}, at another place or year`);
    }
    for (const e of events)
      if (sameStory(e, b) && b.event !== e.id)
        out.push(`battles: ${b.id} tells the event ${e.id} again; link it (event: ${e.id})`);
  }
  return out;
}

/**
 * The kilometre figures a text states, in any of its languages: "2,305 km", "2 305 км",
 * "2.305 km" (a thousands separator is a comma, a point or a space before three digits).
 */
export const kmFigures = (text: string): number[] =>
  [
    ...text.matchAll(
      /(?<![\p{N}.,])(\d{1,3}(?:[,.\u00a0\u202f ]\d{3})+|\d+)\s*(?:km|км)(?!\p{L})/gu,
    ),
  ].map((m) => Number((m[1] ?? "").replace(/\D/g, "")));

/**
 * Whether a "how far" answer (in one language) states the measured distance: some figure
 * within 10% (at least 3 km) of the straight line between the two points.
 */
export function statesDistance(text: string, a: Point, b: Point): boolean {
  const km = distanceKm(a, b);
  return kmFigures(text).some((n) => Math.abs(n - km) <= Math.max(3, 0.1 * km));
}

/**
 * The distances an English article gives from its own place to another: in a sentence that
 * begins with the article's title or "It", a figure "N km [up to three words] of/from
 * <Name>", not "within N km". Other sentences may speak of another site and are not read.
 */
export function ownDistances(title: string, text: string): { km: number; to: string }[] {
  const out: { km: number; to: string }[] = [];
  for (const sentence of text.split(/(?<=\.)\s+(?=[A-Z])/u)) {
    if (!sentence.startsWith(`${title} `) && !sentence.startsWith("It ")) continue;
    for (const m of sentence.matchAll(
      /(?<!within (?:about |some )?)(?<![\d.,])(\d+(?:\.\d+)?)\s?km\s(?:[a-z-]+\s){0,3}?(?:of|from)\s((?:Mount )?[A-Z][\w'-]+(?:-[a-z]+)*)/gu,
    ))
      out.push({ km: Number(m[1]), to: m[2] ?? "" });
  }
  return out;
}

/** Whether a stated figure is the straight line between two points: within 10% (at least 1.5 km). */
export const nearDistance = (km: number, a: Point, b: Point): boolean => {
  const real = distanceKm(a, b);
  return Math.abs(km - real) <= Math.max(1.5, 0.1 * real);
};
