// How a search compares text: the app's place search (apps/web/src/data.ts) and the static
// pages' and the documentation's own searches (scripts/client/) fold with these. No imports:
// the static pages' scripts carry this file's code as it stands (scripts/client-script.ts).

/** Text as a search compares it: lower case, «ё» as «е», no accents ("Ḥ", "é"). */
export function foldText(s: string): string {
  return s
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}

/**
 * A name as the search compares it: folded, and without hyphens, apostrophes or spaces, so
 * "беф шемеш" finds "Беф-Шемеш".
 */
export function foldName(s: string): string {
  return foldText(s).replace(/[\s\-\u2010-\u2015'\u2019\u02bc]+/g, "");
}
