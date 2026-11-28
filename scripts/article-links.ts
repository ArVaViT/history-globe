/**
 * Links from the running text of an article or an answer to the pages of the places it
 * names (scripts/build-pages.ts). It matches with the index behind the verses' links and
 * hg-places.js (scripts/build-text-places.ts), which keeps only the forms of a name that point
 * to one place (namesakes, people and ordinary words are dropped there), and adds the rules of
 * a page of prose:
 *
 * - each place is linked once, at its first mention in the whole text, not once a paragraph;
 * - never the page's own place, its other records on the same point (Zion on Mount Zion's
 *   page) or a namesake of its own name (`self`);
 * - only a page search engines index (`linkable`): a link to a thin page or to none is not
 *   made;
 * - nothing inside quotation marks, as each language writes them (`QUOTES`: Danish »…«,
 *   German „…“, Swedish ”…”): a quotation (of Scripture, or of an ancient writer) is kept as
 *   its source wrote it;
 * - nothing inside a longer name that is another thing (`BLOCK`: the Damascus Gate is in
 *   Jerusalem, the Jerusalem Talmud is a book, Flavia Neapolis is Nablus);
 * - no mention whose words around it make it something else (`refusal`): a person (a first
 *   name before it, Moshe Dothan; a numeral after it, Rameses II), a gate or a book named
 *   after the place (Puerta de Susa, Talmud de Jérusalem), a son in a genealogy ("the
 *   brother of Elam"), or today's state rather than the land of the Bible ("modern Syria",
 *   «в нынешнем Ливане», "Jordan" without "the");
 * - a place that only some texts mean by its name is linked only from them (`ONLY_FROM`:
 *   Neapolis is Philippi's port on three pages, Nablus or a quarter of Syracuse elsewhere);
 * - a translation links only the places its English text links, and none that the English
 *   refused anywhere (`allow`): the English is the text the sources were checked against and
 *   these lists were read on, and a form that is a place in one language may be a person's
 *   case in another (Russian «Аполлония» is also "of Apollonius");
 * - a pair read by eye and found wrong in its sentence (`DENY`) is never linked.
 *
 * Pure: no files read. Tested in article-links.test.ts.
 */
import { escapeRegExp } from "../packages/model/src/text.ts";
import type { Segment, TextPlaces } from "../packages/model/src/text-places.ts";

/**
 * Quotation marks by language, outer and inner, as the texts of the site write them (counted
 * in the built articles and answers): [opening, closing]. A pair of one character (Swedish
 * ”…”, the straight "…") opens only at the start of a word and closes only at its end; a
 * closing ’ followed by a letter is an apostrophe (the Lord’s), not the end of a quotation.
 */
const DOUBLE_CURLY = ["“", "”"] as const;
const LOW_HIGH = ["„", "“"] as const;
const LOW_RIGHT = ["„", "”"] as const;
const GUILLEMETS = ["«", "»"] as const;
const SINGLE = ["‘", "’"] as const;
const STRAIGHT = ['"', '"'] as const;
export const QUOTES: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  en: [DOUBLE_CURLY, STRAIGHT, SINGLE],
  ru: [GUILLEMETS, LOW_HIGH, DOUBLE_CURLY],
  uk: [GUILLEMETS, LOW_HIGH, DOUBLE_CURLY],
  bg: [LOW_HIGH, GUILLEMETS],
  sr: [LOW_HIGH, GUILLEMETS],
  es: [GUILLEMETS, DOUBLE_CURLY, SINGLE],
  pt: [DOUBLE_CURLY, SINGLE, GUILLEMETS],
  fr: [GUILLEMETS, DOUBLE_CURLY, SINGLE],
  it: [GUILLEMETS, DOUBLE_CURLY, SINGLE],
  de: [LOW_HIGH, ["‚", "‘"], GUILLEMETS],
  cs: [LOW_HIGH, ["‚", "‘"]],
  pl: [LOW_RIGHT, GUILLEMETS],
  ro: [LOW_RIGHT, GUILLEMETS, SINGLE],
  hu: [LOW_RIGHT, ["»", "«"]],
  nl: [DOUBLE_CURLY, SINGLE],
  tl: [DOUBLE_CURLY, SINGLE],
  vi: [DOUBLE_CURLY, SINGLE],
  sv: [
    ["”", "”"],
    ["»", "»"],
  ],
  fi: [
    ["”", "”"],
    ["»", "»"],
  ],
  nb: [GUILLEMETS, SINGLE],
  da: [
    ["»", "«"],
    ["›", "‹"],
  ],
};
/** For a language not listed: every pair above that cannot be read backwards. */
const ANY_QUOTES: readonly (readonly [string, string])[] = [
  GUILLEMETS,
  DOUBLE_CURLY,
  LOW_HIGH,
  LOW_RIGHT,
  STRAIGHT,
];

/**
 * Longer names that hold a place's name but are something else, read by eye on the built
 * links, by language ("*": every language, a name written alike in all of them). Matched as
 * whole words; nothing inside one is linked, and a place met inside one in the English is
 * linked in no translation of that text.
 */
export const BLOCK: Readonly<Record<string, readonly string[]>> = {
  "*": [
    // Roman cities named after another place: Nablus, the port of Troas, Antioch's colony.
    "Flavia Neapolis",
    "Alexandria Troas",
    "Colonia Caesarea",
    "Syria Palaestina",
    "Syria Phoenice",
  ],
  en: [
    // Gates of today's Old City of Jerusalem, not the towns they face.
    "Damascus Gate",
    "Jaffa Gate",
    // Books named after a place.
    "Jerusalem Talmud",
    "Babylonian Talmud",
    // Another town of the name, or a house named after one.
    "Bethlehem of Galilee",
    "Sisters of Zion",
  ],
  // The book of Exodus ("the record of the going out of Egypt").
  vi: ["Xuất Ê-díp-tô Ký"],
};

/**
 * Places that only some texts mean by their name, and the texts (article ids) that may link
 * them: elsewhere the name is another place's.
 */
export const ONLY_FROM: Readonly<Record<string, readonly string[]>> = {
  // Neapolis, Philippi's port (Acts 16:11); elsewhere Flavia Neapolis (Nablus) or a quarter
  // of Syracuse.
  a6a7150: ["macedonia", "philippi", "troas", "samothrace"],
};

/**
 * Places that the index ties to a form correctly in general but wrongly in one text, read
 * by eye: the text (an article's id, or a question's as `q:<id>`), the place it must not
 * link, the languages (all when none) and why.
 */
export interface Deny {
  readonly text: string;
  readonly place: string;
  readonly langs?: readonly string[];
  readonly why: string;
}
export const DENY: readonly Deny[] = [
  {
    text: "eshtemoa",
    place: "a64f355",
    why: "the Bethel of 1 Sam 30:27 is a town of the Negev (Bethul), not Bethel near Ai",
  },
  // Salamis of the Persian wars is the island off Athens, not the town on Cyprus of Acts 13:5.
  { text: "greece", place: "afa863b", why: "the battle of Salamis, 480 BC" },
  { text: "athens", place: "afa863b", why: "the battle of Salamis, 480 BC" },
  // Caesarea is the city on the coast; these name other cities of the name.
  { text: "iconium", place: "a58735e", why: "Firmilian's Caesarea is Caesarea in Cappadocia" },
  { text: "cappadocia", place: "a58735e", why: "Caesarea, the old Mazaca, in Cappadocia" },
  { text: "caesarea-philippi", place: "a58735e", why: "its first mention is Philip's own city" },
  // The Gilgal of Judah's border (Josh 15:7, Geliloth in Josh 18:17), not the camp by Jericho.
  { text: "geliloth", place: "ab94aea", why: "the Gilgal of Josh 15:7" },
  { text: "adummim", place: "ab94aea", why: "the Gilgal of Josh 15:7" },
  // The Gihon of Eden (Gen 2:13) is a river, not Jerusalem's spring.
  { text: "cush", place: "a2a303c", why: "the river Gihon of Gen 2:13" },
  { text: "tigris", place: "a2a303c", why: "the river Gihon of Gen 2:13" },
  { text: "heliopolis", place: "a3b5b53", why: "Jer 43:13's Beth-shemesh is Heliopolis itself" },
  { text: "luhith", place: "ae067b5", why: "Areopolis is Rabbah of Moab, not of Ammon" },
  { text: "kerioth", place: "a83fd43", why: "the Sharon of the Mesha stele is in Moab" },
  { text: "eglon", place: "ad2048e", why: "Debir is here a king of Eglon (Josh 10:3)" },
  { text: "beth-shan", place: "a6fea11", why: "the house of Ashtaroth is the goddess's temple" },
  { text: "beth-millo", place: "a734b66", why: "the house of Millo at Shechem (Judg 9:6)" },
  { text: "tower-of-shechem", place: "a734b66", why: "the house of Millo at Shechem (Judg 9:6)" },
  { text: "hammath", place: "ae7274b", why: "Josephus' Emmaus by Tiberias is not Luke's" },
  { text: "bethesda", place: "a91b732", why: "a manuscript's reading of the pool's name" },
  // The Heliopolis of the Beqaa is Baalbek, not On in Egypt.
  { text: "abilene", place: "acd9137", why: "Heliopolis here is Baalbek, not On in Egypt" },
  { text: "baal-gad", place: "acd9137", why: "Heliopolis here is Baalbek, not On in Egypt" },
  { text: "valley-of-lebanon", place: "acd9137", why: "Heliopolis here is Baalbek, not On" },
  { text: "zobah", place: "acd9137", why: "Heliopolis here is Baalbek, not On in Egypt" },
  {
    text: "shepham",
    place: "ab2bde8",
    why: "the border's Riblah (Num 34:11) is not on the Orontes",
  },
  // The table of nations' sons are people, not the lands named after them.
  { text: "sheba", place: "ac5a1ec", why: "Cush, son of Ham (Gen 10:7)" },
  { text: "dedan", place: "ac5a1ec", why: "Cush, son of Ham (Gen 10:7)" },
  { text: "arvad", place: "a581f0c", why: "Canaan, son of Ham (Gen 10:18)" },
  { text: "aram", place: "a7e3a59", why: "Elam, son of Shem (Gen 10:22)" },
  { text: "greece", place: "a5f43dd", why: "Tarshish, son of Javan (Gen 10:4)" },
  { text: "greece", place: "aeb46a8", why: "Kittim, sons of Javan (Gen 10:4)" },
  { text: "canaan", place: "a98e4d7", why: "Sidon, firstborn of Canaan (Gen 10:15)" },
  { text: "valley-of-eshcol", place: "aeb9e97", why: "Mamre the Amorite (Gen 14:13)" },
  { text: "zoar", place: "aa0b1d6", why: "Moab, the son Lot's daughter bore (Gen 19:37)" },
  { text: "zoar", place: "a6046fa", why: "Ammon, the son Lot's daughter bore (Gen 19:38)" },
];

/** The words that make a place's name another thing, by language. */
interface Refusal {
  /** Before the name: a gate or a book named after it, a genealogy. */
  readonly before?: RegExp;
  /** After the name. */
  readonly after?: RegExp;
  /** Words near a land's name that make it today's state. */
  readonly modern?: RegExp;
  /**
   * A capitalised word before the name, inside a sentence, is a first name (Moshe Dothan).
   * English only: where the cases free the word order, the word before is as often the
   * subject («Pompeius Rómának», "Pompey [made it subject] to Rome") or an adjective written
   * with a capital (Верхней Галилеи); a translation leaves out what its English refused.
   */
  readonly firstName?: boolean;
  /** Capitalised words that may stand before a name and keep it a place. */
  readonly titles?: RegExp;
}
/**
 * A gate or a book named after a place, in the languages that put the word first: «la Puerta
 * de Susa», «le Talmud de Jérusalem», "Pintuang Damasco". Not "una puerta de Jerusalén", a
 * gate of the town itself.
 */
const GATE = "puerta|porta|porte|poarta|pintuan|pintuang|cổng|cửa";
const NAMED_AFTER = new RegExp(
  `(?<![\\p{L}])(?:${GATE}|talmud|talmude|talmudul)(?:-bayan)?\\s+(?:de|di|del|da|do|d’|ng|van|din|của)?\\s*$`,
  "iu",
);
const A_GATE_OF = new RegExp(
  `(?<![\\p{L}])(?:una|uma|une|un|isang|ay|một)\\s+(?:${GATE})(?:-bayan)?\\s+(?:de|di|del|da|do|d’|ng)?\\s*$`,
  "iu",
);
/** A ruler's numeral after a name: Rameses II, Ptolemy III. */
const NUMERAL_AFTER = /^\s+(?:I{1,3}|IV|VI{0,3}|IX|XI{0,2})(?![\p{L}\p{N}])/u;
const modern = (words: string) => new RegExp(`(?<![\\p{L}])(?:${words})(?![\\p{L}])`, "iu");
export const REFUSE: Readonly<Record<string, Refusal>> = {
  en: {
    before:
      /\b(?:son|sons|daughter|daughters|brother|brothers|father|mother|grandson|descendants?|wife|children) (?:of|from) $/iu,
    after: /^\s+(?:Gate|Talmud)\b/u,
    modern: modern("modern|modern-day|present-day|today|today's|now|current"),
    firstName: true,
    // Adjectives of peoples and ages (Ammonite Rabbah, Judaean Shephelah, Philistine Gath), a
    // possessive (Judah's Negeb) and the words of an edition (New Testament Bethsaida).
    titles:
      /^(?:\p{Lu}\p{L}*(?:ite|ites|ean|ian|an|ine|ic|ish|ese)|\p{Lu}\p{L}*['’]s|Upper|Lower|Northern|Southern|Eastern|Western|Central|Mount|Lake|Old|New|Greater|Little|Greek|Hebrew|Latin|Aramaic|Testament|Iron|Bronze|Late|Early|Middle)$/u,
  },
  ru: {
    modern: modern("современн\\p{L}*|нынешн\\p{L}*|ныне|сегодня|сегодняшн\\p{L}*|теперь"),
  },
  uk: {
    modern: modern("сучасн\\p{L}*|нинішн\\p{L}*|нині|сьогодні|сьогоднішн\\p{L}*|тепер"),
  },
  bg: { modern: modern("днешн\\p{L}*|съвременн\\p{L}*|днес|сега") },
  sr: { modern: modern("данашњ\\p{L}*|савремен\\p{L}*|данас|сада") },
  es: { modern: modern("actual|actuales|moderna?s?|hoy|hoy en día") },
  pt: { modern: modern("atual|atuais|moderna?s?|hoje") },
  fr: { modern: modern("actuel\\p{L}*|moderne\\p{L}*|aujourd’hui|aujourd'hui") },
  it: { modern: modern("odiern\\p{L}*|modern\\p{L}*|attual\\p{L}*|oggi") },
  de: { modern: modern("heutig\\p{L}*|modern\\p{L}*|heute") },
  cs: { modern: modern("dnešní\\p{L}*|současn\\p{L}*|modern\\p{L}*|dnes") },
  pl: {
    modern: modern("dzisiejsz\\p{L}*|współczesn\\p{L}*|obecn\\p{L}*|dziś|dzisiaj"),
  },
  ro: { modern: modern("actual\\p{L}*|modern\\p{L}*|astăzi|azi|astăzi") },
  hu: { modern: modern("ma|mai|mai\\p{L}*|modern\\p{L}*|jelenlegi|napjainkban") },
  nl: {
    modern: modern("huidig\\p{L}*|hedendaags\\p{L}*|modern\\p{L}*|tegenwoordig|nu"),
  },
  sv: { modern: modern("dagens|nutida|modern\\p{L}*|idag|i dag|nu") },
  nb: { modern: modern("dagens|nåtidens|moderne|i dag|nå") },
  da: { modern: modern("dagens|nutidig\\p{L}*|moderne|i dag|nu") },
  fi: {
    modern: modern("nyky\\p{L}*|moderni\\p{L}*|tänään"),
    after: /^\s+portti/iu,
  },
  tl: { modern: modern("kasalukuyang|ngayon|modernong|makabagong") },
  vi: { modern: modern("ngày nay|hiện nay|hiện đại|hiện tại") },
};
/** How many words before a land's name a word of today may stand and make it today's state. */
const MODERN_REACH = 12;
/** English names of lands that are also today's states. */
const MODERN_STATES: ReadonlySet<string> = new Set([
  "Syria",
  "Lebanon",
  "Egypt",
  "Iraq",
  "Turkey",
  "Greece",
  "Italy",
  "Cyprus",
  "Arabia",
]);
/** A word that ends a sentence or a clause before the next one starts. */
const CLAUSE_END = /[.!?:;—–(«“„"»”]\s*$/u;

export interface LinkOptions {
  /** The text's own place and the records it must not link (see above). */
  readonly self?: readonly string[];
  /** Whether a place's page may be linked: it exists and search engines index it. */
  readonly linkable: (place: string) => boolean;
  /** Whether a place is a land (a region, a people's country), for the modern-state rule. */
  readonly land?: (place: string) => boolean;
  /** The text's id and language, for `DENY`, `BLOCK`, `QUOTES` and `REFUSE`. */
  readonly text?: string;
  readonly lang?: string;
  /** In a translation: the places its English text links; no other is linked. */
  readonly allow?: ReadonlySet<string>;
  /**
   * In a translation: places that share their name in this language with another place the
   * English links (Spanish «Babilonia» is Babylon and Babylonia): none of them is linked, the
   * form cannot tell which is meant.
   */
  readonly ambiguous?: ReadonlySet<string>;
  /** Filled with the places a mention of which was refused (BLOCK, REFUSE). */
  readonly refused?: Set<string>;
  /** Told of each mention refused and why (for an audit of the rules). */
  readonly onRefuse?: (place: string, why: string, form: string, context: string) => void;
  readonly deny?: readonly Deny[];
  readonly block?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Cuts a paragraph into the runs that may be linked and those that may not: quotations, as
 * the language writes them, and the longer names of `blocked`. A quotation left open runs to
 * the paragraph's end.
 */
export function quoteRuns(
  text: string,
  lang = "",
  blocked: readonly string[] = [],
): { text: string; quoted: boolean; blocked?: boolean }[] {
  const pairs = QUOTES[lang] ?? ANY_QUOTES;
  const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
  const spans: [number, number, boolean][] = [];
  const stack: (readonly [string, string])[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? "";
    const top = stack.at(-1);
    const prev = text[i - 1];
    const next = text[i + 1];
    // Closing the innermost quotation first.
    if (top && c === top[1]) {
      const apostrophe = (c === "’" || c === "'") && isWord(next) && isWord(prev);
      const symmetric = top[0] === top[1];
      if (!apostrophe && (!symmetric || !isWord(next))) {
        stack.pop();
        if (stack.length === 0) spans.push([start, i + 1, false]);
        continue;
      }
    }
    const pair = pairs.find(([open]) => open === c);
    if (!pair) continue;
    // A mark of one character opens only before a word, not after one (it ends one then).
    if (pair[0] === pair[1] && (isWord(prev) || (!isWord(next) && next !== "…"))) continue;
    if (pair[0] === "‘" && isWord(prev)) continue;
    if (stack.length === 0) start = i;
    stack.push(pair);
  }
  if (stack.length) spans.push([start, text.length, false]);
  // The longer names, outside quotations.
  if (blocked.length) {
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${blocked.map((b) => escapeRegExp(b).replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
      "gu",
    );
    for (const m of text.matchAll(re)) {
      const a = m.index;
      const b = a + m[0].length;
      if (!spans.some(([s, e]) => a < e && b > s)) spans.push([a, b, true]);
    }
    spans.sort((x, y) => x[0] - y[0]);
  }
  const out: { text: string; quoted: boolean; blocked?: boolean }[] = [];
  let at = 0;
  for (const [s, e, isBlock] of spans) {
    if (s > at) out.push({ text: text.slice(at, s), quoted: false });
    out.push({ text: text.slice(s, e), quoted: true, ...(isBlock ? { blocked: true } : {}) });
    at = e;
  }
  if (at < text.length) out.push({ text: text.slice(at), quoted: false });
  return out;
}

const key = (s: string) => s.replace(/\s+/g, " ").replace(/ё/g, "е").replace(/Ё/g, "Е");
/** Every form of the index in a text, with its place (all of them; `splitPlaces` keeps the first). */
function* matches(text: string, index: TextPlaces) {
  for (const m of text.matchAll(index.pattern)) {
    const k = key(m[0]);
    const id =
      index.forms[k] ?? index.forms[k.replace(/'/g, "’")] ?? index.forms[k.replace(/’/g, "'")];
    if (id === undefined) continue;
    yield { start: m.index, text: m[0], key: k, id };
  }
}

/** Why a mention is not the place, or nothing: the words around it (`REFUSE`). */
export function refusal(
  before: string,
  after: string,
  lang: string,
  isLand: boolean,
  form: string,
): string | undefined {
  const r = REFUSE[lang];
  if (NUMERAL_AFTER.test(after)) return "numeral";
  if (NAMED_AFTER.test(before) && !A_GATE_OF.test(before)) return "named after";
  if (r?.before?.test(before)) return "genealogy";
  if (r?.after?.test(after)) return "named after";
  if (r?.firstName) {
    const m = /(\p{Lu}[\p{Ll}’'-]*)\s+$/u.exec(before);
    if (m && !r.titles?.test(m[1] ?? "")) {
      const earlier = before.slice(0, m.index);
      if (earlier.trim() !== "" && !CLAUSE_END.test(earlier)) return "first name";
    }
  }
  if (isLand && r?.modern) {
    // The sentence so far, up to MODERN_REACH words back ("Today four states meet at the
    // gulf: Egypt, …"), and the next few words ("Syria today").
    const sentence = (before.split(/[.!?;]/u).at(-1) ?? "").trim();
    // "Modern scholars", "modern translations" speak of today's readers, not today's map.
    const near = sentence
      .split(/\s+/u)
      .slice(-MODERN_REACH)
      .join(" ")
      .replace(
        /\bmodern\s+(?:scholars|scholarship|translations|translators|editions|commentators|readers|interpreters)\b/giu,
        "",
      );
    const next = (after.split(/[.!?;:,—–]/u)[0] ?? "").trim().split(/\s+/u).slice(0, 3).join(" ");
    if (r.modern.test(near) || r.modern.test(next)) return "modern state";
  }
  // "The North Aegean region of Greece", "the Homs governorate of Syria": today's provinces.
  if (
    lang === "en" &&
    MODERN_STATES.has(form) &&
    /\b(?:governorate|district|region|municipality|prefecture|county)\s+of\s+$/iu.test(before)
  )
    return "modern state";
  // "In southern Syria", "South Lebanon": a part of today's state, where a village is placed.
  // The Upper and Lower Egypt of the pharaohs stay.
  if (
    lang === "en" &&
    MODERN_STATES.has(form) &&
    /\b(?:northern|southern|eastern|western|central|north-eastern|north-western|south-eastern|south-western|north|south|east|west)\s+$/iu.test(
      before,
    )
  )
    return "modern state";
  // The river is "the Jordan" ("the lower Jordan", "the whole Jordan valley"); "in Jordan",
  // "Jordan's Karak governorate", is the kingdom east of it.
  if (
    lang === "en" &&
    form === "Jordan" &&
    (!/\bthe\s+(?:[\p{Ll}-]+\s+){0,2}$/iu.test(before) || /^['’]s\b/u.test(after))
  )
    return "modern state";
  return undefined;
}

/**
 * The paragraphs cut into plain runs and the places they link, each place at most once in
 * all of them (its first mention that is the place, outside quotation marks).
 */
export function linkParagraphs(
  paragraphs: readonly string[],
  index: TextPlaces,
  o: LinkOptions,
): Segment[][] {
  const lang = o.lang ?? "";
  const denied = new Set(
    (o.deny ?? DENY)
      .filter((d) => d.text === o.text && (!d.langs || d.langs.includes(lang)))
      .map((d) => d.place),
  );
  const blockList = o.block ?? BLOCK;
  const blocked = [...(blockList["*"] ?? []), ...(blockList[lang] ?? [])];
  const seen = new Set<string>(o.self ?? []);
  const personal = new Set<string>();
  const refuse = (id: string, why: string, form: string, context = "") => {
    if (!id) return;
    o.refused?.add(id);
    o.onRefuse?.(id, why, form, context);
  };
  return paragraphs.map((para) => {
    const out: Segment[] = [];
    let offset = 0;
    for (const run of quoteRuns(para, lang, blocked)) {
      const runStart = offset;
      offset += run.text.length;
      if (run.quoted) {
        // A place named inside a longer name that is something else: refused in this text.
        if (run.blocked) for (const m of matches(run.text, index)) refuse(m.id, "block", run.text);
        out.push({ text: run.text });
        continue;
      }
      let at = 0;
      for (const m of matches(run.text, index)) {
        if (!m.id || seen.has(m.id)) continue;
        const before = para.slice(0, runStart + m.start);
        const after = run.text.slice(m.start + m.text.length);
        // "Jordan Peterson": a first name the index lists, beside a capitalised word.
        if (
          index.names.has(m.key) &&
          (/^\s+\p{Lu}/u.test(after) ||
            (/\p{Lu}\p{Ll}*\s+$/u.test(before) &&
              !/(?:^|[.!?:—]\s*)\p{Lu}\p{Ll}*\s+$/u.test(before)))
        )
          continue;
        const why = personal.has(m.id)
          ? "person"
          : refusal(before, after, lang, o.land?.(m.id) ?? false, m.key);
        // A name that was a person's here ("Moshe Dothan") stays the person's in this text:
        // "Dothan's work" further on is his.
        if (why === "first name" || why === "numeral" || why === "genealogy") personal.add(m.id);
        if (why) {
          refuse(m.id, why, m.text, before.slice(-60) + "⟦" + m.text + "⟧" + after.slice(0, 30));
          continue;
        }
        if (ONLY_FROM[m.id] && !ONLY_FROM[m.id]?.includes(o.text ?? "")) {
          refuse(m.id, "only from", m.text);
          continue;
        }
        // A form matched marks its place as met, linked or not: a later mention is not the
        // first, and a place that cannot be linked here cannot be linked further on either.
        seen.add(m.id);
        const ok =
          o.linkable(m.id) &&
          !denied.has(m.id) &&
          (!o.allow || o.allow.has(m.id)) &&
          !o.ambiguous?.has(m.id);
        if (!ok) continue;
        if (m.start > at) out.push({ text: run.text.slice(at, m.start) });
        out.push({ text: m.text, place: m.id });
        at = m.start + m.text.length;
      }
      if (at < run.text.length) out.push({ text: run.text.slice(at) });
    }
    // Runs of plain text side by side, joined.
    return out.reduce<Segment[]>((acc, s) => {
      const last = acc.at(-1);
      if (last && !last.place && !s.place) acc[acc.length - 1] = { text: last.text + s.text };
      else acc.push(s);
      return acc;
    }, []);
  });
}

/** The places linked in paragraphs cut by `linkParagraphs`. */
export const linkedPlaces = (paras: readonly (readonly Segment[])[]): Set<string> =>
  new Set(paras.flatMap((segs) => segs.flatMap((s) => (s.place ? [s.place] : []))));
