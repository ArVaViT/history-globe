import type { Locale } from "@hg/model";
import { cachedJson } from "./data";

/**
 * A verse's text in the locale's Bible (scripts/build-verses.ts), by its English OSIS
 * reference. One book loads at a time, on the first verse opened from it; undefined when
 * the text is not shipped (a few Synodal chapters numbered otherwise).
 */
export function loadVerse(osis: string, locale: Locale): Promise<string | undefined> {
  const book = osis.split(".")[0] ?? "";
  return cachedJson<Readonly<Record<string, string>>>(`verses/${locale}/${book}.json`, {
    missing: {},
  }).then((verses) => verses[osis]);
}
