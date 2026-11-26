// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

// Checks of the source lines in every language (content/sources-<code>.yaml), run by
// build-content.ts. Each takes the English line and one translation and returns what is wrong.

/** English words that are ours to translate when they are not part of a published title. */
export const ENGLISH_WORDS: readonly string[] = [
  ...["the", "of", "and", "with", "from", "which", "where", "between", "by", "on", "see"],
  ...["also", "after", "into", "their", "its", "in", "to", "for", "at", "near", "about"],
  ...["ed.", "tr.", "n.", "p."],
];
/** Places in an ancient or medieval text, ours to translate even inside a modern citation. */
export const LOCATOR_WORDS: readonly string[] = ["text", "obv.", "rev.", "ch.", "part", "map"];

// A word without the punctuation around it; capitals kept, so "The" of a title and the
// initial "P." are not the words "the" and "p.".
const core = (token: string) => token.replace(/^[("'“‘„«[]+/u, "").replace(/[)"'”’»,;:\]]+$/u, "");
const tokens = (s: string) => s.split(/\s+/u).filter((x) => x !== "");

/**
 * Which words of a translation are copied as they stand from the English line, in a run of at
 * least `min` words (a modern title or citation). Our own connecting words at either end of a
 * run ("in", "ed.") do not count as copied: they are where the translation should have begun.
 */
export function copied(en: string, t: string, min = 3): boolean[] {
  const a = tokens(t);
  const b = tokens(en);
  const out = a.map(() => false);
  const ours = new Set([...ENGLISH_WORDS, ...LOCATOR_WORDS]);
  for (let i = 0; i < a.length; i++) {
    let best = 0;
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      best = Math.max(best, k);
    }
    let from = i;
    let to = i + best;
    while (from < to && ours.has(core(a[from] ?? ""))) from++;
    while (to > from && ours.has(core(a[to - 1] ?? ""))) to--;
    if (to - from >= min) for (let x = from; x < to; x++) out[x] = true;
  }
  return out;
}

/** Words that are also the language's own ("in" in German, "to" in Polish, "at" in Tagalog). */
export const OWN_WORDS: Readonly<Partial<Record<string, readonly string[]>>> = {
  cs: ["in", "n.", "text", "to"],
  da: ["at", "by", "for", "to"],
  de: ["in", "n."],
  es: ["ed.", "p.", "rev."],
  fi: ["n.", "on"],
  fr: ["p.", "rev."],
  hu: ["in"],
  it: ["in", "n.", "p."],
  nb: ["at", "by", "for", "to"],
  nl: ["in", "of", "p."],
  pl: ["by", "to"],
  pt: ["ed.", "p.", "rev."],
  ro: ["ed.", "p."],
  sv: ["by", "in", "text"],
  tl: ["at", "p."],
  vi: ["tr."],
};
/** Lines whose English words stay in every language, and why. */
export const ENGLISH_KEPT: ReadonlyMap<string, string> = new Map([
  [
    "Pliny the Elder, Natural History 34.2 ('in Cypro, ubi prima aeris inventio')",
    "Pliny's Latin, quoted",
  ],
  ["Septuagint, Genesis 23.9 (to spelaion to diploun)", "the Greek of the Septuagint"],
  [
    "J. Murphy-O'Connor, The Holy Land: An Oxford Archaeological Guide (5th ed., 2008) (St Mark's, St Peter in Gallicantu)",
    "St Peter in Gallicantu, the church's Latin name",
  ],
  [
    "J. Simons, The Geographical and Topographical Texts of the Old Testament (1959), as cited in the Encyclopedia of the Bible",
    "a published title, which French writes after its article (l’Encyclopedia)",
  ],
]);

/**
 * English words left in a translation: any of ENGLISH_WORDS outside a copied run, and a
 * locator ("text 60", "ch. VII") anywhere, even in a line copied whole.
 */
export function englishLeft(en: string, t: string, locale: string): string[] {
  const own = OWN_WORDS[locale] ?? [];
  const a = tokens(t);
  const kept = t === en || ENGLISH_KEPT.has(en) ? a.map(() => true) : copied(en, t);
  const left = new Set<string>();
  a.forEach((x, i) => {
    const w = core(x);
    if (own.includes(w)) return;
    const next = a[i + 1] ?? "";
    if (LOCATOR_WORDS.includes(w) && /^\(?(?:\d{1,3}|[IVXLC]+)(?![\d\p{L}])/u.test(next))
      left.add(w);
    // "in" before an editor's initials opens an edited volume: ours, even inside a citation.
    else if (w === "in" && /^\p{Lu}\.$/u.test(next) && t !== en) left.add(w);
    else if (ENGLISH_WORDS.includes(w) && !kept[i]) left.add(w);
  });
  return [...left];
}

const QUOTED = /'[^']*'|‘[^’]*’|“[^”]*”|„[^“”]*[“”]|«[^»]*»|"[^"]*"/gu;
/** Letters of Russian that the language does not have. */
const FOREIGN: Readonly<Record<string, RegExp>> = {
  sr: /[яыэёъйЯЫЭЁЪЙ]/u,
  uk: /[ыэёъЫЭЁЪ]/u,
  bg: /[іїєыэёІЇЄЫЭЁ]/u,
};
/**
 * In a Serbian, Ukrainian or Bulgarian line, what is not in Cyrillic: units in Latin letters
 * (km, m, ft), letters of Russian the language does not have, and Latin words of three
 * letters or more that the English line does not have, outside quotations: a name declined
 * in Latin letters ("Albrightovo") is spelt as the language spells names. Modern authors,
 * titles and words of the sources (lmlk, colonia) are copied from the English as they stand.
 */
export function notCyrillic(en: string, t: string, locale: string): string[] {
  const out: string[] = [];
  const foreign = FOREIGN[locale];
  if (foreign) for (const ch of t) if (foreign.test(ch) && !en.includes(ch)) out.push(ch);
  const unquoted = t.replace(QUOTED, (m) => " ".repeat(m.length));
  const word = (x: string) => x.replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, "").replace(/'s$/u, "");
  const enWords = new Set(tokens(en).map(word));
  for (const x of tokens(t)) {
    const w = word(x);
    if (/^(?:km|m|ft|mi)$/u.test(w)) out.push(w);
    const latin = (w.match(/\p{Script=Latin}/gu) ?? []).length;
    if (latin < 3 || !unquoted.includes(x) || enWords.has(w)) continue;
    if (/^[IVXLCDM]+(?:[–-][IVXLCDM]+)?$/iu.test(w)) continue;
    // A website named by its address (Livius.org).
    if (/\.(?:org|com|net|info|edu)$/u.test(w)) continue;
    out.push(w);
  }
  return [...new Set(out)];
}

/** A bare "mil" in Danish, Norwegian and Swedish is the Scandinavian mile, about 10 km. */
export const bareMile = (t: string): boolean =>
  /(?<!\b(?:romersk|romerske|romerska|engelsk|engelske|engelska) )\bmil(?:e|es)?\b/iu.test(t);

const ORDINAL: Readonly<Record<string, number>> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
};
const NUMBER = String.raw`(\d{1,2}(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth)`;
const nth = (s: string) => ORDINAL[s] ?? Number.parseInt(s, 10);
/**
 * Centuries written as hundreds in Danish, Norwegian, Swedish and Finnish ("500-tallet",
 * "500-luvulla" for the sixth century) that no century of the English line gives: the
 * hundreds of the Nth century are N-1.
 */
export function wrongCenturies(en: string, t: string): number[] {
  const given = new Set<number>();
  const run = new RegExp(
    String.raw`\b${NUMBER}((?:\s*(?:-|–|and|or|to|,)\s*${NUMBER})*)(?:[- ]centur(?:y|ies)\b| c\.)`,
    "giu",
  );
  for (const m of en.matchAll(run)) {
    for (const n of m[0].matchAll(new RegExp(String.raw`\b${NUMBER}`, "giu")))
      given.add(nth((n[1] ?? "").toLowerCase()) - 1);
  }
  const wrong = new Set<number>();
  const hundreds = /\b(\d{1,2})00(?:–(\d{1,2})00)?-(?=tal|luv|luk|\s+(?:och|og|ja|eller|tai)\s)/gu;
  for (const m of t.matchAll(hundreds))
    for (const g of [m[1], m[2]])
      if (g !== undefined && !given.has(Number.parseInt(g, 10))) wrong.add(Number(g) + 1);
  return [...wrong];
}

/** Ids of the site's dated events and battles named in a line ("saul-king"). */
export function eventIds(s: string, ids: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/(?:dated events?|battles?) \(([^()]*)\)/g))
    for (const w of (m[1] ?? "").matchAll(
      /(?<![\p{L}“])[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?![\p{L}”])/gu,
    ))
      if (ids.has(w[0])) out.push(w[0]);
  return out;
}

/**
 * Titles of the site's tours and events that a line quotes (“…”) but its translation does not
 * give as the site gives them in that language. `titles` maps an English title to this
 * language's.
 */
export function titlesMissing(
  en: string,
  t: string,
  titles: ReadonlyMap<string, string>,
): string[] {
  const out: string[] = [];
  for (const m of en.matchAll(/“([^”]+)”/gu)) {
    const own = titles.get(m[1] ?? "");
    if (own !== undefined && !t.includes(own)) out.push(own);
  }
  return out;
}

/** Lines cited with no translation, and translations no line cites any more. */
export function missingAndStale(
  cited: ReadonlySet<string>,
  table: Readonly<Record<string, string>>,
): { missing: string[]; stale: string[] } {
  return {
    missing: [...cited].filter((s) => table[s] === undefined),
    stale: Object.keys(table).filter((s) => !cited.has(s)),
  };
}
