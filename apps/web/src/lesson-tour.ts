import { medianYear, yearOfRef, type ChapterYears } from "@hg/model";
import type { LonLat, PlaceInfo } from "@hg/core";

type Words = { en: string; ru: string };
/** As the content's tours are: a title and notes in both languages. */
export interface LessonTour {
  id: string;
  year: number;
  title: Words;
  stops: { placeId: string; at: LonLat; ref: string; note: Words; year?: number }[];
}
import { LESSON, lessonStops, lessonTitle } from "./lesson";

/**
 * The tour of a lesson in the address (lesson.ts): its places in order, each at the year it
 * was picked in, with the place's verse nearest that year; null under two places.
 */
export function lessonTour(
  search: string,
  byId: ReadonlyMap<
    string,
    { readonly props: { readonly osis: readonly string[] }; readonly info: PlaceInfo }
  >,
  table: ChapterYears,
): LessonTour | null {
  const picked = lessonStops(search)
    .map((s) => ({ ...s, osis: byId.get(s.id)?.props.osis ?? [] }))
    .filter((s) => s.osis.length > 0);
  if (picked.length < 2) return null;
  const stops = picked.map(({ id, year, osis }) => {
    const near = (ref: string) => Math.abs((yearOfRef(ref, table) ?? 1e6) - (year ?? 0));
    const ref =
      year === undefined ? (osis[0] ?? "") : osis.reduce((a, b) => (near(b) < near(a) ? b : a));
    const at = year ?? yearOfRef(ref, table);
    return {
      placeId: id,
      at: byId.get(id)?.info.at ?? ([0, 0] as const),
      ref,
      note: { en: "", ru: "" },
      ...(at !== undefined ? { year: at } : {}),
    };
  });
  return {
    id: LESSON,
    year:
      stops[0]?.year ??
      medianYear(
        stops.map((s) => s.ref),
        table,
      ) ??
      30,
    title: lessonTitle(search)
      ? { en: lessonTitle(search), ru: lessonTitle(search) }
      : { en: "Your lesson", ru: "Ваш урок" },
    stops,
  };
}
