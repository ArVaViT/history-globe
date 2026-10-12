import type { Period } from "./periods.ts";
import { localeData } from "./locale-data.ts";
import type { Locale } from "./time.ts";

/** A period's name in the reader's language. */
export function periodName(p: Period, locale: Locale): string {
  return localeData(locale)?.periods?.periods[p.id] ?? p.name;
}

/** A period's "disputed" note in the reader's language, if it has one. */
export function periodDisputed(p: Period, locale: Locale): string | undefined {
  if (!p.disputed) return undefined;
  return localeData(locale)?.periods?.disputed[p.id] ?? p.disputed;
}

/** An age band's label on the slider (by the age's first period), else the English one. */
export function ageName(
  age: { readonly first: string; readonly en: string },
  locale: Locale,
): string {
  return localeData(locale)?.periods?.ages[age.first] ?? age.en;
}
