import { inclusiveRange, type YearRange } from "./time.ts";

/**
 * Eras for the time slider, Southern Levant, mainstream Israeli scheme (Mazar, NEAEHL).
 * All boundaries are approximate; where chronology is disputed the era says so.
 */
export interface Period {
  readonly id: string;
  readonly range: YearRange;
  /** In English; the other languages' names are in their data (period-names.ts). */
  readonly name: string;
  readonly disputed?: string;
}

const bc = (year: number) => ({ year, era: "BC" as const });
const ad = (year: number) => ({ year, era: "AD" as const });

export const PERIODS: readonly Period[] = [
  {
    id: "eb1",
    range: inclusiveRange(bc(3500), bc(3051)),
    name: "Early Bronze I",
  },
  {
    id: "eb2",
    range: inclusiveRange(bc(3050), bc(2701)),
    name: "Early Bronze II",
  },
  {
    id: "eb3",
    range: inclusiveRange(bc(2700), bc(2301)),
    name: "Early Bronze III",
  },
  {
    id: "eb4",
    range: inclusiveRange(bc(2300), bc(2001)),
    name: "Early Bronze IV",
  },
  {
    id: "mb2",
    range: inclusiveRange(bc(2000), bc(1551)),
    name: "Middle Bronze II",
    disputed: "The patriarchs' dates are disputed",
  },
  {
    id: "lb",
    range: inclusiveRange(bc(1550), bc(1201)),
    name: "Late Bronze",
    disputed: "Exodus: c. 1446 or c. 1270 BC",
  },
  {
    id: "iron1",
    range: inclusiveRange(bc(1200), bc(1001)),
    name: "Iron I",
  },
  {
    id: "iron2a",
    range: inclusiveRange(bc(1000), bc(831)),
    name: "Iron IIA",
    disputed: "Its archaeological dates are disputed",
  },
  {
    id: "iron2b",
    range: inclusiveRange(bc(830), bc(702)),
    name: "Iron IIB",
  },
  {
    id: "iron2c",
    range: inclusiveRange(bc(701), bc(587)),
    name: "Iron IIC",
  },
  {
    id: "babylonian",
    range: inclusiveRange(bc(586), bc(540)),
    name: "Babylonian",
  },
  {
    id: "persian",
    range: inclusiveRange(bc(539), bc(333)),
    name: "Persian",
  },
  {
    id: "hellenistic",
    range: inclusiveRange(bc(332), bc(168)),
    name: "Hellenistic",
  },
  {
    id: "hasmonean",
    range: inclusiveRange(bc(167), bc(64)),
    name: "Hasmonean",
  },
  {
    id: "early-roman",
    range: inclusiveRange(bc(63), ad(70)),
    name: "Early Roman",
  },
  {
    id: "roman",
    range: inclusiveRange(ad(71), ad(135)),
    name: "Roman",
  },
  {
    id: "late-roman",
    range: inclusiveRange(ad(136), ad(324)),
    name: "Late Roman",
  },
  {
    id: "byzantine",
    range: inclusiveRange(ad(325), ad(637)),
    name: "Byzantine",
  },
  {
    id: "early-islamic",
    range: inclusiveRange(ad(638), ad(1098)),
    name: "Early Islamic",
  },
  {
    id: "crusader",
    range: inclusiveRange(ad(1099), ad(1291)),
    name: "Crusader",
  },
  {
    id: "mamluk",
    range: inclusiveRange(ad(1292), ad(1300)),
    name: "Mamluk",
  },
];

export function periodAt(year: number): Period | undefined {
  return PERIODS.find((p) => year >= p.range.from && year < p.range.to);
}
