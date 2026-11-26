// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/** Every language the code can format, published or not. */
export const ALL_LOCALES = [
  "en",
  "ru",
  "uk",
  "de",
  "es",
  "pt",
  "fr",
  "it",
  "nl",
  "pl",
  "cs",
  "zh",
  "sv",
  "da",
  "nb",
  "sr",
  "tl",
  "hu",
  "fi",
  "vi",
  "ro",
  "bg",
] as const;
export type Locale = (typeof ALL_LOCALES)[number];

/**
 * The languages the site is published in: the app's language switch, the static pages, the
 * documentation and the text-places script follow this list. In the order of their own names
 * (Čeština, Deutsch, English … Русский, Українська): no language comes first for being the
 * site's own. A language joins it with its interface file (apps/web/src/i18n) and its names
 * and texts in the content.
 */
export const LOCALES = [
  "cs",
  "da",
  "de",
  "en",
  "es",
  "fr",
  "it",
  "hu",
  "nl",
  "nb",
  "pl",
  "pt",
  "ro",
  "fi",
  "sv",
  "tl",
  "vi",
  "bg",
  "ru",
  "sr",
  "uk",
] as const satisfies readonly Locale[];
export type SiteLocale = (typeof LOCALES)[number];

/** Each language by its own name, for the language switch. */
export const LOCALE_NAMES: Readonly<Record<SiteLocale, string>> = {
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  hu: "Magyar",
  nl: "Nederlands",
  nb: "Norsk bokmål",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  fi: "Suomi",
  sv: "Svenska",
  tl: "Tagalog",
  vi: "Tiếng Việt",
  bg: "Български",
  ru: "Русский",
  sr: "Српски",
  uk: "Українська",
};

export const isLocale = (s: unknown): s is SiteLocale =>
  typeof s === "string" && (LOCALES as readonly string[]).includes(s);
