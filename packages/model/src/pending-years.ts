import type { Locale, YearWords } from "./time.ts";

/**
 * How the languages the code knows before their words are written (waves 4 and 5, 2026-10-25) write
 * a year and a century, fetched only for such a language (locale-data.ts) and only while its
 * file in ./locales is missing: once that file comes, its own `years` are read, and its entry
 * here can go. Each form follows the language's usage:
 *
 * - Hungarian: the era before the year, an ordinal century (Kr. e. 586, Kr. u. 30,
 *   Kr. e. 6. század), as the Academy's rules abbreviate them (AkH. 12th ed.) and Hungarian
 *   Wikipedia titles its years and centuries;
 * - Finnish: eaa. / jaa. after the year, the century by its hundreds, the first by its ordinal
 *   (500-luvulla eaa., 1. vuosisadalla jaa.), as the Institute for the Languages of Finland
 *   (Kotus, Kielitoimiston ohjepankki) writes them;
 * - Vietnamese: năm before the year, TCN after a year before Christ, none after one since
 *   (năm 586 TCN, năm 30, thế kỷ 6 TCN, thế kỷ 1), as Vietnamese Wikipedia titles them;
 * - Turkish: MÖ / MS before the year, an ordinal century (MÖ 586, MS 30, MÖ 6. yüzyıl), as
 *   the Turkish Language Association (TDK, Yazım Kılavuzu) abbreviates them;
 * - Swahili: KK / BK after the year (Kabla / Baada ya Kristo: 586 KK, 30 BK, karne ya 6 KK),
 *   as Swahili Wikipedia titles them;
 * - Romanian: î.Hr. / d.Hr. after the year (înainte / după Hristos), the century as an ordinal
 *   in Roman numerals (586 î.Hr., 30 d.Hr., secolul al VI-lea î.Hr., secolul I d.Hr.), as the
 *   Academy's DOOM abbreviates the eras and Romanian Wikipedia titles its centuries;
 * - Bulgarian: г. and пр.н.е. / н.е. after the year (преди новата ера), the century in Roman
 *   numerals (586 г. пр.н.е., 30 г. н.е., VI в. пр.н.е.), as the Academy's Institute for the
 *   Bulgarian Language and Bulgarian Wikipedia write them (пр.Хр. is read too).
 */
export const PENDING_YEARS: Readonly<Partial<Record<Locale, YearWords>>> = {
  hu: {
    year: (y, bc) => `${bc ? "Kr. e." : "Kr. u."} ${String(y)}`,
    century: (n, bc) => `${bc ? "Kr. e." : "Kr. u."} ${String(n)}. század`,
  },
  fi: {
    year: (y, bc) => `${String(y)} ${bc ? "eaa." : "jaa."}`,
    century: (n, bc) =>
      `${n === 1 ? "1. vuosisadalla" : `${String((n - 1) * 100)}-luvulla`} ${bc ? "eaa." : "jaa."}`,
  },
  vi: {
    year: (y, bc) => `năm ${String(y)}${bc ? " TCN" : ""}`,
    century: (n, bc) => `thế kỷ ${String(n)}${bc ? " TCN" : ""}`,
  },
  tr: {
    year: (y, bc) => `${bc ? "MÖ" : "MS"} ${String(y)}`,
    century: (n, bc) => `${bc ? "MÖ" : "MS"} ${String(n)}. yüzyıl`,
  },
  sw: {
    year: (y, bc) => `${String(y)} ${bc ? "KK" : "BK"}`,
    century: (n, bc) => `karne ya ${String(n)} ${bc ? "KK" : "BK"}`,
  },
  ro: {
    year: (y, bc) => `${String(y)} ${bc ? "î.Hr." : "d.Hr."}`,
    century: (n, bc, roman) =>
      `secolul ${n === 1 ? "I" : `al ${roman}-lea`} ${bc ? "î.Hr." : "d.Hr."}`,
  },
  bg: {
    year: (y, bc) => `${String(y)} г. ${bc ? "пр.н.е." : "н.е."}`,
    century: (_n, bc, roman) => `${roman} в. ${bc ? "пр.н.е." : "н.е."}`,
  },
};
