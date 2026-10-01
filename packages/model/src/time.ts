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

/** Id fragment used in article ids and URLs: c+01, c-10. */
export function centuryId(n: number, era: Era): string {
  assertPositiveInteger(n, "century");
  return `c${era === "AD" ? "+" : "-"}${String(n).padStart(2, "0")}`;
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

export type Locale = "en" | "ru" | "uk" | "de";

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
