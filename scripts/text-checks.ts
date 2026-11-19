/**
 * Checks on the texts of every language (ADR 0015), run by build-content.ts:
 * - each language speaks of its own Bible: no other edition named (the Synodal text outside
 *   Russian, the King James Version outside English) and no word in another script
 *   (Cyrillic in a language written in Latin letters);
 * - an article's title names its place as that language's map does (names-<code>.yaml);
 * - a quotation the English text takes from the KJV is quoted, in each language, word for
 *   word from that language's own Bible (bible-text.ts): no case ending, word or spelling
 *   of the writer's inside the quotation marks.
 * Pure functions here; the exceptions still to be rewritten are in text-exceptions.ts.
 */
import type { Locale } from "../packages/model/src/locales.ts";

/** The other Bibles a text may not name: each language quotes and discusses its own. */
// Serbian also calls it «синодски превод», «синодски текст».
const SYNODAL =
  /[Ss]ynod[aá](?:l|al)|[Ss]inodal|[Ss]zinodál|[Сс]инодал|[Сс]инодск\p{L}* (?:превод|текст)/u;
const KING_JAMES = new RegExp(
  [
    "King[ -]James",
    "\\bKJV\\b",
    "Jakab király",
    // The KJV by its other English name, kept in some languages or put into their words.
    "Authori[sz]ed[ -]Version",
    "versi(?:ón|on|ão|unea|unii)\\s+autori[sz]",
    "autorizovan\\p{L}*\\s+verz",
    "авторизован\\p{L}*\\s+(?:переклад|верс)",
    "(?:roi|rey|rei|re|regele|regelui|króla|krále|kong|kung|kuningas|крал|короля|краља|vua)" +
      "\\s+(?:Jacques|Jacobo|Giacomo|Tiago|Iacob|Jakuba|Jakobs|Jaakon|Джеймс|Якова|Иакова|Џејмса|Gia-cơ)",
  ].join("|"),
  "iu",
);
const CYRILLIC_LANGS: ReadonlySet<string> = new Set(["ru", "uk", "sr", "bg"]);
const CYRILLIC_WORD = /\p{Script=Cyrillic}{2,}/u;

/** Why a text in this language speaks of another language's Bible, or undefined. */
export function otherBible(locale: Locale, text: string): string | undefined {
  if (locale !== "ru" && SYNODAL.test(text)) return "names the Russian Synodal Bible";
  if (locale !== "en" && KING_JAMES.test(text)) return "names the King James Version";
  if (!CYRILLIC_LANGS.has(locale)) {
    const m = CYRILLIC_WORD.exec(text);
    if (m) return `has a word in Cyrillic («${m[0]}»)`;
  }
  return undefined;
}

/** Folded for comparing names: compatibility forms, no-break spaces, case. Apostrophes kept. */
const foldName = (s: string, locale: Locale) =>
  s.normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase(locale);

/**
 * Whether an article's title names the place as the map does: the map's name (without the
 * number that tells namesakes apart in place-names.yaml, "Gibeah 3") is in the title, or the
 * title in it ("Aphek in Asher" for Aphek; "Kedesh" for "Kedesh in Galilee").
 */
export function titleNamesPlace(locale: Locale, title: string, mapName: string): boolean {
  const t = foldName(title, locale);
  const m = foldName(mapName.replace(/\s+\d+$/u, ""), locale);
  return t.includes(m) || m.includes(t);
}

/** Each language's quotation marks, outer pair first (the nested ones are not read). */
const QUOTE_MARKS: Readonly<Record<Locale, readonly (readonly [string, string])[]>> = {
  en: [
    ["“", "”"],
    ['"', '"'],
  ],
  ru: [["«", "»"]],
  uk: [["«", "»"]],
  es: [["«", "»"]],
  fr: [["«", "»"]],
  it: [["«", "»"]],
  nb: [["«", "»"]],
  pt: [["“", "”"]],
  nl: [["“", "”"]],
  tl: [["“", "”"]],
  vi: [["“", "”"]],
  de: [["„", "“"]],
  cs: [["„", "“"]],
  sr: [["„", "“"]],
  bg: [["„", "“"]],
  pl: [["„", "”"]],
  hu: [["„", "”"]],
  ro: [["„", "”"]],
  sv: [["”", "”"]],
  fi: [["”", "”"]],
  da: [["»", "«"]],
  zh: [["“", "”"]],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The quotations of a text, whole, in its order. */
export function quotations(locale: Locale, text: string): string[] {
  const out: { at: number; q: string }[] = [];
  for (const [open, close] of QUOTE_MARKS[locale]) {
    const re = new RegExp(
      `${escape(open)}([^${escape(open)}${escape(close)}]+)${escape(close)}`,
      "gu",
    );
    for (const m of text.matchAll(re)) out.push({ at: m.index, q: m[1] ?? "" });
  }
  return out.sort((a, b) => a.at - b.at).map((x) => x.q);
}

/**
 * For finding a quotation in a Bible: compatibility forms, case, the diacritics (the Dutch
 * text of eBible.org lost its diaereses, «Arabie»), apostrophes and punctuation folded away.
 */
export function foldText(s: string): string {
  const words = s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ё/gu, "е")
    .replace(/ſ/gu, "s")
    .replace(/['’`´ʼ]/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== "");
  return words.join(" ");
}

/**
 * The parts of a quotation to look for: what stands between an ellipsis or a bracket (the
 * writer's omission or gloss), of at least `MIN_WORDS` words, folded.
 */
export const MIN_WORDS = 4;
export function quotedParts(quotation: string): string[] {
  return quotation
    .split(/…|\.\.\.|\[[^\]]*\]|\([^)]*\)|[[\]()]/u)
    .map(foldText)
    .filter((p) => p.split(" ").length >= MIN_WORDS);
}

/** A Bible's words, folded, with where each word stands: `has` finds a run of them. */
export class FoldedBible {
  private readonly words: string[] = [];
  private readonly at = new Map<string, number[]>();
  constructor(verses: Iterable<string>) {
    // The verses in a row: a quotation may run on from one verse into the next.
    for (const v of verses) for (const w of foldText(v).split(" ")) if (w !== "") this.add(w);
  }
  private add(w: string) {
    const list = this.at.get(w);
    if (list) list.push(this.words.length);
    else this.at.set(w, [this.words.length]);
    this.words.push(w);
  }
  /** Whether the folded words stand in this order somewhere in the Bible. */
  has(folded: string): boolean {
    const ws = folded.split(" ");
    // Anchor on the rarest word of the run.
    let best = 0;
    let fewest = Infinity;
    for (const [i, w] of ws.entries()) {
      const n = this.at.get(w)?.length ?? 0;
      if (n === 0) return false;
      if (n < fewest) [best, fewest] = [i, n];
    }
    return (this.at.get(ws[best] ?? "") ?? []).some((pos) => {
      const start = pos - best;
      return start >= 0 && ws.every((w, j) => this.words[start + j] === w);
    });
  }
}

/** Whether every part of a quotation is in the Bible, word for word. */
export const inBible = (bible: FoldedBible, quotation: string): boolean =>
  quotedParts(quotation).every((p) => bible.has(p));

/**
 * The quotations of one paragraph in `locale` that should come from its Bible and do not:
 * those standing where the English paragraph quotes the KJV. Paired with the English by
 * their order when both have as many; otherwise judged only when every English quotation of
 * the paragraph is from the KJV.
 */
export function misquoted(
  locale: Locale,
  text: string,
  english: string,
  bibles: { readonly en: FoldedBible; readonly own: FoldedBible },
): string[] {
  const en = quotations("en", english).filter((q) => quotedParts(q).length > 0);
  const own = quotations(locale, text).filter((q) => quotedParts(q).length > 0);
  if (en.length === 0) return [];
  const kjv = en.map((q) => inBible(bibles.en, q));
  const judged =
    own.length === en.length ? own.filter((_, i) => kjv[i]) : kjv.every(Boolean) ? own : [];
  return judged.filter((q) => !inBible(bibles.own, q));
}

/** One text of the content in every language: an article, a question or a tour. */
export interface TextRecord {
  /** "articles/kain", "questions/where-was-haran", "tours/exodus". */
  readonly key: string;
  /** Its title, then its paragraphs (or the tour's notes), in each language, in one order. */
  readonly texts: Readonly<Partial<Record<Locale, readonly string[]>>>;
  /** For an article: its place, whose map name the title must hold. */
  readonly place?: string;
}

/** The records still waiting for their rewrite, per check (text-exceptions.ts). */
export interface TextExceptions {
  /** Record → the languages ("de fr") that still explain the Synodal or the KJV reading. */
  readonly otherBible: Readonly<Record<string, string>>;
  /** "<language> <article id>" whose title keeps a name the map does not show. */
  readonly titleNotMapName: ReadonlySet<string>;
  /** Record → the languages ("de fr") whose quotations are not yet word for word. */
  readonly misquoted: Readonly<Record<string, string>>;
  /** "<language> <title>" that more than one article still bears. */
  readonly sameTitle: ReadonlySet<string>;
}

/**
 * Every check above over the records; the errors, including an exception that no longer
 * fails, so the lists only shrink. Without `bibles` (no pipeline/.cache) the quotations are
 * not checked and their exceptions not judged.
 */
export function checkTexts(
  records: readonly TextRecord[],
  locales: readonly Locale[],
  mapName: (locale: Locale, place: string) => string | undefined,
  exceptions: TextExceptions,
  bibles?: Readonly<Partial<Record<Locale, FoldedBible>>>,
): string[] {
  const errors: string[] = [];
  const failing = { other: new Set<string>(), title: new Set<string>(), quoted: new Set<string>() };
  const titles = new Map<string, string[]>();
  for (const r of records) {
    const english = r.texts.en ?? [];
    for (const l of locales) {
      const texts = r.texts[l] ?? [];
      // Another Bible: any text of the record.
      const why = texts.map((t) => otherBible(l, t)).find((w) => w !== undefined);
      if (why) {
        failing.other.add(`${r.key} ${l}`);
        if (!(exceptions.otherBible[r.key] ?? "").split(" ").includes(l))
          errors.push(`${r.key}: the ${l} text ${why}`);
      }
      // The title and the map.
      if (r.place !== undefined) {
        const [title = ""] = texts;
        const id = r.key.replace(/^articles\//u, "");
        const map = mapName(l, r.place);
        const key = `${l} ${id}`;
        if (map !== undefined && !titleNamesPlace(l, title, map)) {
          failing.title.add(key);
          if (!exceptions.titleNotMapName.has(key))
            errors.push(
              `${r.key}: the ${l} title «${title}» does not hold the map's name «${map}»`,
            );
        }
        const same = `${l} ${foldName(title, l)}`;
        titles.set(same, [...(titles.get(same) ?? []), id]);
      }
      // Quotations, against the language's own Bible.
      const own = bibles?.[l];
      if (l !== "en" && own && bibles.en) {
        const bad = texts.flatMap((t, i) =>
          misquoted(l, t, english[i] ?? "", { en: bibles.en as FoldedBible, own }),
        );
        if (bad.length > 0) {
          failing.quoted.add(`${r.key} ${l}`);
          if (!(exceptions.misquoted[r.key] ?? "").split(" ").includes(l))
            for (const q of bad)
              errors.push(`${r.key}: the ${l} quotation «${q}» is not in its Bible word for word`);
        }
      }
    }
  }
  for (const [same, ids] of titles)
    if (ids.length > 1 && !exceptions.sameTitle.has(same))
      errors.push(
        `articles: ${ids.join(", ")} bear one ${same.slice(0, 2)} title «${same.slice(3)}»`,
      );
  // An exception that passes now is dropped from its list.
  for (const [key, langs] of Object.entries(exceptions.otherBible))
    for (const l of langs.split(" "))
      if (!failing.other.has(`${key} ${l}`))
        errors.push(`text-exceptions: the ${l} text of ${key} names no other Bible now`);
  for (const key of exceptions.titleNotMapName)
    if (!failing.title.has(key))
      errors.push(`text-exceptions: the title of ${key} holds its map name now`);
  for (const same of exceptions.sameTitle)
    if ((titles.get(same)?.length ?? 0) < 2)
      errors.push(`text-exceptions: «${same}» is one article's title now`);
  if (bibles)
    for (const [key, langs] of Object.entries(exceptions.misquoted))
      for (const l of langs.split(" "))
        if (!failing.quoted.has(`${key} ${l}`))
          errors.push(`text-exceptions: the ${l} quotations of ${key} are word for word now`);
  return errors;
}
