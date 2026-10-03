import { BOOKS } from "./scripture.ts";
import { VERSES } from "./versification.ts";

/** A run of chapters and its year, as content/chapter-years.yaml gives it. */
export interface ChapterYearRow {
  readonly chapters: string;
  readonly year: number;
  readonly approx?: boolean;
  readonly note?: string;
}

/** In the release: book → [first chapter, last chapter, year], in order. */
export type ChapterYears = Readonly<Record<string, readonly (readonly [number, number, number])[]>>;

/** The table checked and packed for the release; problems are returned, not thrown. */
export function packChapterYears(
  file: { readonly books: Readonly<Record<string, readonly ChapterYearRow[]>> },
  [min, max]: readonly [number, number],
): {
  table: ChapterYears;
  errors: string[];
} {
  const errors: string[] = [];
  const table: Record<string, [number, number, number][]> = {};
  for (const [book, rows] of Object.entries(file.books)) {
    const chapters = VERSES[book]?.length;
    if (!BOOKS[book] || chapters === undefined) {
      errors.push(`chapter-years: unknown book ${book}`);
      continue;
    }
    const runs = rows
      .map((r): [number, number, number] => {
        const [a = "0", b = a] = r.chapters.split("-");
        return [Number(a), Number(b), r.year];
      })
      .sort((x, y) => x[0] - y[0]);
    runs.forEach(([from, to, year], i) => {
      if (from < 1 || to < from || to > chapters)
        errors.push(`chapter-years: ${book} ${String(from)}-${String(to)} is not in the book`);
      if (year < min || year > max)
        errors.push(`chapter-years: ${book} ${String(from)} year ${String(year)} is off the map`);
      const prev = runs[i - 1];
      if (prev && prev[1] >= from)
        errors.push(`chapter-years: ${book} ${String(from)} overlaps the run before it`);
    });
    table[book] = runs;
  }
  return { table, errors };
}

/** The year of a verse or chapter ("1Sam.25.5", "Acts.16"), if its chapter is dated. */
export function yearOfRef(ref: string, table: ChapterYears): number | undefined {
  const [book = "", chapter = "0"] = (ref.split("-")[0] ?? "").split(".");
  const c = Number(chapter);
  return table[book]?.find(([from, to]) => c >= from && c <= to)?.[2];
}

/** The middle year of several references: where a person's verses mostly fall. */
export function medianYear(refs: readonly string[], table: ChapterYears): number | undefined {
  const years = refs
    .map((r) => yearOfRef(r, table))
    .filter((y): y is number => y !== undefined)
    .sort((a, b) => a - b);
  return years[Math.floor((years.length - 1) / 2)];
}
