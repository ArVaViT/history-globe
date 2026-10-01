import { formatRef, parseOne } from "./scripture.ts";
import { VERSES } from "./versification.ts";

/**
 * Throws unless `osis` is a well-formed reference or forward range whose chapters and
 * verses all exist in the English versification (ADR 0007). Used by the content
 * schemas and build scripts; the browser only formats references already checked.
 */
export function checkRef(osis: string): void {
  formatRef(osis, "en");
  for (const end of osis.split("-")) {
    const ref = parseOne(end);
    const inChapter = VERSES[ref.book]?.[ref.chapter - 1];
    if (inChapter === undefined || (ref.verse !== null && ref.verse > inChapter))
      throw new SyntaxError(`no such verse: "${osis}"`);
  }
}
