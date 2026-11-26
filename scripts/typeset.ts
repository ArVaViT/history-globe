// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * Each language's typography for the text of a page: a number keeps its unit and its era, a
 * date's era stays whole («до н. э.»), a dash keeps the word before it. Run over the
 * documentation (build-docs.ts) and the static pages (build-pages.ts).
 */
import type { SiteLocale } from "../packages/model/src/locales.ts";

/** The text of a page (not its tags, code, <pre>, scripts or styles) run through `fix`. */
const inText = (html: string, fix: (text: string) => string) =>
  html
    .split(
      /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/,
    )
    .map((part, i) => (i % 2 === 1 ? part : fix(part)))
    .join("");

/**
 * Russian typography in the text (not in tags, code or <pre>): a number keeps its unit
 * («586 г.», «35 КБ», «VIII в.»), «до н. э.» stays whole, and a dash its word before it.
 */
export function typeset(html: string): string {
  const NB = "\u00a0";
  return inText(html, (t) =>
    t
      .replace(/(\d|[IVXLC]) (г\.|гг\.|в\.|вв\.|км|м(?![а-яё])|КБ|МБ)/g, `$1${NB}$2`)
      .replace(/до н\. э\./g, `до${NB}н.${NB}э.`)
      .replace(/н\. э\./g, `н.${NB}э.`)
      .replace(/([^\s>]) — /g, `$1${NB}— `),
  );
}

/** English: a number keeps its BC, AD, km or KB. */
export function typesetEnglish(html: string): string {
  const NB = "\u00a0";
  return inText(html, (t) =>
    t.replace(/(\d) (BC|km|KB|MB)\b/g, `$1${NB}$2`).replace(/\bAD (\d)/g, `AD${NB}$1`),
  );
}

/** Ukrainian, as the Russian: «586 р.», «до н. е.» whole, a dash keeps its word before it. */
export function typesetUkrainian(html: string): string {
  const NB = "\u00a0";
  return inText(html, (t) =>
    t
      .replace(/(\d|[IVXLC]) (р\.|рр\.|ст\.|км|м(?![а-яіїєґ])|КБ|МБ)/g, `$1${NB}$2`)
      .replace(/до н\. е\./g, `до${NB}н.${NB}е.`)
      .replace(/н\. е\./g, `н.${NB}е.`)
      .replace(/([^\s>]) — /g, `$1${NB}— `),
  );
}

/**
 * Serbian, as the Ukrainian: «586. п. н. е.» and «6. век» whole, a one-letter word («у», «с»)
 * on the next word, a dash keeps its word before it.
 */
export function typesetSerbian(html: string): string {
  const NB = "\u00a0";
  return inText(html, (t) =>
    t
      .replace(/(\d\.?|[IVXLC]) (век|км|м(?![а-шђјљњћџ])|КБ|МБ)/g, `$1${NB}$2`)
      .replace(/п\. н\. е\./g, `п.${NB}н.${NB}е.`)
      .replace(/н\. е\./g, `н.${NB}е.`)
      .replace(/(\d\.?) (?=п\.\u00a0н|н\.\u00a0е)/g, `$1${NB}`)
      .replace(/(^|[\s(„])([уУсСкКоОаАиИ]) /g, `$1$2${NB}`)
      .replace(/([^\s>]) — /g, `$1${NB}— `),
  );
}

/**
 * Bulgarian, as the Serbian, with the era as the content writes it: «586 г. пр.н.е.», «30 г. н.е.»
 * and «VI в. пр.н.е.» whole, a dash keeps its word before it.
 */
export function typesetBulgarian(html: string): string {
  const NB = "\u00a0";
  return inText(html, (t) =>
    t
      .replace(/(\d|[IVXLC]) (г\.|в\.|км|м(?![а-яъь])|КБ|МБ)/g, `$1${NB}$2`)
      .replace(/(г\.|в\.) (?=пр\.н\.е\.|н\.е\.)/g, `$1${NB}`)
      .replace(/([^\s>]) ([–—]) /g, `$1${NB}$2 `),
  );
}

/**
 * The languages in Latin script beyond English: a number keeps its unit and its era (586 a. C.,
 * 586 v. Chr., 586 av. J.-C., 586 f.Kr., 1200 BK); French also keeps « », : ; ! ? on their
 * word with a thin no-break space.
 */
function typesetLatin(l: SiteLocale): (html: string) => string {
  const NB = "\u00a0";
  const NNB = "\u202f";
  return (html) =>
    inText(html, (t) => {
      let x = t
        .replace(/(\d) (km|KB|MB|kB)\b/g, `$1${NB}$2`)
        .replace(
          /(\d) (a\. ?C\.|d\. ?C\.|v\. ?Chr\.|n\. ?Chr\.|av\. J\.-C\.|apr\. J\.-C\.|p\.n\.e\.|n\.e\.|př\. n\. l\.|n\. l\.|f\.Kr\.|e\.Kr\.|BK|AD|eaa\.|jaa\.|TCN|SCN|î\. ?Hr\.|d\. ?Hr\.)/g,
          `$1${NB}$2`,
        )
        .replace(/\b(a|d|v|n|av|apr)\. (C\.|Chr\.|J\.-C\.)/g, `$1.${NB}$2`)
        .replace(/(^|[^\p{L}])(î|d)\. Hr\./gu, `$1$2.${NB}Hr.`)
        .replace(/př\. n\. l\./g, `př.${NB}n.${NB}l.`)
        .replace(/\bn\. l\./g, `n.${NB}l.`);
      // Polish and Czech keep a one-letter word on the next line's word: "w Egipcie", "v Egyptě".
      if (l === "pl" || l === "cs")
        x = x.replace(/(^|[\s(„])([aiouwzkvsAIOUWZKVS]) /g, `$1$2${NB}`);
      if (l === "fr")
        x = x
          .replace(/ ([:;!?»])/g, `${NNB}$1`)
          .replace(/« /g, `«${NNB}`)
          // The semicolon that closes a character reference (&amp; &#39;) is not punctuation.
          .replace(/(&(?:#x?[\da-f]+|[a-z][a-z\d]*);)|(\S)([;!?])(?=\s|$)/gi, (m, ref, c, p) =>
            ref ? m : `${c}${NNB}${p}`,
          );
      return x;
    });
}

/** An element marked in another language than the page's (lang="en"), whole. */
const FOREIGN = (l: SiteLocale) =>
  new RegExp(`(<([a-z][a-z\\d]*)\\b[^>]*\\slang="(?!${l}\\b)[^"]*"[^>]*>[\\s\\S]*?<\\/\\2>)`, "i");

/**
 * French: as the other Latin-script languages, but an element marked in another language
 * (an English title, lang="en") keeps that language's punctuation, with no French spaces.
 */
function typesetFrench(): (html: string) => string {
  const latin = typesetLatin("fr");
  const neutral = typesetLatin("en");
  return (html) =>
    html
      .split(FOREIGN("fr"))
      .map((part, i) => (i % 3 === 0 ? latin(part) : i % 3 === 1 ? neutral(part) : ""))
      .join("");
}

/** Each language's typography. */
export const TYPESET: Readonly<Record<SiteLocale, (html: string) => string>> = {
  en: typesetEnglish,
  ru: typeset,
  uk: typesetUkrainian,
  es: typesetLatin("es"),
  pt: typesetLatin("pt"),
  de: typesetLatin("de"),
  fr: typesetFrench(),
  it: typesetLatin("it"),
  nl: typesetLatin("nl"),
  pl: typesetLatin("pl"),
  cs: typesetLatin("cs"),
  sv: typesetLatin("sv"),
  da: typesetLatin("da"),
  nb: typesetLatin("nb"),
  sr: typesetSerbian,
  tl: typesetLatin("tl"),
  hu: typesetLatin("hu"),
  fi: typesetLatin("fi"),
  vi: typesetLatin("vi"),
  ro: typesetLatin("ro"),
  bg: typesetBulgarian,
};
