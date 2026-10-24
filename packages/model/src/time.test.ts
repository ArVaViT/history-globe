import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ALL_LOCALES,
  centuryOf,
  centuryRange,
  contains,
  formatYear,
  formatCentury,
  isLocale,
  LOCALE_NAMES,
  LOCALES,
  isYearInput,
  parseYearInput,
  pick,
  placeName,
  formatYearRange,
  inclusiveRange,
  parseLabel,
  toAstronomical,
  toLabel,
  type YearLabel,
} from "./time.ts";

const BC = (year: number): YearLabel => ({ year, era: "BC" });
const AD = (year: number): YearLabel => ({ year, era: "AD" });

// Golden vectors from ADR 0003.
const GOLDEN: [YearLabel, number][] = [
  [AD(1), 1],
  [BC(1), 0],
  [BC(2), -1],
  [BC(4), -3],
  [BC(37), -36],
  [BC(63), -62],
  [BC(332), -331],
  [BC(539), -538],
  [BC(586), -585],
  [BC(587), -586],
  [BC(722), -721],
  [BC(1000), -999],
  [BC(1446), -1445],
  [BC(2000), -1999],
  [AD(30), 30],
  [AD(70), 70],
];

describe("toAstronomical / toLabel", () => {
  it.each(GOLDEN)("%o ↔ %i", (label, astro) => {
    expect(toAstronomical(label)).toBe(astro);
    expect(toLabel(astro)).toEqual(label);
  });

  it("round-trips every integer year", () => {
    fc.assert(
      fc.property(fc.integer({ min: -9999, max: 9999 }), (y) => toAstronomical(toLabel(y)) === y),
    );
  });

  it("rejects year zero and fractions in labels", () => {
    expect(() => toAstronomical(BC(0))).toThrow(RangeError);
    expect(() => toAstronomical(AD(1.5))).toThrow(RangeError);
    expect(() => toLabel(0.5)).toThrow(RangeError);
  });
});

describe("intervals", () => {
  it.each([
    ["1st century AD", centuryRange(1, "AD"), { from: 1, to: 101 }],
    ["1st century BC", centuryRange(1, "BC"), { from: -99, to: 1 }],
    ["10th century BC", centuryRange(10, "BC"), { from: -999, to: -899 }],
    ["Herod 37–4 BC", inclusiveRange(BC(37), BC(4)), { from: -36, to: -2 }],
    ["4 BC – AD 6", inclusiveRange(BC(4), AD(6)), { from: -3, to: 7 }],
  ])("%s", (_name, actual, expected) => {
    expect(actual).toEqual(expected);
  });

  it("includes the first and last written year of an inclusive range", () => {
    const herod = inclusiveRange(BC(37), BC(4));
    expect(contains(herod, toAstronomical(BC(37)))).toBe(true);
    expect(contains(herod, toAstronomical(BC(4)))).toBe(true);
    expect(contains(herod, toAstronomical(BC(3)))).toBe(false);
  });

  it("every year lies in exactly the century centuryOf reports", () => {
    fc.assert(
      fc.property(fc.integer({ min: -4000, max: 2100 }), (y) => {
        const c = centuryOf(y);
        return contains(centuryRange(c.n, c.era), y);
      }),
    );
  });
});

describe("labels and ids", () => {
  it.each([
    ["586 BC", BC(586)],
    ["c. 1000 BC", { ...BC(1000), approximate: true }],
    ["c. AD 47", { ...AD(47), approximate: true }],
    ["AD 30", AD(30)],
    ["30 AD", AD(30)],
    ["30 CE", AD(30)],
    ["1446 BCE", BC(1446)],
  ])("parses %s", (text, label) => {
    expect(parseLabel(text)).toEqual(label);
  });

  it("rejects ambiguous input", () => {
    expect(() => parseLabel("30")).toThrow(SyntaxError);
    expect(() => parseLabel("-30")).toThrow(SyntaxError);
  });

  it("formats years per locale", () => {
    expect(formatYear(-999, "ru")).toBe("1000 г. до н. э.");
    expect(formatYear(30, "ru")).toBe("30 г. н. э.");
    expect(formatYear(0, "en")).toBe("1 BC");
    expect(formatYear(30, "en")).toBe("AD 30");
    expect(formatYear(-3, "uk")).toBe("4 р. до н. е.");
    expect(formatYear(70, "de")).toBe("70 n. Chr.");
    expect(formatYear(-585, "it")).toBe("586 a.C.");
    expect(formatYear(-585, "nl")).toBe("586 v.Chr.");
    expect(formatYear(-585, "pl")).toBe("586 p.n.e.");
    expect(formatYear(-585, "cs")).toBe("586 př. n. l.");
    expect(formatYear(30, "cs")).toBe("30 n. l.");
    expect(formatYear(-585, "sv")).toBe("586 f.Kr.");
    expect(formatYear(30, "da")).toBe("30 e.Kr.");
    expect(formatYear(-585, "nb")).toBe("586 f.Kr.");
    expect(formatYear(-585, "sr")).toBe("586. п. н. е.");
    expect(formatYear(30, "sr")).toBe("30. н. е.");
    expect(formatYear(-585, "tl")).toBe("586 BK");
    expect(formatYear(30, "tl")).toBe("30 AD");
  });
});

describe("formatYearRange", () => {
  it("says a shared era once", () => {
    expect(formatYearRange(-1999, -1179, "ru")).toBe("2000–1180 г. до н. э.");
    expect(formatYearRange(-1999, -1179, "en")).toBe("2000–1180 BC");
    expect(formatYearRange(30, 70, "en")).toBe("AD 30–70");
    expect(formatYearRange(30, 70, "ru")).toBe("30–70 г. н. э.");
  });
  it("keeps both eras across the turn of the era", () => {
    expect(formatYearRange(-3, 30, "ru")).toBe("4 г. до н. э. – 30 г. н. э.");
  });
  it("writes the Serbian ordinal once, on the last year", () => {
    expect(formatYearRange(-1999, -1179, "sr")).toBe("2000–1180. п. н. е.");
    expect(formatYearRange(-1999, -1179, "sv")).toBe("2000–1180 f.Kr.");
  });
});

describe("formatCentury", () => {
  it("names the century in Roman numerals in Russian, as an ordinal in English", () => {
    expect(formatCentury(-1002, "ru")).toBe("XI в. до н. э.");
    expect(formatCentury(50, "ru")).toBe("I в. н. э.");
    expect(formatCentury(-1002, "en")).toBe("11th century BC");
    expect(formatCentury(1250, "en")).toBe("13th century AD");
    expect(formatCentury(-1899, "ru")).toBe("XIX в. до н. э.");
    expect(formatCentury(250, "en")).toBe("3rd century AD");
  });
});

describe("the site's languages", () => {
  it("knows its published locales and nothing else", () => {
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("cs")).toBe(true);
    expect(isLocale("zh")).toBe(false);
    // Wave 3: known to the code before the site publishes it.
    for (const l of ["sv", "da", "nb", "sr", "tl"]) expect(ALL_LOCALES, l).toContain(l);
    expect(isLocale(null)).toBe(false);
  });
});

describe("text in the reader's language", () => {
  it("picks the language's text, else the English", () => {
    expect(pick({ en: "Hill", ru: "Холм" }, "ru")).toBe("Холм");
    expect(pick({ en: "Hill", ru: "Холм" }, "uk")).toBe("Hill");
    expect(pick(undefined, "ru")).toBeUndefined();
  });
  it("names a place in the language it has a name in", () => {
    const bethel = { name: "Bethel", name_ru: "Вефиль" };
    expect(placeName(bethel, "ru")).toBe("Вефиль");
    expect(placeName(bethel, "en")).toBe("Bethel");
    expect(placeName({ name: "Bethel" }, "ru")).toBe("Bethel");
  });
});

describe("isYearInput", () => {
  it("takes a year and nothing else, in the site's languages", () => {
    for (const q of ["586 до н. э.", "30 г. н. э.", "AD 30", "-586", "586 BC", "586 B.C.", "30"])
      expect(isYearInput(q), q).toBe(true);
    for (const q of ["586 f.Kr.", "30 e.Kr.", "586. п. н. е.", "30. н. е.", "586 BK", "30 AD"])
      expect(isYearInput(q), q).toBe(true);
    for (const q of ["Деян 16", "Bethel", "586 до н. э. Иерусалим", ""])
      expect(isYearInput(q), q).toBe(false);
  });
});

describe("formatCentury in every language the code knows", () => {
  it("speaks the reader's language, not Russian by default", () => {
    expect(formatCentury(-585, "uk")).toBe("VI ст. до н. е.");
    expect(formatCentury(30, "de")).toBe("1. Jh. n. Chr.");
    expect(formatCentury(-585, "it")).toBe("VI secolo a.C.");
    expect(formatCentury(-585, "nl")).toBe("6e eeuw v.Chr.");
    expect(formatCentury(-585, "pl")).toBe("VI w. p.n.e.");
    expect(formatCentury(-585, "cs")).toBe("6. stol. př. n. l.");
  });
  it("counts the Nordic centuries by their hundreds, the first as an ordinal", () => {
    expect(formatCentury(-585, "sv")).toBe("500-talet f.Kr.");
    expect(formatCentury(150, "sv")).toBe("100-talet e.Kr.");
    expect(formatCentury(30, "sv")).toBe("1:a århundradet e.Kr.");
    expect(formatCentury(-585, "da")).toBe("500-tallet f.Kr.");
    expect(formatCentury(30, "da")).toBe("1. århundrede e.Kr.");
    expect(formatCentury(-585, "nb")).toBe("500-tallet f.Kr.");
    expect(formatCentury(30, "nb")).toBe("1. århundre e.Kr.");
  });
  it("speaks Serbian and Filipino", () => {
    expect(formatCentury(-585, "sr")).toBe("6. век п. н. е.");
    expect(formatCentury(30, "sr")).toBe("1. век н. е.");
    expect(formatCentury(-585, "tl")).toBe("ika-6 na siglo BK");
    expect(formatCentury(30, "tl")).toBe("unang siglo AD");
  });
});

describe("parseYearInput reads BC loosely", () => {
  it("takes «до нашей эры» and a cut-off «до н» as BC", () => {
    expect(parseYearInput("586 до нашей эры")).toBe(-585);
    expect(parseYearInput("586 до н")).toBe(-585);
    expect(parseYearInput("586 p.n.e.")).toBe(-585);
    expect(parseYearInput("586 př. n. l.")).toBe(-585);
    expect(parseYearInput("586 v.Chr.")).toBe(-585);
    expect(parseYearInput("30 n. l.")).toBe(30);
    expect(parseYearInput("586 f.Kr.")).toBe(-585);
    expect(parseYearInput("30 e.Kr.")).toBe(30);
    expect(parseYearInput("586. п. н. е.")).toBe(-585);
    expect(parseYearInput("30. н. е.")).toBe(30);
    expect(parseYearInput("586 BK")).toBe(-585);
    expect(parseYearInput("30 AD")).toBe(30);
  });
});

describe("LOCALES", () => {
  it("runs in the order of the languages' own names, none first for being the site's own", () => {
    const names = LOCALES.map((l) => LOCALE_NAMES[l]);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });
});
