import { ALL_LOCALES, type Locale } from "./time.ts";

/** The words siteLabelIn builds a label from: the name always in its plain form. */
export interface SiteWords {
  readonly same: (x: string) => string;
  readonly sameName: (x: string) => string;
  readonly within: (x: string, n: string, u: string) => string;
  readonly around: (x: string, n: string, u: string) => string;
  readonly region: (x: string) => string;
  readonly along: (x: string) => string;
  readonly km: string;
  readonly m: string;
}

/**
 * What a language other than English brings to the formatting code, one file per language
 * in ./locales, Russian among them. A browser fetches only the language it shows, so a
 * language added is not a cost for the readers of the others; English is in the code
 * itself, as the words every other language falls back to.
 */
export interface LocaleData {
  /** Book abbreviations, where the language has its own (else the English ones). */
  readonly books?: Readonly<Record<string, string>>;
  /**
   * Book names readers type that do not start with the abbreviation (the Russian Gospels in
   * the genitive, «от Иоанна»): a key matches the word or the word with up to two more letters.
   */
  readonly aliases?: Readonly<Record<string, string>>;
  /** How a book outside the Hebrew canon (1–2 Maccabees) is marked after its reference. */
  readonly deutero?: string;
  /**
   * Books' full names as readers of the language type them, for the chapter search: the
   * running heads of the edition the verses come from (eBible.org: RV 1909, the Bíblia
   * Portuguesa Mundial, Louis Segond 1910, Luther 1912, Riveduta 1927, the Statenvertaling,
   * Kralice 1613), with the common modern forms; Ukrainian in its modern forms (Kulish 1871
   * spells the old way), Polish in those of the Biblia Tysiąclecia.
   */
  readonly bookNames?: Readonly<Record<string, readonly string[]>>;
  /**
   * The eras' names: the period by id, its "disputed" note by id, and the slider's age bands
   * by their first period. Beyond Russian, drafted by machine translation (2026-10-10 and
   * 2026-10-11) and not yet read by native speakers.
   */
  readonly periods?: {
    readonly periods: Readonly<Record<string, string>>;
    readonly disputed: Readonly<Record<string, string>>;
    readonly ages: Readonly<Record<string, string>>;
  };
  /** The templates of siteLabelIn in the language. */
  readonly site?: SiteWords;
}

const LOADED = new Map<string, LocaleData>();

/** The data of a language loaded by loadLocaleData; undefined before (the English stands in). */
export const localeData = (locale: string): LocaleData | undefined => LOADED.get(locale);

/**
 * Fetches a language's data once. False for a language the code does not know, so a value
 * read from the URL names no other module; English needs nothing.
 */
export async function loadLocaleData(locale: string): Promise<boolean> {
  if (!(ALL_LOCALES as readonly string[]).includes(locale)) return false;
  if (locale === "en" || LOADED.has(locale)) return true;
  const mod = (await import(`./locales/${locale as Exclude<Locale, "en">}.ts`)) as {
    default: LocaleData;
  };
  LOADED.set(locale, mod.default);
  return true;
}

/** Every language's data, for the build scripts and the tests, which write them all. */
export async function loadAllLocaleData(): Promise<void> {
  await Promise.all(ALL_LOCALES.map((l) => loadLocaleData(l)));
}
