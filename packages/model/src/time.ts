/**
 * Time model (ADR 0003). All years are astronomical integers: 1 BC = 0, 2 BC = -1,
 * AD 1 = 1. Intervals are half-open [from, to). Conversion to "BC/AD" labels happens
 * only here. JavaScript Date is never used for historical years.
 */

export type Era = "BC" | "AD";

export interface YearLabel {
  /** Positive year number as a historian writes it. */
  readonly year: number;
  readonly era: Era;
  /** "c. 586 BC": the source gives the year as approximate. */
  readonly approximate?: true;
}

/** Half-open interval of astronomical years. */
export interface YearRange {
  readonly from: number;
  readonly to: number;
}

function assertPositiveInteger(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`${what} must be a positive integer, got ${n}`);
  }
}

export function toAstronomical(label: YearLabel): number {
  assertPositiveInteger(label.year, "year");
  return label.era === "AD" ? label.year : 1 - label.year;
}

export function toLabel(year: number): YearLabel {
  if (!Number.isInteger(year)) throw new RangeError(`year must be an integer, got ${year}`);
  return year >= 1 ? { year, era: "AD" } : { year: 1 - year, era: "BC" };
}

/** Both years inclusive, as historians write "37–4 BC", to a half-open range. */
export function inclusiveRange(first: YearLabel, last: YearLabel): YearRange {
  const from = toAstronomical(first);
  const to = toAstronomical(last) + 1;
  if (to <= from) throw new RangeError("range ends before it starts");
  return { from, to };
}

export function contains(range: YearRange, year: number): boolean {
  return year >= range.from && year < range.to;
}

/** Century number as a historian counts it: 1st century AD = { n: 1, era: "AD" }. */
export function centuryOf(year: number): { readonly n: number; readonly era: Era } {
  const { year: y, era } = toLabel(year);
  return { n: Math.ceil(y / 100), era };
}

/** 1st century AD = [1, 101); 1st century BC = [-99, 1); 10th century BC = [-999, -899). */
export function centuryRange(n: number, era: Era): YearRange {
  assertPositiveInteger(n, "century");
  return era === "AD"
    ? inclusiveRange({ year: (n - 1) * 100 + 1, era: "AD" }, { year: n * 100, era: "AD" })
    : inclusiveRange({ year: n * 100, era: "BC" }, { year: (n - 1) * 100 + 1, era: "BC" });
}

const LABEL_RE =
  /^\s*(c\.\s*)?(\d{1,5})\s*(BC|BCE|AD|CE)\s*$|^\s*(c\.\s*)?(?:AD|CE)\s*(\d{1,5})\s*$/i;

/**
 * Parses "1000 BC", "c. 586 BC", "AD 30", "c. AD 30", "30 AD", "30 CE". Rejects bare
 * numbers. "c." is kept as `approximate`, never dropped.
 */
export function parseLabel(text: string): YearLabel {
  const m = LABEL_RE.exec(text);
  if (!m) throw new SyntaxError(`not a year label: "${text}" (write e.g. "586 BC" or "AD 30")`);
  const approx = m[1] !== undefined || m[4] !== undefined ? { approximate: true as const } : {};
  if (m[5] !== undefined) return { year: Number(m[5]), era: "AD", ...approx };
  const era: Era = /^(BC|BCE)$/i.test(m[3] ?? "") ? "BC" : "AD";
  return { year: Number(m[2]), era, ...approx };
}

/** The languages the code can format years and references in. */
export type Locale = "en" | "ru" | "uk" | "de";

/**
 * The languages the site is published in: the app's language switch, the static pages, the
 * documentation and the text-places script follow this list. A language joins it with its
 * interface file (apps/web/src/i18n) and its names and texts in the content.
 */
export const LOCALES = ["ru", "en"] as const satisfies readonly Locale[];
export type SiteLocale = (typeof LOCALES)[number];
/** Each language by its own name, for the language switch. */
export const LOCALE_NAMES: Readonly<Record<SiteLocale, string>> = { ru: "Русский", en: "English" };
export const isLocale = (s: unknown): s is SiteLocale =>
  typeof s === "string" && (LOCALES as readonly string[]).includes(s);

export function formatYear(year: number, locale: Locale): string {
  const { year: y, era } = toLabel(year);
  switch (locale) {
    case "ru":
      return era === "AD" ? `${y} г. н. э.` : `${y} г. до н. э.`;
    case "uk":
      return era === "AD" ? `${y} р. н. е.` : `${y} р. до н. е.`;
    case "de":
      return era === "AD" ? `${y} n. Chr.` : `${y} v. Chr.`;
    case "en":
      return era === "AD" ? `AD ${y}` : `${y} BC`;
  }
}

const ROMAN: readonly (readonly [number, string])[] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];
const roman = (n: number): string => {
  let out = "";
  let rest = n;
  for (const [v, r] of ROMAN)
    while (rest >= v) {
      out += r;
      rest -= v;
    }
  return out;
};
const ordinal = (n: number): string => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${String(n)}${suffix}`;
};

/** The century a year falls in: "XI в. до н. э.", "11th century BC", "I в. н. э.". */
export function formatCentury(year: number, locale: Locale): string {
  const { n, era } = centuryOf(year);
  switch (locale) {
    case "en":
      return `${ordinal(n)} century${era === "BC" ? " BC" : " AD"}`;
    case "uk":
      return `${roman(n)} ст.${era === "BC" ? " до н. е." : " н. е."}`;
    case "de":
      return `${String(n)}. Jh.${era === "BC" ? " v. Chr." : " n. Chr."}`;
    default:
      return `${roman(n)} в.${era === "BC" ? " до н. э." : " н. э."}`;
  }
}

/**
 * A span of years, the era said once when both ends share it: "2000–1180 г. до н. э.",
 * "2000–1180 BC", "AD 30–70"; across the eras each end keeps its own.
 */
export function formatYearRange(from: number, to: number, locale: Locale): string {
  const a = toLabel(from);
  const b = toLabel(to);
  if (a.era !== b.era) return `${formatYear(from, locale)} – ${formatYear(to, locale)}`;
  const tail = formatYear(to, locale);
  if (locale === "en" && a.era === "AD") return `AD ${String(a.year)}–${String(b.year)}`;
  return `${String(a.year)}–${tail}`;
}

/**
 * The states of the first frame end here (AD 500); the later ones ship apart and load
 * when the slider first passes it (scripts/build-content.ts, MapLibreRenderer).
 */
export const POLITY_SPLIT_YEAR = 500;

/**
 * "Before" and "after" Christ as readers write them after a year, in every language the code
 * formats: до н. э. / до н. е. / до Р. Х., BC / BCE / B.C., v. Chr.; н. э. / н. е., AD,
 * n. Chr.
 */
const BC_WORDS = String.raw`до\s*н\.?\s*[эе]\.?|до\s*р\.?\s*х\.?|b\.?\s*c\.?\s*e?\.?|v\.\s*chr\.?`;
const AD_WORDS = String.raw`н\.?\s*[эе]\.?|a\.?\s*d\.?|n\.\s*chr\.?`;

/**
 * A year as a reader types it, as an astronomical year: "586 до н. э.", "586 BC", "-586"
 * are 1 - 586; "30", "AD 30", "30 н. э." are AD 30. Null if no year.
 */
export function parseYearInput(text: string): number | null {
  const t = text.trim().toLowerCase();
  const m = /(\d{1,4})/.exec(t);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  if (n === 0) return null;
  // Loose on purpose: «586 до нашей эры», «586 до н» are BC too.
  const bc = t.startsWith("-") || /до\s*н|до\s*р|b\.?\s*c|v\.\s*chr/.test(t);
  return bc ? 1 - n : n;
}

/** Whether a query is a year and nothing else ("586 до н. э.", "AD 30", "-586"). */
export function isYearInput(text: string): boolean {
  return new RegExp(
    String.raw`^\s*(ad\s*)?-?\d{1,4}\s*(г\.?|год[а-я]*|р\.?|рік)?\s*(${BC_WORDS}|${AD_WORDS})?\s*$`,
    "i",
  ).test(text);
}

/** A text in the reader's language, or the English one. */
export function pick<T>(
  texts: Readonly<Partial<Record<string, T>>> | undefined,
  locale: string,
): T | undefined {
  return texts?.[locale] ?? texts?.en;
}

/**
 * A place's (or a state's) name in the reader's language: its `name_<language>` where the
 * data has one, else the English `name`.
 */
export function placeName(p: { readonly name: string }, locale: string): string {
  const own = (p as Readonly<Record<string, unknown>>)[`name_${locale}`];
  return typeof own === "string" ? own : p.name;
}

/** All of a place's names, in English and in every site language the data has one in. */
export function namesOf(p: { readonly name: string }): string[] {
  const own = p as Readonly<Record<string, unknown>>;
  return [
    p.name,
    ...LOCALES.map((l) => own[`name_${l}`]).filter((n): n is string => typeof n === "string"),
  ];
}

/** Whether a place has its own name in a language (English always). */
export function hasNameIn(p: { readonly name: string }, locale: string): boolean {
  return (
    locale === "en" ||
    typeof (p as Readonly<Record<string, unknown>>)[`name_${locale}`] === "string"
  );
}
