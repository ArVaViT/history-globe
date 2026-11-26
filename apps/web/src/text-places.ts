// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { isLocale, textPlacesFrom, type Locale, type TextPlaces } from "@hg/model";
import { cachedJson } from "./data";

const indexes = new Map<string, Promise<TextPlaces>>();

/**
 * The places a verse names, for a card's verse: the language's index (scripts/
 * build-text-places.ts), fetched and compiled once. Every published language has its
 * index; any other reads the English one.
 */
export function loadTextPlaces(locale: Locale): Promise<TextPlaces> {
  const l = isLocale(locale) ? locale : "en";
  let got = indexes.get(l);
  if (!got) {
    got = cachedJson<{ forms: Record<string, string>; names?: string[] }>(
      `text-places.${l}.json`,
    ).then(textPlacesFrom);
    indexes.set(l, got);
    got.catch(() => indexes.delete(l));
  }
  return got;
}
