// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import type { Locale } from "./locales.ts";

/**
 * A list of sources as a reader of `locale` reads them: the build's lines in that language
 * (content/sources-<code>.yaml), the English as written where the build wrote none (English
 * itself, and a language whose lines all read as in English).
 */
export function sourcesOf(
  x: {
    readonly sources: readonly string[];
    readonly sources_ru?: readonly string[];
    readonly sources_in?: Readonly<Partial<Record<Locale, readonly string[]>>>;
  },
  locale: Locale,
): string[] {
  const own = locale === "ru" ? x.sources_ru : x.sources_in?.[locale];
  return [...(own ?? x.sources)];
}
