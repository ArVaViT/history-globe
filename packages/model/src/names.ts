import { LOCALES, type Locale } from "./locales.ts";

type NameKey = `name_${Locale}`;
/** A place or a state as the data gives it: the English `name` and `name_<language>`. */
export type Named = { readonly name: string } & { readonly [K in NameKey]?: string | undefined };

// A locale read from a URL may be one the code does not know: its name is then undefined.
const ownName = (p: Named, locale: string): string | undefined => p[`name_${locale}` as NameKey];

/** A text in the reader's language, or the English one. */
export function pick<T>(
  texts: Readonly<Partial<Record<string, T>>> | undefined,
  locale: string,
): T | undefined {
  return texts?.[locale] ?? texts?.en;
}

/** A place's (or a state's) name in the reader's language, else the English one. */
export function placeName(p: Named, locale: string): string {
  return ownName(p, locale) ?? p.name;
}

/** All of a place's names, in English and in every site language the data has one in. */
export function namesOf(p: Named): string[] {
  return [p.name, ...LOCALES.flatMap((l) => ownName(p, l) ?? [])];
}

/** Whether a place has its own name in a language (English always). */
export function hasNameIn(p: Named, locale: string): boolean {
  return locale === "en" || ownName(p, locale) !== undefined;
}
