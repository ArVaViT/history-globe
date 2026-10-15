import { formatRef, yearOfRef, type Locale } from "@hg/model";
import type { LoadedData } from "./data";

/** A Bible chapter shown on the map: its places and the year to show them at. */
export interface ChapterFocus {
  /**
   * OSIS, English numbering: `Acts.16`; `Ps.9-Ps.10` for a Synodal psalm that spans two
   * English ones; `Ps.116.10-Ps.116.19` for one that is part of an English one.
   */
  readonly ref: string;
  readonly places: string[];
  readonly year?: number;
  /** The places the map frames, when not all of them (framePlaces). */
  readonly frame?: string[];
  /** The way travelled in the chapter: a walked tour's stops that read it (chapterRoute). */
  readonly route?: (readonly [number, number])[];
  /** The places of the way's stops, in its order. */
  readonly routePlaces?: string[];
}

/**
 * Kinds that stand for a wide area on one point: Italy is a point at Rome, the Adriatic one
 * in the middle of its sea. Framed with the towns, they pulled Acts 27 out to half the globe
 * on a phone, where the towns came out as specks.
 */
const WIDE = new Set([
  "region",
  "body of water",
  "mountain range",
  "people group",
  "river",
  "road",
  "natural area",
]);

/** Kilometres across a set of points' box (its diagonal). */
function spreadKm(points: readonly (readonly [number, number])[]): number {
  if (points.length < 2) return 0;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const mid = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const dx = (Math.max(...lons) - Math.min(...lons)) * 111 * Math.cos(mid);
  const dy = (Math.max(...lats) - Math.min(...lats)) * 111;
  return Math.hypot(dx, dy);
}

/**
 * The chapter's places that make its map. Wide areas step out when there are towns, and so
 * does a place named once far from the rest (Jerusalem in Acts 16, where Paul only carries
 * its decrees): each such outlier that shrinks the frame by 30% or more leaves it, at most a quarter
 * of the places. The rest stay on the map, outside the first view; a chapter's way is
 * framed whole all the same (Engine.focusPlaces).
 */
export function framePlaces(
  places: readonly { id: string; at: readonly [number, number]; kind: string; mentions: number }[],
): string[] {
  const narrow = places.filter((p) => !WIDE.has(p.kind));
  let kept = narrow.length >= 2 ? narrow : [...places];
  const most = Math.floor(kept.length / 4);
  for (let dropped = 0; dropped < most && kept.length > 3; dropped++) {
    const span = spreadKm(kept.map((p) => p.at));
    let drop = -1;
    let least = span * 0.7;
    kept.forEach((p, i) => {
      if (p.mentions > 1) return;
      const without = spreadKm(kept.filter((_, j) => j !== i).map((q) => q.at));
      if (without <= least) {
        drop = i;
        least = without;
      }
    });
    if (drop < 0) break;
    kept = kept.filter((_, j) => j !== drop);
  }
  return kept.map((p) => p.id);
}

/**
 * The way travelled in a chapter: the stops of a walked tour that read it, in the tour's
 * order, from the stop before the first (where the chapter sets out from). Null with
 * fewer than two points, or for a tour that is not a journey (a survey of empires).
 */
export function chapterRoute(
  tour: Pick<LoadedData["tours"][number], "stops" | "walked"> | undefined,
  inChapter: (ref: string) => boolean,
): { at: (readonly [number, number])[]; places: string[] } | null {
  if (!tour || tour.walked === false) return null;
  const idx = tour.stops.flatMap((st, i) => (inChapter(st.ref) ? [i] : []));
  const first = idx[0];
  const last = idx.at(-1);
  if (first === undefined || last === undefined) return null;
  const stops = tour.stops.slice(Math.max(0, first - 1), last + 1);
  if (stops.length < 2) return null;
  return {
    at: stops.map((st) => [st.at[0], st.at[1]] as const),
    places: stops.map((st) => st.placeId),
  };
}

/** Where a chapter ref starts and ends: chapter × 1000 + verse. */
interface Span {
  readonly book: string;
  readonly from: number;
  readonly to: number;
}

const PART = /^([1-4]?[A-Za-z]+)\.(\d{1,3})(?:\.(\d{1,3}))?$/;

/** A chapter, a short run of chapters or a verse range of one book; null otherwise. */
export function parseChapterRef(ref: string): Span | null {
  // A whole book: every chapter.
  if (/^[1-4]?[A-Za-z]+$/.test(ref)) return { book: ref, from: 1001, to: 999_999 };
  const [a, b, extra] = ref.split("-");
  if (a === undefined || extra !== undefined) return null;
  const start = PART.exec(a);
  const end = PART.exec(b ?? a);
  if (!start?.[1] || !end || end[1] !== start[1]) return null;
  const c1 = Number(start[2]);
  const c2 = Number(end[2]);
  const from = c1 * 1000 + (start[3] === undefined ? 1 : Number(start[3]));
  const to = c2 * 1000 + (end[3] === undefined ? 999 : Number(end[3]));
  if (c1 < 1 || from > to || c2 - c1 > 2) return null;
  return { book: start[1], from, to };
}

/** The verse (or the start of a range) falls in the span. */
function inSpan(osis: string, span: Span): boolean {
  const [book, c, v] = (osis.split("-")[0] ?? "").split(".");
  if (book !== span.book || c === undefined || v === undefined) return false;
  const at = Number(c) * 1000 + Number(v);
  return at >= span.from && at <= span.to;
}

/**
 * The chapter's places in the order the text first names them (Acts 16: Derbe, Lystra …
 * Philippi, Thyatira); places it does not name (a whole book's are all named) keep their
 * order at the end.
 */
export function readingOrder(
  ids: readonly string[],
  osisOf: (id: string) => readonly string[],
  ref: string,
): string[] {
  const at = new Map(ids.map((id) => [id, verseKey(firstVerseIn(osisOf(id), ref))]));
  return [...ids].sort((a, b) => (at.get(a) ?? Infinity) - (at.get(b) ?? Infinity));
}

/** The first of a place's verses that falls in the chapter (`Acts.16.7`), if any. */
export function firstVerseIn(osis: readonly string[], ref: string): string | undefined {
  const span = parseChapterRef(ref);
  if (!span) return undefined;
  let best: string | undefined;
  for (const o of osis) if (inSpan(o, span) && verseKey(o) < verseKey(best)) best = o.split("-")[0];
  return best;
}

/** Chapter × 1000 + verse of a reference; none sorts last. */
function verseKey(osis: string | undefined): number {
  if (!osis) return Infinity;
  const [, c, v] = (osis.split("-")[0] ?? "").split(".");
  return Number(c) * 1000 + Number(v);
}

/** The chapter as people say it in this language: «Пс 115», "Acts 16", "Ps 9–10". */
export function chapterLabel(ref: string, locale: Locale): string {
  // A whole book: its name as the chapter labels write it («Деян»).
  if (/^[1-4]?[A-Za-z]+$/.test(ref)) {
    try {
      return formatRef(`${ref}.1`, locale).replace(/\s*1(:.*)?$/, "");
    } catch {
      return ref;
    }
  }
  const chapterOf = (part: string) => {
    try {
      return formatRef(part, locale).replace(/:.*$/, "");
    } catch {
      return part;
    }
  };
  const [a = ref, b] = ref.split("-");
  const first = chapterOf(a);
  const last = b === undefined ? first : chapterOf(b);
  return last === first ? first : `${first}–${last.replace(/^.* /, "")}`;
}

/**
 * The places whose verses fall in the chapter, and the map's year: that of the first
 * tour stop reading it (Gen 12 → Abraham's). Null when the ref is not a chapter or no
 * place is named.
 */
export function chapterFocus(
  data: Pick<LoadedData, "places" | "tours"> & Partial<Pick<LoadedData, "chapterYears">>,
  ref: string,
): ChapterFocus | null {
  const span = parseChapterRef(ref);
  if (!span) return null;
  const named = data.places.features.filter((f) => f.properties.osis.some((o) => inSpan(o, span)));
  const places = named.map((f) => f.properties.id);
  if (places.length === 0) return null;
  const frame = framePlaces(
    named.map((f) => ({
      id: f.properties.id,
      at: [f.geometry.coordinates[0] ?? 0, f.geometry.coordinates[1] ?? 0] as const,
      kind: f.properties.kind,
      mentions: f.properties.osis.filter((o) => inSpan(o, span)).length,
    })),
  );
  // A chapter: the first tour that reads it. A whole book: the tour with the most stops in
  // it (Acts → Paul's journeys, not the survey of empires that ends in Rome).
  const book = span.to - span.from > 200_000;
  const stopsIn = (t: (typeof data.tours)[number]) =>
    t.stops.filter((st) => inSpan(st.ref, span)).length;
  const tour = book
    ? [...data.tours].sort((a, b) => stopsIn(b) - stopsIn(a))[0]
    : data.tours.find((t) => t.stops.some((st) => inSpan(st.ref, span)));
  // A chapter's own year comes first (content/chapter-years.yaml); then the tour's.
  const own = book || !data.chapterYears ? undefined : yearOfRef(ref, data.chapterYears);
  const year =
    own ??
    (tour && stopsIn(tour) > 0
      ? (tour.stops.find((st) => inSpan(st.ref, span))?.year ?? tour.year)
      : undefined);
  // A whole book's tours are too long to draw as one chapter's way.
  const route = book
    ? null
    : chapterRoute(
        data.tours.find((t) => t.walked !== false && t.stops.some((st) => inSpan(st.ref, span))),
        (r) => inSpan(r, span),
      );
  return {
    ref,
    places,
    ...(year === undefined ? {} : { year }),
    ...(frame.length < places.length ? { frame } : {}),
    ...(route ? { route: route.at, routePlaces: route.places } : {}),
  };
}

/** The same chapter at the year a link or a step already set: everything but its year. */
export function withoutYear({
  ref,
  places,
  frame,
  route,
  routePlaces,
}: ChapterFocus): ChapterFocus {
  return {
    ref,
    places,
    ...(frame ? { frame } : {}),
    ...(route ? { route } : {}),
    ...(routePlaces ? { routePlaces } : {}),
  };
}
