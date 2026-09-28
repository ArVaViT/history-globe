import type { Locale } from "./time.ts";

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

function parseOne(osis: string): Ref {
  const [book = "", chapter, verse] = osis.split(".");
  if (!(book in BOOKS) || chapter === undefined)
    throw new SyntaxError(`not an OSIS reference: "${osis}"`);
  return { book, chapter: Number(chapter), verse: verse === undefined ? null : Number(verse) };
}

/**
 * "Acts.13.4" → "Деян 13:4"; "Acts.13.4-Acts.14.26" → "Деян 13:4–14:26".
 * Psalm numbers stay in the Hebrew (OSIS) numbering; the Synodal numbering differs and
 * is converted elsewhere, never silently.
 */
export function formatRef(osis: string, locale: Locale): string {
  const [startText, endText] = osis.split("-");
  const start = parseOne(startText ?? "");
  const books = BOOKS[start.book];
  if (!books) throw new SyntaxError(`unknown book in "${osis}"`);
  const name = locale === "ru" || locale === "uk" ? books[0] : books[1];
  const head = `${name} ${start.chapter}${start.verse === null ? "" : `:${start.verse}`}`;
  if (endText === undefined) return head;
  const end = parseOne(endText);
  if (end.book !== start.book) throw new SyntaxError(`cross-book range: "${osis}"`);
  const tail =
    end.chapter === start.chapter
      ? `${end.verse ?? ""}`
      : `${end.chapter}${end.verse === null ? "" : `:${end.verse}`}`;
  return `${head}–${tail}`;
}
