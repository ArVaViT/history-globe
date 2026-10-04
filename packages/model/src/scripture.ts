import type { Locale } from "./time.ts";
import { toSynodal } from "./synodal.ts";
import { VERSES } from "./versification.ts";

/** OSIS book id → [Russian Synodal abbreviation, English abbreviation]. */
export const BOOKS: Readonly<Record<string, readonly [string, string]>> = {
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
  // In the Synodal Bible, not in the Protestant canon: marked wherever cited (DEUTEROCANON).
  "1Macc": ["1 Мак", "1 Macc"],
  "2Macc": ["2 Мак", "2 Macc"],
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

/** Books the Synodal Bible carries outside the Hebrew canon: a citation says so. */
export const DEUTEROCANON: ReadonlySet<string> = new Set(["1Macc", "2Macc"]);

/** Whether a reference is to a book outside the Hebrew canon (1 Macc 4:36). */
export const isDeuterocanon = (osis: string): boolean => DEUTEROCANON.has(osis.split(".")[0] ?? "");

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

export interface Ref {
  readonly book: string;
  readonly chapter: number;
  readonly verse: number | null;
}

const OSIS_ONE = /^([1-3]?[A-Z][A-Za-z]+)\.([1-9]\d*)(?:\.([1-9]\d*))?$/;

/**
 * One OSIS verse or chapter ("Acts.13.4", "Ps.23"). Only the form is checked here;
 * whether the verse exists is checkRef's job (verses.ts), at build time, so the verse
 * table stays out of the browser (ADR 0010).
 */
export function parseOne(osis: string): Ref {
  const m = OSIS_ONE.exec(osis);
  const [, book = "", chapter = "", verse] = m ?? [];
  if (!m || !(book in BOOKS)) throw new SyntaxError(`not an OSIS reference: "${osis}"`);
  return { book, chapter: Number(chapter), verse: verse === undefined ? null : Number(verse) };
}

/** Chapter.verse as one comparable number (no chapter has 1000 verses). */
const position = (r: Ref) => r.chapter * 1000 + (r.verse ?? 0);

/**
 * Where a reference starts in the order of the Bible, as one comparable number. For the
 * build only; the book order is taken inside, so nothing is left in the browser bundle.
 */
export function canonicalPosition(osis: string): number {
  const r = parseOne(osis.split("-")[0] ?? "");
  return Object.keys(BOOKS).indexOf(r.book) * 1_000_000 + position(r);
}

/** A reference as formatRef writes it, or the OSIS text itself when it cannot be read. */
export function formatRefOr(osis: string, locale: Locale): string {
  try {
    return formatRef(osis, locale);
  } catch {
    return osis;
  }
}

/**
 * A book's short name as a reader of `locale` reads it: the Synodal form in Russian (and in
 * Ukrainian until it has its own), the English otherwise. Undefined for an unknown book.
 */
export function bookName(book: string, locale: Locale): string | undefined {
  const names = BOOKS[book];
  if (!names) return undefined;
  return locale === "ru" || locale === "uk" ? names[0] : names[1];
}

/** How a book outside the Hebrew canon is marked, by language. */
const DEUTERO_MARK: Readonly<Partial<Record<Locale, string>>> = {
  en: "deuterocanonical",
  ru: "неканоническая книга",
  uk: "неканонічна книга",
};

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
  const name = bookName(start.book, locale);
  if (name === undefined) throw new SyntaxError(`unknown book in "${osis}"`);
  const shown = (r: Ref) => (locale === "ru" ? toSynodal(r.book, r.chapter, r.verse) : r);
  const from = shown(start);
  const head = `${name} ${from.chapter}${from.verse === null ? "" : `:${from.verse}`}`;
  // A book outside the Hebrew canon (1-2 Maccabees) says so wherever it is cited.
  const mark = (s: string) =>
    DEUTEROCANON.has(start.book) ? `${s} (${DEUTERO_MARK[locale] ?? DEUTERO_MARK.en ?? ""})` : s;
  if (endText === undefined) return mark(head);
  const end = parseOne(endText);
  if (end.book !== start.book) throw new SyntaxError(`cross-book range: "${osis}"`);
  // Both ends name verses, or both name whole chapters; the range runs forwards.
  if ((start.verse === null) !== (end.verse === null) || position(end) <= position(start))
    throw new SyntaxError(`not a forward range: "${osis}"`);
  const to = shown(end);
  // Two English psalms that are one Synodal psalm (9-10, 114-115).
  if (to.chapter === from.chapter && to.verse === from.verse) return mark(head);
  const tail =
    to.chapter === from.chapter
      ? `${to.verse ?? ""}`
      : `${to.chapter}${to.verse === null ? "" : `:${to.verse}`}`;
  return mark(`${head}–${tail}`);
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

/** Full names readers type that do not start with the abbreviation (Иоанн, Матфей). */
/**
 * Book names as people type them, beyond the abbreviations: the Gospels in the genitive
 * («от Иоанна», «Матфея 5»). A key matches the word or the word with up to two more
 * letters (a case ending).
 */
const BOOK_ALIASES: Readonly<Record<string, string>> = {
  матфе: "Matt",
  матф: "Matt",
  марк: "Mark",
  лук: "Luke",
  иоанн: "John",
  псалом: "Ps",
  псалтирь: "Ps",
  "иисус навин": "Josh",
  "иисуса навина": "Josh",
  иисус: "Josh",
  есфирь: "Esth",
  экклесиаст: "Eccl",
  екклесиаст: "Eccl",
  песнь: "Song",
  исаи: "Isa",
  иезекиил: "Ezek",
  // English names that do not start with the abbreviation ("1 Kings" against "1 Kgs").
  "1 kings": "1Kgs",
  "2 kings": "2Kgs",
  "1 ki": "1Kgs",
  "2 ki": "2Kgs",
  "song of songs": "Song",
  "song of solomon": "Song",
  songs: "Song",
};

const aliasOf = (word: string): string | undefined => {
  if (BOOK_ALIASES[word]) return BOOK_ALIASES[word];
  const key = Object.keys(BOOK_ALIASES)
    .filter((k) => word.startsWith(k) && word.length - k.length <= 2)
    .sort((x, y) => y.length - x.length)[0];
  return key === undefined ? undefined : BOOK_ALIASES[key];
};

const norm = (s: string) =>
  s.toLowerCase().replaceAll("ё", "е").replaceAll(".", " ").replace(/\s+/g, " ").trim();

/**
 * A whole book typed exactly as its name or abbreviation ("Деян", "Деяния", "Acts", "Руфь"):
 * the OSIS book and its label. Only an exact form counts, so a place being typed ("Иер…"
 * on the way to «Иерусалим») is not taken for a book.
 */
function parseBook(typed: string, locale: Locale): { ref: string; label: string } | null {
  const word = typed.replace(/^(\d) ?/, "$1 ").trim();
  let book: string | undefined = BOOK_ALIASES[word];
  if (!book) {
    for (const [osis, [ru, en]] of Object.entries(BOOKS)) {
      if ([norm(ru), norm(en), norm(osis.replace(/^(\d)/, "$1 "))].includes(word)) book = osis;
    }
  }
  const names = book === undefined ? undefined : BOOKS[book];
  if (!book || !names) return null;
  return { ref: book, label: bookName(book, locale === "ru" ? "ru" : "en") ?? book };
}

/**
 * A chapter typed as a search ("Деян 16", "1 Цар 17", "Acts 16", "Пс 22", "от Иоанна 3"):
 * the OSIS reference of what it covers in English numbering, and the label as typed.
 * A Synodal chapter that is part of an English one is a verse range (Пс 115 →
 * Ps.116.10-Ps.116.19), one that spans two English ones a chapter range (Пс 9 →
 * Ps.9-Ps.10). Null when the text is not a chapter.
 */
export function parseChapter(text: string, locale: Locale): { ref: string; label: string } | null {
  const typed = norm(text).replace(/^(евангелие )?от /, "");
  const book0 = parseBook(typed, locale);
  if (book0) return book0;
  // A verse after the chapter ("Acts 16:12", «Деян 16:12-15») opens the chapter.
  const m = /^(\d?\s?[a-zа-я]+(?:\s[a-zа-я]+){0,2})\s?(\d{1,3})(?::\d{1,3}(?:[-–]\d{1,3})?)?$/.exec(
    typed,
  );
  if (!m) return null;
  const word = (m[1] ?? "").replace(/^(\d) ?/, "$1 ").trim();
  const n = Number(m[2]);
  let book: string | undefined = aliasOf(word);
  let best = 0;
  if (!book) {
    for (const [osis, [ru, en]] of Object.entries(BOOKS)) {
      for (const abbr of [norm(ru), norm(en), norm(osis.replace(/^(\d)/, "$1 "))]) {
        const fits = word === abbr || (abbr.length >= 2 && word.startsWith(abbr));
        if (fits && abbr.length > best) {
          best = abbr.length;
          book = osis;
        }
      }
    }
  }
  const books = book === undefined ? undefined : BOOKS[book];
  const lengths = book === undefined ? undefined : VERSES[book];
  if (!book || !books || !lengths) return null;
  const label = `${bookName(book, locale === "ru" ? "ru" : "en") ?? book} ${String(n)}`;
  // A book named in English ("Psalm 23") is counted the English way, in either language:
  // the label then gives the Synodal number («Пс 22»).
  if (locale !== "ru" || /[a-z]/.test(word)) {
    if (n < 1 || n > lengths.length) return null;
    const ru = `${bookName(book, "ru") ?? book} ${String(toSynodal(book, n, 1).chapter)}`;
    return { ref: `${book}.${String(n)}`, label: locale === "ru" ? ru : label };
  }
  // In Russian the number is the Synodal chapter: the English verses shown in it.
  const verses: [number, number][] = [];
  lengths.forEach((count, i) => {
    for (let v = 1; v <= count; v++)
      if (toSynodal(book, i + 1, v).chapter === n) verses.push([i + 1, v]);
  });
  const first = verses[0];
  const last = verses.at(-1);
  if (!first || !last) return null;
  const whole = first[1] === 1 && last[1] === lengths[last[0] - 1];
  const at = (c: number, v?: number) =>
    `${book}.${String(c)}${v === undefined ? "" : `.${String(v)}`}`;
  const ref = whole
    ? first[0] === last[0]
      ? at(first[0])
      : `${at(first[0])}-${at(last[0])}`
    : `${at(first[0], first[1])}-${at(last[0], last[1])}`;
  return { ref, label };
}
