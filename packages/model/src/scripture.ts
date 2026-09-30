import type { Locale } from "./time.ts";
import { toSynodal } from "./synodal.ts";
import { VERSES } from "./versification.ts";

/** OSIS book id → [Russian Synodal abbreviation, English abbreviation]. */
const BOOKS: Readonly<Record<string, readonly [string, string]>> = {
  Gen: ["Быт", "Gen"],
  Exod: ["Исх", "Exod"],
  Lev: ["Лев", "Lev"],
  Num: ["Чис", "Num"],
  Deut: ["Втор", "Deut"],
  Josh: ["Нав", "Josh"],
  Judg: ["Суд", "Judg"],
  Ruth: ["Руф", "Ruth"],
  "1Sam": ["1 Цар", "1 Sam"],
  "2Sam": ["2 Цар", "2 Sam"],
  "1Kgs": ["3 Цар", "1 Kgs"],
  "2Kgs": ["4 Цар", "2 Kgs"],
  "1Chr": ["1 Пар", "1 Chr"],
  "2Chr": ["2 Пар", "2 Chr"],
  Ezra: ["Езд", "Ezra"],
  Neh: ["Неем", "Neh"],
  Esth: ["Есф", "Esth"],
  Job: ["Иов", "Job"],
  Ps: ["Пс", "Ps"],
  Prov: ["Притч", "Prov"],
  Eccl: ["Еккл", "Eccl"],
  Song: ["Песн", "Song"],
  Isa: ["Ис", "Isa"],
  Jer: ["Иер", "Jer"],
  Lam: ["Плач", "Lam"],
  Ezek: ["Иез", "Ezek"],
  Dan: ["Дан", "Dan"],
  Hos: ["Ос", "Hos"],
  Joel: ["Иоил", "Joel"],
  Amos: ["Ам", "Amos"],
  Obad: ["Авд", "Obad"],
  Jonah: ["Ион", "Jonah"],
  Mic: ["Мих", "Mic"],
  Nah: ["Наум", "Nah"],
  Hab: ["Авв", "Hab"],
  Zeph: ["Соф", "Zeph"],
  Hag: ["Агг", "Hag"],
  Zech: ["Зах", "Zech"],
  Mal: ["Мал", "Mal"],
  Matt: ["Мф", "Matt"],
  Mark: ["Мк", "Mark"],
  Luke: ["Лк", "Luke"],
  John: ["Ин", "John"],
  Acts: ["Деян", "Acts"],
  Rom: ["Рим", "Rom"],
  "1Cor": ["1 Кор", "1 Cor"],
  "2Cor": ["2 Кор", "2 Cor"],
  Gal: ["Гал", "Gal"],
  Eph: ["Еф", "Eph"],
  Phil: ["Флп", "Phil"],
  Col: ["Кол", "Col"],
  "1Thess": ["1 Фес", "1 Thess"],
  "2Thess": ["2 Фес", "2 Thess"],
  "1Tim": ["1 Тим", "1 Tim"],
  "2Tim": ["2 Тим", "2 Tim"],
  Titus: ["Тит", "Titus"],
  Phlm: ["Флм", "Phlm"],
  Heb: ["Евр", "Heb"],
  Jas: ["Иак", "Jas"],
  "1Pet": ["1 Пет", "1 Pet"],
  "2Pet": ["2 Пет", "2 Pet"],
  "1John": ["1 Ин", "1 John"],
  "2John": ["2 Ин", "2 John"],
  "3John": ["3 Ин", "3 John"],
  Jude: ["Иуд", "Jude"],
  Rev: ["Откр", "Rev"],
};

export const NT_BOOKS: ReadonlySet<string> = new Set([
  "Matt",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Rom",
  "1Cor",
  "2Cor",
  "Gal",
  "Eph",
  "Phil",
  "Col",
  "1Thess",
  "2Thess",
  "1Tim",
  "2Tim",
  "Titus",
  "Phlm",
  "Heb",
  "Jas",
  "1Pet",
  "2Pet",
  "1John",
  "2John",
  "3John",
  "Jude",
  "Rev",
]);

interface Ref {
  readonly book: string;
  readonly chapter: number;
  readonly verse: number | null;
}

const OSIS_ONE = /^([1-3]?[A-Z][A-Za-z]+)\.([1-9]\d*)(?:\.([1-9]\d*))?$/;

function parseOne(osis: string): Ref {
  const m = OSIS_ONE.exec(osis);
  const [, book = "", chapter = "", verse] = m ?? [];
  if (!m || !(book in BOOKS)) throw new SyntaxError(`not an OSIS reference: "${osis}"`);
  const ref = { book, chapter: Number(chapter), verse: verse === undefined ? null : Number(verse) };
  // Every chapter and verse must exist (ADR 0007), in the English versification.
  const inChapter = VERSES[book]?.[ref.chapter - 1];
  if (inChapter === undefined || (ref.verse !== null && ref.verse > inChapter))
    throw new SyntaxError(`no such verse: "${osis}"`);
  return ref;
}

/** Chapter.verse as one comparable number (no chapter has 1000 verses). */
const position = (r: Ref) => r.chapter * 1000 + (r.verse ?? 0);

/**
 * "Acts.13.4" → "Деян 13:4"; "Acts.13.4-Acts.14.26" → "Деян 13:4–14:26".
 * In Russian the numbers are the Synodal ones ("Ps.68.15" → "Пс 67:16", synodal.ts);
 * the OSIS reference itself keeps the English numbering.
 */
export function formatRef(osis: string, locale: Locale): string {
  const parts = osis.split("-");
  if (parts.length > 2) throw new SyntaxError(`not an OSIS reference: "${osis}"`);
  const [startText, endText] = parts;
  const start = parseOne(startText ?? "");
  const books = BOOKS[start.book];
  if (!books) throw new SyntaxError(`unknown book in "${osis}"`);
  const name = locale === "ru" || locale === "uk" ? books[0] : books[1];
  const shown = (r: Ref) => (locale === "ru" ? toSynodal(r.book, r.chapter, r.verse) : r);
  const from = shown(start);
  const head = `${name} ${from.chapter}${from.verse === null ? "" : `:${from.verse}`}`;
  if (endText === undefined) return head;
  const end = parseOne(endText);
  if (end.book !== start.book) throw new SyntaxError(`cross-book range: "${osis}"`);
  // Both ends name verses, or both name whole chapters; the range runs forwards.
  if ((start.verse === null) !== (end.verse === null) || position(end) <= position(start))
    throw new SyntaxError(`not a forward range: "${osis}"`);
  const to = shown(end);
  const tail =
    to.chapter === from.chapter
      ? `${to.verse ?? ""}`
      : `${to.chapter}${to.verse === null ? "" : `:${to.verse}`}`;
  return `${head}–${tail}`;
}

/** Whether an OSIS verse or range ("Acts.13.1-Acts.13.3") contains one of `verses`. */
export function refCovers(ref: string, verses: ReadonlySet<string>): boolean {
  const at = (osis: string) => {
    const [book = "", c = "0", v] = osis.split(".");
    return { book, n: Number(c) * 1000 + (v === undefined ? 0 : Number(v)) };
  };
  const [first = "", last = first] = ref.split("-");
  const lo = at(first);
  const hiRef = at(last);
  // A whole-chapter end ("Acts.13") runs to the end of that chapter.
  const hi = last.split(".").length === 2 ? hiRef.n + 999 : hiRef.n;
  return [...verses].some((v) => {
    const p = at(v);
    return p.book === lo.book && p.n >= lo.n && p.n <= hi;
  });
}
