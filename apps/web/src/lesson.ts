/**
 * A teacher's own tour, built from place cards and shared as a link:
 * `?lesson=<place id>~<year>.<place id>~<year>…&tour=lesson`. Each place keeps the year
 * the map showed when it was added, and its stop the verse nearest that year. It runs as
 * any tour: distances, the relief of the way, the printed sheet and the outline map. A
 * name the teacher gives it travels as `&title=`.
 */
export const LESSON = "lesson";
/** Enough for a class; a longer list is cut. */
export const LESSON_MAX = 24;

export interface LessonStop {
  readonly id: string;
  readonly year?: number;
}

const STOP = /^(a[0-9a-f]{6})(?:~(-?\d{1,4}))?$/;

/** The places of the lesson in the address, in order, without repeats. */
export function lessonStops(search: string): LessonStop[] {
  const seen = new Set<string>();
  const out: LessonStop[] = [];
  for (const part of (new URLSearchParams(search).get(LESSON) ?? "").split(".")) {
    const m = STOP.exec(part);
    if (!m?.[1] || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push(m[2] === undefined ? { id: m[1] } : { id: m[1], year: Number(m[2]) });
  }
  return out.slice(0, LESSON_MAX);
}

/** The longest name a lesson keeps. */
export const TITLE_MAX = 80;

/** The lesson's own name in the address, or "". */
export function lessonTitle(search: string): string {
  return (new URLSearchParams(search).get("title") ?? "").trim().slice(0, TITLE_MAX);
}

/** The address of a lesson. */
export function lessonSearch(stops: readonly LessonStop[], locale: string, title = ""): string {
  const lesson = stops
    .map((s) => (s.year === undefined ? s.id : `${s.id}~${String(s.year)}`))
    .join(".");
  const q = new URLSearchParams({ [LESSON]: lesson, tour: LESSON, locale });
  const name = title.trim().slice(0, TITLE_MAX);
  if (name) q.set("title", name);
  return `?${q.toString()}`;
}
