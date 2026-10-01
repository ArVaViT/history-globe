import { inclusiveRange, type YearRange } from "./time.ts";

/**
 * Eras for the time slider, Southern Levant, mainstream Israeli scheme (Mazar, NEAEHL).
 * All boundaries are approximate; where chronology is disputed the era says so.
 */
export interface Period {
  readonly id: string;
  readonly range: YearRange;
  readonly name: { readonly en: string; readonly ru: string };
  readonly disputed?: { readonly en: string; readonly ru: string };
}

const bc = (year: number) => ({ year, era: "BC" as const });
const ad = (year: number) => ({ year, era: "AD" as const });

export const PERIODS: readonly Period[] = [
  {
    id: "mb2",
    range: inclusiveRange(bc(2000), bc(1551)),
    name: { en: "Middle Bronze II", ru: "Средняя бронза II" },
    disputed: { en: "dating of the patriarchs", ru: "датировка патриархов" },
  },
  {
    id: "lb",
    range: inclusiveRange(bc(1550), bc(1201)),
    name: { en: "Late Bronze", ru: "Поздняя бронза" },
    disputed: { en: "early or late Exodus", ru: "ранний или поздний Исход" },
  },
  {
    id: "iron1",
    range: inclusiveRange(bc(1200), bc(1001)),
    name: { en: "Iron I", ru: "Железный век I" },
  },
  {
    id: "iron2a",
    range: inclusiveRange(bc(1000), bc(831)),
    name: { en: "Iron IIA", ru: "Железный век IIA" },
    disputed: { en: "high or low chronology", ru: "высокая или низкая хронология" },
  },
  {
    id: "iron2b",
    range: inclusiveRange(bc(830), bc(702)),
    name: { en: "Iron IIB", ru: "Железный век IIB" },
  },
  {
    id: "iron2c",
    range: inclusiveRange(bc(701), bc(587)),
    name: { en: "Iron IIC", ru: "Железный век IIC" },
  },
  {
    id: "babylonian",
    range: inclusiveRange(bc(586), bc(540)),
    name: { en: "Babylonian", ru: "Вавилонский период" },
  },
  {
    id: "persian",
    range: inclusiveRange(bc(539), bc(333)),
    name: { en: "Persian", ru: "Персидский период" },
  },
  {
    id: "hellenistic",
    range: inclusiveRange(bc(332), bc(168)),
    name: { en: "Hellenistic", ru: "Эллинистический период" },
  },
  {
    id: "hasmonean",
    range: inclusiveRange(bc(167), bc(64)),
    name: { en: "Hasmonean", ru: "Хасмонейский период" },
  },
  {
    id: "early-roman",
    range: inclusiveRange(bc(63), ad(70)),
    name: { en: "Early Roman", ru: "Раннеримский период" },
  },
  {
    id: "roman",
    range: inclusiveRange(ad(71), ad(100)),
    name: { en: "Roman", ru: "Римский период" },
  },
];

export function periodAt(year: number): Period | undefined {
  return PERIODS.find((p) => year >= p.range.from && year < p.range.to);
}
