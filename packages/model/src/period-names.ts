import type { Period } from "./periods.ts";
import { localeData } from "./locale-data.ts";
import type { Locale } from "./time.ts";

/** A period's name in the reader's language. */
export function periodName(p: Period, locale: Locale): string {
  if (locale === "en" || locale === "ru") return p.name[locale];
  return localeData(locale)?.periods?.periods[p.id] ?? p.name.en;
}

/** A period's "disputed" note in the reader's language, if it has one. */
export function periodDisputed(p: Period, locale: Locale): string | undefined {
  if (!p.disputed) return undefined;
  if (locale === "en" || locale === "ru") return p.disputed[locale];
  return localeData(locale)?.periods?.disputed[p.id] ?? p.disputed.en;
}

/** An age band's label on the slider (by the age's first period), else the English one. */
export function ageName(
  age: { readonly first: string; readonly en: string; readonly ru: string },
  locale: Locale,
): string {
  if (locale === "en" || locale === "ru") return age[locale];
  return localeData(locale)?.periods?.ages[age.first] ?? age.en;
}
