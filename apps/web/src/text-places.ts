import type { Locale } from "@hg/model";
import { DATA_URL } from "./data";
import { textPlacesFrom, type TextPlaces } from "./text-places-core";

export { splitPlaces, textPlacesFrom, type Segment, type TextPlaces } from "./text-places-core";

/** The places a verse names, for a card's verse: the index loaded once per language. */
const loaded = new Map<Locale, Promise<TextPlaces>>();

/** The index for a language, fetched once; a failed load is tried again next time. */
export function loadTextPlaces(locale: Locale): Promise<TextPlaces> {
  let got = loaded.get(locale);
  if (!got) {
    got = fetch(`${DATA_URL}/text-places.${locale === "ru" ? "ru" : "en"}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`text-places: ${String(r.status)}`);
        return r.json() as Promise<{ forms: Record<string, string>; names?: string[] }>;
      })
      .then(textPlacesFrom);
    got.catch(() => loaded.delete(locale));
    loaded.set(locale, got);
  }
  return got;
}
