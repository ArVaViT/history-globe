import { localeData } from "./locale-data.ts";
import { BOOKS, formatRef } from "./scripture.ts";
import { escapeRegExp } from "./text.ts";
import type { Locale } from "./locales.ts";

// English abbreviation → OSIS book, longest first ("1 John" before "John").
const BY_ABBR = new Map(Object.entries(BOOKS).map(([osis, en]) => [en, osis]));
const VERSE_REF = new RegExp(
  `\\b(${[...BY_ABBR.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")}) (\\d+):(\\d+)(?:[-–](\\d+)(?::(\\d+))?)?`,
  "g",
);

const WORK_PATTERNS = new WeakMap<object, readonly (readonly [RegExp, string])[]>();
const worksIn = (locale: Locale): readonly (readonly [RegExp, string])[] => {
  const works = localeData(locale)?.works;
  if (!works) return [];
  let patterns = WORK_PATTERNS.get(works);
  if (!patterns) {
    patterns = works.map(([en, own]) => [new RegExp(`\\b${escapeRegExp(en)}\\b`, "g"), own]);
    WORK_PATTERNS.set(works, patterns);
  }
  return patterns;
};

/** Bible references in the Synodal books and numbering: "2 Kgs 25:8-10" → "4 Цар 25:8–10". */
const synodalRefs = (text: string): string =>
  text.replace(VERSE_REF, (whole, abbr: string, c: string, v: string, a?: string, b?: string) => {
    const book = BY_ABBR.get(abbr);
    if (!book) return whole;
    const end =
      a === undefined ? "" : b === undefined ? `-${book}.${c}.${a}` : `-${book}.${a}.${b}`;
    try {
      return formatRef(`${book}.${c}.${v}${end}`, "ru");
    } catch {
      return whole;
    }
  });

/**
 * A source line as a reader of `locale` reads it: the ancient works by the language's own
 * names (its file in ./locales) and, in Russian, the Bible references in the Synodal books
 * and numbering. Anything not recognised is left as written.
 */
export function localizeCitation(text: string, locale: Locale): string {
  let out = locale === "ru" ? synodalRefs(text) : text;
  for (const [re, own] of worksIn(locale)) out = out.replace(re, own);
  return out;
}

/**
 * A list of sources as a reader of `locale` reads them: the build's Russian where it has it,
 * and in the other languages the site's own lines translated (content/sources-own.yaml).
 */
export function sourcesOf(
  x: {
    readonly sources: readonly string[];
    readonly sources_ru?: readonly string[];
    readonly sources_in?: Readonly<Partial<Record<Locale, readonly string[]>>>;
  },
  locale: Locale,
): string[] {
  if (locale === "ru" && x.sources_ru) return [...x.sources_ru];
  const own = x.sources_in?.[locale];
  return (own ?? x.sources).map((s) => localizeCitation(s, locale));
}
