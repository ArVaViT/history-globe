import type { Locale } from "@hg/model";
import { DATA_URL } from "./data";

const books = new Map<string, Promise<Readonly<Record<string, string>>>>();

/**
 * A verse's text (Synodal in Russian, KJV in English; scripts/build-verses.ts), by its
 * English OSIS reference. One book loads at a time, on the first verse opened from it;
 * undefined when the text is not shipped (a few Synodal chapters numbered otherwise).
 */
export function loadVerse(osis: string, locale: Locale): Promise<string | undefined> {
  const lang = locale === "ru" ? "ru" : "en";
  const book = osis.split(".")[0] ?? "";
  const key = `${lang}/${book}`;
  let verses = books.get(key);
  if (!verses) {
    verses = fetch(`${DATA_URL}/verses/${key}.json`).then((r) => {
      // No file: no verse of that book is shipped (a few Synodal chapters). Anything
      // else is a failure, tried again next time.
      if (r.status === 404) return {};
      if (!r.ok) throw new Error(`verses ${key}: ${String(r.status)}`);
      return r.json() as Promise<Readonly<Record<string, string>>>;
    });
    // A failed load is tried again next time, not remembered.
    verses.catch(() => books.delete(key));
    books.set(key, verses);
  }
  return verses.then((v) => v[osis]);
}
