/**
 * A tour's page texts (content/tours/*.yaml: `intro`, `sources` and each stop's `story`):
 * what build-content.ts checks of them and the shape it writes for build-pages.ts
 * (apps/web/build/tour-texts.json). The map does not read them, so content.json keeps the
 * tours without them.
 */
import type { TourFile } from "../packages/model/src/content.ts";
import type { Locale } from "../packages/model/src/locales.ts";

/** What tour-texts.json holds for one tour, in every language. */
export interface TourTexts {
  readonly intro: Readonly<Partial<Record<Locale, readonly string[]>>>;
  /** Each stop's story, in the order of the stops. */
  readonly stories: readonly Readonly<Partial<Record<Locale, string>>>[];
  readonly sources: readonly string[];
  readonly sources_ru?: readonly string[];
  readonly sources_in?: Readonly<Partial<Record<Locale, readonly string[]>>>;
}

/**
 * Whether a tour's texts are whole: an intro comes with sources and a story at every stop,
 * each in every language (ADR 0015); a story or sources without an intro are half a page.
 */
export function tourTextErrors(t: TourFile, locales: readonly Locale[]): string[] {
  const at = `tours/${t.id}.yaml`;
  const stories = t.stops.filter((s) => s.story !== undefined).length;
  if (!t.intro) {
    if (stories > 0 || t.sources) return [`${at}: stories or sources without an intro`];
    return [];
  }
  const errors: string[] = [];
  if (!t.sources) errors.push(`${at}: an intro without sources`);
  for (const l of locales) {
    if (!t.intro[l]) errors.push(`${at}: no ${l} intro`);
    t.stops.forEach((s, i) => {
      if (!s.story?.[l]) errors.push(`${at}: stop ${String(i + 1)} has no ${l} story`);
    });
  }
  return errors;
}

/** The tour without its page texts, as content.json carries it for the map. */
export function withoutTexts(t: TourFile): TourFile {
  const rest: TourFile = { ...t, stops: t.stops.map((s) => ({ ...s })) };
  delete rest.intro;
  delete rest.sources;
  for (const s of rest.stops) delete s.story;
  return rest;
}
