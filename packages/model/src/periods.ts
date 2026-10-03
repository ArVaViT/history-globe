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
    id: "eb1",
    range: inclusiveRange(bc(3500), bc(3051)),
    name: { en: "Early Bronze I", ru: "Ранняя бронза I" },
  },
  {
    id: "eb2",
    range: inclusiveRange(bc(3050), bc(2701)),
    name: { en: "Early Bronze II", ru: "Ранняя бронза II" },
  },
  {
    id: "eb3",
    range: inclusiveRange(bc(2700), bc(2301)),
    name: { en: "Early Bronze III", ru: "Ранняя бронза III" },
  },
  {
    id: "eb4",
    range: inclusiveRange(bc(2300), bc(2001)),
    name: { en: "Early Bronze IV", ru: "Ранняя бронза IV" },
  },
  {
    id: "mb2",
    range: inclusiveRange(bc(2000), bc(1551)),
    name: { en: "Middle Bronze II", ru: "Средняя бронза II" },
    disputed: { en: "The patriarchs' dates are disputed", ru: "Время патриархов спорно" },
  },
  {
    id: "lb",
    range: inclusiveRange(bc(1550), bc(1201)),
    name: { en: "Late Bronze", ru: "Поздняя бронза" },
    disputed: {
      en: "Exodus: c. 1446 or c. 1270 BC",
      ru: "Исход: ок. 1446 или ок. 1270 г. до н. э.",
    },
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
    disputed: { en: "Its archaeological dates are disputed", ru: "Археологи спорят о датах" },
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
    range: inclusiveRange(ad(71), ad(135)),
    name: { en: "Roman", ru: "Римский период" },
  },
  {
    id: "late-roman",
    range: inclusiveRange(ad(136), ad(324)),
    name: { en: "Late Roman", ru: "Позднеримский период" },
  },
  {
    id: "byzantine",
    range: inclusiveRange(ad(325), ad(637)),
    name: { en: "Byzantine", ru: "Византийский период" },
  },
  {
    id: "early-islamic",
    range: inclusiveRange(ad(638), ad(1098)),
    name: { en: "Early Islamic", ru: "Раннеисламский период" },
  },
  {
    id: "crusader",
    range: inclusiveRange(ad(1099), ad(1291)),
    name: { en: "Crusader", ru: "Период крестоносцев" },
  },
  {
    id: "mamluk",
    range: inclusiveRange(ad(1292), ad(1300)),
    name: { en: "Mamluk", ru: "Мамлюкский период" },
  },
];

export function periodAt(year: number): Period | undefined {
  return PERIODS.find((p) => year >= p.range.from && year < p.range.to);
}
