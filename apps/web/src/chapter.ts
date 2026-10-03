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
  const places = data.places.features
    .filter((f) => f.properties.osis.some((o) => inSpan(o, span)))
    .map((f) => f.properties.id);
  if (places.length === 0) return null;
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
  return year === undefined ? { ref, places } : { ref, places, year };
}
