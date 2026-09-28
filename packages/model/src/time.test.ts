import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  centuryId,
  centuryOf,
  centuryRange,
  contains,
  formatYear,
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
  it("formats centuries for ids", () => {
    expect(centuryId(1, "AD")).toBe("c+01");
    expect(centuryId(10, "BC")).toBe("c-10");
  });

  it.each([
    ["586 BC", BC(586)],
    ["c. 1000 BC", BC(1000)],
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
  });
});
