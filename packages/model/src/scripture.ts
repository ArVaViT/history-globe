import { localeData } from "./locale-data.ts";
import type { Locale } from "./locales.ts";
import { fromSynodalChapter, synodalChapterEnd, toSynodal } from "./synodal.ts";
import { VERSES } from "./versification.ts";

/** The OSIS books, in the canon's order. */
const BOOK_IDS = [
  "Gen",
  "Exod",
  "Lev",
  "Num",
  "Deut",
  "Josh",
  "Judg",
  "Ruth",
  "1Sam",
  "2Sam",
  "1Kgs",
  "2Kgs",
  "1Chr",
  "2Chr",
  "Ezra",
  "Neh",
  "Esth",
  "Job",
  "Ps",
  "Prov",
  "Eccl",
  "Song",
  "Isa",
  "Jer",
  "Lam",
  "Ezek",
  "Dan",
  "Hos",
  "Joel",
  "Amos",
  "Obad",
  "Jonah",
  "Mic",
  "Nah",
  "Hab",
  "Zeph",
  "Hag",
  "Zech",
  "Mal",
  // In the Synodal Bible, not in the Protestant canon: marked wherever cited (DEUTEROCANON).
  "1Macc",
  "2Macc",
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
] as const;

/**
 * OSIS book id → its English abbreviation ("1Sam" → "1 Sam"). Other languages' own
 * abbreviations are in their data (locale-data.ts).
 */
export const BOOKS: Readonly<Record<string, string>> = Object.fromEntries(
  BOOK_IDS.map((b) => [b, b.replace(/^(\d)/, "$1 ")]),
);
const BOOK_INDEX: ReadonlyMap<string, number> = new Map(BOOK_IDS.map((b, i) => [b, i]));

/** Books the Synodal Bible carries outside the Hebrew canon: a citation says so. */
export const DEUTEROCANON: ReadonlySet<string> = new Set(["1Macc", "2Macc"]);

/** Whether a reference is to a book outside the Hebrew canon (1 Macc 4:36). */
export const isDeuterocanon = (osis: string): boolean => DEUTEROCANON.has(osis.split(".")[0] ?? "");

export const NT_BOOKS: ReadonlySet<string> = new Set(BOOK_IDS.slice(BOOK_IDS.indexOf("Matt")));

export interface Ref {
  readonly book: string;
  readonly chapter: number;
  readonly verse: number | null;
}

const OSIS_ONE = /^([1-3]?[A-Z][A-Za-z]+)\.([1-9]\d*)(?:\.([1-9]\d*))?$/;

/**
 * One OSIS verse or chapter ("Acts.13.4", "Ps.23"). Only the form is checked here; whether
 * the verse exists is checkRef's job (verses.ts).
 */
export function parseOne(osis: string): Ref {
  const m = OSIS_ONE.exec(osis);
  const [, book = "", chapter = "", verse] = m ?? [];
  if (!m || !(book in BOOKS)) throw new SyntaxError(`not an OSIS reference: "${osis}"`);
  return { book, chapter: Number(chapter), verse: verse === undefined ? null : Number(verse) };
}

/** Chapter.verse as one comparable number (no chapter has 1000 verses); a chapter is its verse 0. */
const position = (r: Ref) => r.chapter * 1000 + (r.verse ?? 0);

/** Where a reference starts in the order of the Bible, as one comparable number. */
export function canonicalPosition(osis: string): number {
  const r = parseOne(osis.split("-")[0] ?? "");
  return (BOOK_INDEX.get(r.book) ?? -1) * 1_000_000 + position(r);
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
 * A book's short name as a reader of `locale` reads it: the language's own abbreviation
 * where its data has one (locale-data.ts; in Russian the Synodal form), the English
 * otherwise. Undefined for an unknown book.
 */
export function bookName(book: string, locale: Locale): string | undefined {
  const en = BOOKS[book];
  if (en === undefined) return undefined;
  return localeData(locale)?.books?.[book] ?? en;
}

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
  const synodal = locale === "ru";
  const shown = (r: Ref) => (synodal ? toSynodal(r.book, r.chapter, r.verse) : r);
  const from = shown(start);
  const head = `${name} ${from.chapter}${from.verse === null ? "" : `:${from.verse}`}`;
  // A book outside the Hebrew canon (1-2 Maccabees) says so wherever it is cited.
  const mark = (s: string) =>
    DEUTEROCANON.has(start.book)
      ? `${s} (${localeData(locale)?.deutero ?? "deuterocanonical"})`
      : s;
  const end = endText === undefined ? undefined : parseOne(endText);
  if (end) {
    if (end.book !== start.book) throw new SyntaxError(`cross-book range: "${osis}"`);
    // Both ends name verses, or both name whole chapters; the range runs forwards.
    if ((start.verse === null) !== (end.verse === null) || position(end) <= position(start))
      throw new SyntaxError(`not a forward range: "${osis}"`);
  }
  const last = end ?? start;
  // A whole English psalm can be two Synodal ones (116 is 114–115): it ends with its last verse.
  const to =
    synodal && last.verse === null
      ? { chapter: synodalChapterEnd(last.book, last.chapter), verse: null }
      : shown(last);
  // One verse or chapter, or two English psalms that are one Synodal psalm (9-10, 114-115).
  if (to.chapter === from.chapter && to.verse === from.verse) return mark(head);
  const tail =
    to.chapter === from.chapter
      ? `${to.verse ?? ""}`
      : `${to.chapter}${to.verse === null ? "" : `:${to.verse}`}`;
  return mark(`${head}–${tail}`);
}

/** Whether an OSIS verse or range ("Acts.13.1-Acts.13.3") contains one of `verses`. */
export function refCovers(ref: string, verses: ReadonlySet<string>): boolean {
  const [first = "", last = first] = ref.split("-");
  const start = parseOne(first);
  const end = parseOne(last);
  const lo = position(start);
  // A whole-chapter end ("Acts.13") runs to the end of that chapter.
  const hi = position(end) + (end.verse === null ? 999 : 0);
  return [...verses].some((v) => {
    const r = parseOne(v);
    return r.book === start.book && position(r) >= lo && position(r) <= hi;
  });
}

/**
 * English book names that do not start with the abbreviation ("1 Kings" against "1 Kgs");
 * a language's own are in its data (locale-data.ts: the Russian Gospels in the genitive).
 * A key matches the word or the word with up to two more letters (a case ending).
 */
const BOOK_ALIASES: Readonly<Record<string, string>> = {
  "1 kings": "1Kgs",
  "2 kings": "2Kgs",
  "1 ki": "1Kgs",
  "2 ki": "2Kgs",
  "song of songs": "Song",
  "song of solomon": "Song",
  songs: "Song",
};

const aliasesIn = (locale: Locale): Readonly<Record<string, string>> => {
  const own = localeData(locale)?.aliases;
  return own ? { ...BOOK_ALIASES, ...own } : BOOK_ALIASES;
};

const aliasOf = (word: string, locale: Locale): string | undefined => {
  const aliases = aliasesIn(locale);
  if (aliases[word]) return aliases[word];
  const key = Object.keys(aliases)
    .filter((k) => word.startsWith(k) && word.length - k.length <= 2)
    .sort((x, y) => y.length - x.length)[0];
  return key === undefined ? undefined : aliases[key];
};

const norm = (s: string) =>
  s.toLowerCase().replaceAll("ё", "е").replaceAll(".", " ").replace(/\s+/g, " ").trim();

/** Latin letters without their accents ("Génesis" typed "genesis"); Cyrillic left whole (й). */
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/(?<=[a-z])[\u0300-\u036f]+/g, "")
    .normalize("NFC");

/**
 * The forms a book is typed as in `locale`: its English abbreviation and OSIS code, which
 * work in every language, and the language's own abbreviation and full names.
 */
const formsIn = (osis: string, en: string, locale: Locale): string[] => {
  const data = localeData(locale);
  return [
    norm(en),
    norm(osis.replace(/^(\d)/, "$1 ")),
    ...[data?.books?.[osis], ...(data?.bookNames?.[osis] ?? [])].flatMap((x) =>
      x ? [plain(norm(x))] : [],
    ),
  ];
};

/**
 * A whole book typed exactly as its name or abbreviation ("Деян", "Деяния", "Acts", "Руфь"):
 * the OSIS book and its label. Only an exact form counts, so a place being typed ("Иер…"
 * on the way to «Иерусалим») is not taken for a book.
 */
function parseBook(typed: string, locale: Locale): { ref: string; label: string } | null {
  const word = typed.replace(/^(\d) ?/, "$1 ").trim();
  let book: string | undefined = aliasesIn(locale)[word];
  if (!book) {
    for (const [osis, en] of Object.entries(BOOKS)) {
      if (formsIn(osis, en, locale).includes(word)) book = osis;
    }
  }
  if (!book || BOOKS[book] === undefined) return null;
  return { ref: book, label: bookName(book, locale) ?? book };
}

/**
 * A chapter typed as a search ("Деян 16", "1 Цар 17", "Acts 16", "Пс 22", "от Иоанна 3"):
 * the OSIS reference of what it covers in English numbering, and the label as typed.
 * A Synodal chapter that is part of an English one is a verse range (Пс 115 →
 * Ps.116.10-Ps.116.19), one that spans two English ones a chapter range (Пс 9 →
 * Ps.9-Ps.10). Null when the text is not a chapter.
 */
export function parseChapter(text: string, locale: Locale): { ref: string; label: string } | null {
  const query = plain(norm(text));
  const prefix = localeData(locale)?.bookPrefixes?.find((p) => query.startsWith(`${p} `));
  const typed = prefix === undefined ? query : query.slice(prefix.length + 1);
  const book0 = parseBook(typed, locale);
  if (book0) return book0;
  // A verse after the chapter ("Acts 16:12", «Деян 16:12-15») opens the chapter.
  // Letters of any language («Дії 16», "Génesis 12", "Cantar de los Cantares 2"); the verse
  // after a colon or, as German and French write it, a comma ("Apg 16,12", "Ac 16, 12").
  const m =
    /^(\d?\s?[\p{L}’']+(?:\s[\p{L}’']+){0,3})\s?(\d{1,3})(?:(?::|,\s?)\d{1,3}(?:[-–]\d{1,3})?)?$/u.exec(
      typed,
    );
  if (!m) return null;
  const word = (m[1] ?? "").replace(/^(\d) ?/, "$1 ").trim();
  const n = Number(m[2]);
  let book: string | undefined = aliasOf(word, locale);
  let best = 0;
  if (!book) {
    for (const [osis, en] of Object.entries(BOOKS)) {
      for (const abbr of formsIn(osis, en, locale)) {
        const fits = word === abbr || (abbr.length >= 2 && word.startsWith(abbr));
        if (fits && abbr.length > best) {
          best = abbr.length;
          book = osis;
        }
      }
    }
  }
  const lengths = book === undefined ? undefined : VERSES[book];
  if (!book || !lengths) return null;
  const label = `${bookName(book, locale) ?? book} ${String(n)}`;
  // Outside Russian, and a book named in English in Russian ("Psalm 23"), the chapter is
  // counted the English way; in Russian the label then gives the Synodal number («Пс 22»).
  if (locale !== "ru" || /[a-z]/.test(word)) {
    if (n < 1 || n > lengths.length) return null;
    const ru = `${bookName(book, "ru") ?? book} ${String(toSynodal(book, n, 1).chapter)}`;
    return { ref: `${book}.${String(n)}`, label: locale === "ru" ? ru : label };
  }
  // In Russian the number is the Synodal chapter: the English verses shown in it.
  const ref = fromSynodalChapter(book, n);
  return ref === null ? null : { ref, label };
}
