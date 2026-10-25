/**
 * The whole Bible from one of eBible.org's USFM zips or a CrossWire SWORD module
 * (pipeline/.cache): verse texts keyed "Gen.12.6", in the edition's own numbering. Used by
 * build-verses.ts for the verses the places cite and by build-text-places.ts to tell names
 * from ordinary words. The editions themselves (SOURCES) and the mending of what their
 * digital texts garbled (REPAIRS) are here too, so both scripts read the same Bible.
 */
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import type { Locale } from "../packages/model/src/time.ts";

/** USFM book codes → OSIS. */
export const OSIS: Record<string, string> = {
  GEN: "Gen",
  EXO: "Exod",
  LEV: "Lev",
  NUM: "Num",
  DEU: "Deut",
  JOS: "Josh",
  JDG: "Judg",
  RUT: "Ruth",
  "1SA": "1Sam",
  "2SA": "2Sam",
  "1KI": "1Kgs",
  "2KI": "2Kgs",
  "1CH": "1Chr",
  "2CH": "2Chr",
  EZR: "Ezra",
  NEH: "Neh",
  EST: "Esth",
  JOB: "Job",
  PSA: "Ps",
  PRO: "Prov",
  ECC: "Eccl",
  SNG: "Song",
  ISA: "Isa",
  JER: "Jer",
  LAM: "Lam",
  EZK: "Ezek",
  DAN: "Dan",
  HOS: "Hos",
  JOL: "Joel",
  AMO: "Amos",
  OBA: "Obad",
  JON: "Jonah",
  MIC: "Mic",
  NAM: "Nah",
  HAB: "Hab",
  ZEP: "Zeph",
  HAG: "Hag",
  ZEC: "Zech",
  MAL: "Mal",
  MAT: "Matt",
  MRK: "Mark",
  LUK: "Luke",
  JHN: "John",
  ACT: "Acts",
  ROM: "Rom",
  "1CO": "1Cor",
  "2CO": "2Cor",
  GAL: "Gal",
  EPH: "Eph",
  PHP: "Phil",
  COL: "Col",
  "1TH": "1Thess",
  "2TH": "2Thess",
  "1TI": "1Tim",
  "2TI": "2Tim",
  TIT: "Titus",
  PHM: "Phlm",
  HEB: "Heb",
  JAS: "Jas",
  "1PE": "1Pet",
  "2PE": "2Pet",
  "1JN": "1John",
  "2JN": "2John",
  "3JN": "3John",
  JUD: "Jude",
  REV: "Rev",
};

/** Plain verse text from a line of USFM: words kept, notes and markers dropped. */
function plain(text: string): string {
  return (
    text
      .replace(/\\f .*?\\f\*/g, "")
      .replace(/\\x .*?\\x\*/g, "")
      .replace(/\\\+?w ([^|\\]*)(?:\|[^\\]*)?\\\+?w\*/g, "$1")
      // Nested markers too: the KJV sets italics inside the words of Jesus as \+add.
      .replace(/\\\+?[a-z]+\d*\*?/g, "")
      .replace(/¶/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** "Gen.12.6" → text, for the whole Bible in one USFM zip. */
export function readBible(zip: string): Map<string, string> {
  const verses = new Map<string, string>();
  const listing = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n");
  for (const name of listing.filter((n) => n.endsWith(".usfm"))) {
    const usfm = execFileSync("unzip", ["-p", zip, name], { encoding: "utf8", maxBuffer: 1 << 26 });
    let book: string | undefined;
    let chapter = 0;
    let key: string | undefined;
    for (const line of usfm.split("\n")) {
      const marker = /^\\([a-z]+\d*)\s?(.*)$/.exec(line.trim());
      const [tag, rest] = marker ? [marker[1], marker[2] ?? ""] : [undefined, line.trim()];
      if (tag === "id") {
        book = OSIS[rest.split(/\s/)[0] ?? ""];
        key = undefined;
      } else if (tag === "c") {
        chapter = Number.parseInt(rest, 10);
        key = undefined;
      } else if (tag === "v" && book) {
        const v = /^(\d+)\s*(.*)$/.exec(rest);
        if (!v) continue;
        key = `${book}.${String(chapter)}.${v[1] ?? ""}`;
        verses.set(key, plain(v[2] ?? ""));
      } else if (
        tag === "d" ||
        tag === "s1" ||
        tag === "mt1" ||
        tag === "h" ||
        tag?.startsWith("toc")
      ) {
        key = undefined;
      } else if (
        key &&
        rest &&
        (tag === undefined || tag === "p" || tag === "q1" || tag === "q2" || tag === "m")
      ) {
        verses.set(key, `${verses.get(key) ?? ""} ${plain(rest)}`.trim());
      }
    }
  }
  return verses;
}

/** The verse grids a SWORD module can file its text into (its .conf, `Versification=`). */
export type Versification = "KJV" | "NRSV" | "NRSVA";

/**
 * A SWORD module's versification, read from its mods.d/*.conf; KJV when the line is missing,
 * as SWORD itself assumes. Any other grid is refused: readSword could not place its verses.
 */
export function swordVersification(zip: string): Versification {
  const files = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n");
  const conf = files.find((f) => f.endsWith(".conf"));
  if (!conf) throw new Error(`${zip}: no .conf`);
  const text = execFileSync("unzip", ["-p", zip, conf], { encoding: "utf8" });
  const v = /^Versification=(\S+)/m.exec(text)?.[1] ?? "KJV";
  if (v !== "KJV" && v !== "NRSV" && v !== "NRSVA")
    throw new Error(`${zip}: versification ${v} is not one readSword knows`);
  return v;
}

/**
 * The whole Bible from a CrossWire SWORD zText module zip (pipeline/.cache), for an edition
 * eBible.org does not carry. The module's verse index follows its versification, so the
 * chapter sizes come from the KJV (`kjv`, as readBible returns it): each testament opens with
 * two header entries, each book with one, each chapter with one, then its verses.
 *
 * NRSV differs from the KJV in two chapters only (3 John 1 has 15 verses, Revelation 12 has
 * 18). NRSVA is NRSV with the Apocrypha after Malachi, so its Old Testament index runs on past
 * the 39 books read here. The module's own .conf names its grid; a caller may say otherwise.
 */
export function readSword(
  zip: string,
  kjv: Map<string, string>,
  versification: Versification = swordVersification(zip),
): Map<string, string> {
  const sizes = new Map<string, number>();
  for (const ref of kjv.keys()) {
    const ch = ref.split(".").slice(0, 2).join(".");
    sizes.set(ch, (sizes.get(ch) ?? 0) + 1);
  }
  if (versification !== "KJV") {
    sizes.set("3John.1", 15);
    sizes.set("Rev.12", 18);
  }
  const books = Object.values(OSIS);
  const files = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n");
  const read = (suffix: string): Buffer => {
    const name = files.find((f) => f.endsWith(suffix));
    if (!name) throw new Error(`${zip}: no ${suffix}`);
    return execFileSync("unzip", ["-p", zip, name], { maxBuffer: 1 << 27 });
  };
  const verses = new Map<string, string>();
  for (const [testament, list] of [
    ["ot", books.slice(0, 39)],
    ["nt", books.slice(39)],
  ] as const) {
    const bzs = read(`${testament}.bzs`);
    const bzv = read(`${testament}.bzv`);
    const bzz = read(`${testament}.bzz`);
    const blocks = new Map<number, Buffer>();
    const block = (i: number): Buffer => {
      let b = blocks.get(i);
      if (!b) {
        const at = bzs.readUInt32LE(i * 12);
        b = inflateSync(bzz.subarray(at, at + bzs.readUInt32LE(i * 12 + 4)));
        blocks.set(i, b);
      }
      return b;
    };
    let index = 2;
    for (const book of list) {
      index++;
      for (let c = 1; sizes.has(`${book}.${String(c)}`); c++) {
        index++;
        const n = sizes.get(`${book}.${String(c)}`) ?? 0;
        for (let v = 1; v <= n; v++, index++) {
          const size = bzv.readUInt16LE(index * 10 + 8);
          if (!size) continue;
          const at = bzv.readUInt32LE(index * 10 + 4);
          const osis = block(bzv.readUInt32LE(index * 10))
            .subarray(at, at + size)
            .toString("utf8");
          const text = osis
            .replace(/<(note|title)\b[^>]*>[\s\S]*?<\/\1>/g, "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (text) verses.set(`${book}.${String(c)}.${String(v)}`, text);
        }
      }
    }
    // The Apocrypha follow Malachi in an NRSVA module: its Old Testament index is longer.
    const fits =
      versification === "NRSVA" && testament === "ot"
        ? index * 10 <= bzv.length
        : index * 10 === bzv.length;
    if (!fits) throw new Error(`${zip}: ${testament} index does not fit the ${versification}`);
  }
  return verses;
}

/** One edition the verse cards quote: where it comes from and what it is. */
export interface BibleSource {
  readonly name: string;
  readonly url: string;
  /** Its file in pipeline/.cache: eBible.org's `*_usfm.zip`, or a SWORD module's zip. */
  readonly file: string;
  readonly license: string;
  /** The edition as its own title names it, for the sources page (docs/sources.html). */
  readonly title: string;
  /** The edition's page at eBible.org or CrossWire, the electronic text credited. */
  readonly page: string;
}

/**
 * The Bible of each language the code knows: classic public-domain editions, from eBible.org
 * where it has one, else CrossWire's SWORD modules. Russian is the Synodal text, English the
 * KJV. A language that joins the site brings its edition here first: build-verses.ts writes
 * its verses, build-text-places.ts reads it to tell names from ordinary words.
 */
export const SOURCES: Readonly<Record<Locale, BibleSource>> = {
  ru: {
    name: "Russian Synodal Bible (eBible.org russyn)",
    url: "https://ebible.org/Scriptures/russyn_usfm.zip",
    file: "russyn_usfm.zip",
    license: "public domain",
    title: "Синодальный перевод (1876)",
    page: "https://ebible.org/russyn/",
  },
  en: {
    name: "King James Version (eBible.org eng-kjv2006)",
    url: "https://ebible.org/Scriptures/eng-kjv2006_usfm.zip",
    file: "eng-kjv2006_usfm.zip",
    license: "public domain (Crown copyright in the UK)",
    title: "King James Version (Authorized Version), the standard text of 1769",
    page: "https://ebible.org/eng-kjv2006/",
  },
  uk: {
    name: "Ukrainian Bible, P. Kulish and I. Puluj, 1905 (eBible.org ukr1871)",
    url: "https://ebible.org/Scriptures/ukr1871_usfm.zip",
    file: "ukr1871_usfm.zip",
    license: "public domain",
    title: "Біблія в перекладі П. Куліша та І. Пулюя (1905)",
    page: "https://ebible.org/ukr1871/",
  },
  es: {
    name: "Reina-Valera 1909 (eBible.org spaRV1909)",
    url: "https://ebible.org/Scriptures/spaRV1909_usfm.zip",
    file: "spaRV1909_usfm.zip",
    license: "public domain",
    title: "Santa Biblia, Reina-Valera 1909",
    page: "https://ebible.org/spaRV1909/",
  },
  pt: {
    name: "World Portuguese Bible (eBible.org porbrbsl)",
    url: "https://ebible.org/Scriptures/porbrbsl_usfm.zip",
    file: "porbrbsl_usfm.zip",
    license: "public domain",
    title: "Bíblia Portuguesa Mundial",
    page: "https://ebible.org/porbrbsl/",
  },
  fr: {
    name: "Louis Segond 1910 (eBible.org fraLSG)",
    url: "https://ebible.org/Scriptures/fraLSG_usfm.zip",
    file: "fraLSG_usfm.zip",
    license: "public domain",
    title: "Louis Segond 1910",
    page: "https://ebible.org/fraLSG/",
  },
  de: {
    name: "Luther Bible 1912 (eBible.org deu1912)",
    url: "https://ebible.org/Scriptures/deu1912_usfm.zip",
    file: "deu1912_usfm.zip",
    license: "public domain",
    title: "Lutherbibel 1912",
    page: "https://ebible.org/deu1912/",
  },
  it: {
    name: "Riveduta 1927 (eBible.org ita1927)",
    url: "https://ebible.org/Scriptures/ita1927_usfm.zip",
    file: "ita1927_usfm.zip",
    license: "public domain",
    title: "Riveduta 1927",
    page: "https://ebible.org/ita1927/",
  },
  nl: {
    name: "Statenvertaling, 1917 edition (eBible.org nld)",
    url: "https://ebible.org/Scriptures/nld_usfm.zip",
    file: "nld_usfm.zip",
    license: "public domain",
    title: "De Heilige Schrift (Statenvertaling), editie 1917",
    page: "https://ebible.org/nld/",
  },
  // Not on eBible.org: CrossWire's SWORD module of the Gdańsk Bible.
  pl: {
    name: "Biblia Gdańska 1881 (CrossWire PolGdanska)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/PolGdanska.zip",
    file: "PolGdanska.zip",
    license: "public domain",
    title: "Biblia Gdańska, wydanie 1881",
    page: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=PolGdanska",
  },
  cs: {
    name: "Bible kralická 1613 (eBible.org ces1613)",
    url: "https://ebible.org/Scriptures/ces1613_usfm.zip",
    file: "ces1613_usfm.zip",
    license: "public domain",
    title: "Bible kralická (1613)",
    page: "https://ebible.org/ces1613/",
  },
  zh: {
    name: "Chinese Union Version, simplified (eBible.org cmn-cu89s)",
    url: "https://ebible.org/Scriptures/cmn-cu89s_usfm.zip",
    file: "cmn-cu89s_usfm.zip",
    license: "public domain",
    title: "和合本 (Chinese Union Version), 简体",
    page: "https://ebible.org/cmn-cu89s/",
  },
  // The Nordic Bibles and the Tagalog one are SWORD modules too (2026-10-23); the Swedish
  // and Danish ones file their verses in the NRSV's grid (their .conf says so).
  sv: {
    name: "Bibeln 1917 (CrossWire Swe1917)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Swe1917.zip",
    file: "Swe1917.zip",
    license: "public domain",
    title: "Bibeln 1917",
    page: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Swe1917",
  },
  da: {
    name: "Bibelen, OT 1871 and NT 1907 (CrossWire DaOT1871NT1907)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/DaOT1871NT1907.zip",
    file: "DaOT1871NT1907.zip",
    license: "public domain",
    title: "Bibelen: Det Gamle Testamente 1871, Det Nye Testamente 1907",
    page: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=DaOT1871NT1907",
  },
  nb: {
    name: "Bibelen 1930, Det Norske Bibelselskap (CrossWire Norsk)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Norsk.zip",
    file: "Norsk.zip",
    license: "public domain",
    title: "Bibelen 1930, Det Norske Bibelselskap",
    page: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Norsk",
  },
  sr: {
    name: "Serbian Bible, Daničić–Karadžić translation, Cyrillic (eBible.org srp1868)",
    url: "https://ebible.org/Scriptures/srp1868_usfm.zip",
    file: "srp1868_usfm.zip",
    license: "public domain",
    title: "Свето писмо, превод Даничић–Караџић",
    page: "https://ebible.org/srp1868/",
  },
  tl: {
    name: "Ang Biblia 1905, Philippine Bible Society (CrossWire TagAngBiblia)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/TagAngBiblia.zip",
    file: "TagAngBiblia.zip",
    license: "public domain",
    title: "Ang Biblia (1905), Philippine Bible Society",
    page: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=TagAngBiblia",
  },
};

/** Whether an edition is an eBible.org USFM zip (else a SWORD module, read by readSword). */
export const isUsfm = (src: BibleSource): boolean => src.file.endsWith("_usfm.zip");

/**
 * What the digital editions garbled, mended before a verse is shown or read: the Kralice
 * text has its capital Č and Ď in the wrong code page (È, Ï), the Gdańsk module a handful of
 * misread letters, and the Swedish 1917 module carries the edition's footnotes in the verses
 * themselves: a mark on the word («Eva[1]») and the notes after the chapter's last verse
 * (« [1] Hebr. adám»), with square brackets round the passages its editors doubted
 * (Mark 16:9–20, John 7:53–8:11). The Danish edition brackets those passages and the words
 * its translators supplied («[for hine]»); the Danish and Norwegian modules mark a footnoted
 * word with stars («Harmagedon**», «Orion*»): the cards show the words without the marks.
 * One Swedish verse ends in a cross-reference (2 Kings 12:1, «&gt;2 Krön 24,1 f.»), and two
 * Norwegian ones have æ and ø in the wrong code page (Hosea 5:13, 10:14: «Ã¦», «Ã¸»).
 */
export const REPAIRS: Readonly<Partial<Record<Locale, readonly (readonly [RegExp, string])[]>>> = {
  cs: [
    [/È/g, "Č"],
    [/Ï/g, "Ď"],
  ],
  pl: [
    [/byÜi/g, "byli"],
    [/spłodzi×/g, "spłodził"],
    [/urodzi×a/g, "urodziła"],
    [/(narod|talent)íw/g, "$1ów"],
    [/Çwiczy/g, "Ćwiczy"],
    [/mójâ/g, "mój!"],
    [/sií/g, "się"],
    [/őwiczenie/g, "ćwiczenie"],
    // The 1881 word for the Cushites is a slur today: the cards say Etiopczyk, as modern Polish Bibles do.
    [/Murzyn(owie|i)\b/g, "Etiopczycy"],
    [/Murzynka\b/g, "Etiopka"],
    [/Murzynk([ięa])\b/g, "Etiopk$1"],
    [/Murzyn(a|ów|om|ami|ach)\b/g, "Etiopczyk$1"],
    [/Murzynie\b/g, "Etiopczyku"],
    [/Murzyn\b/g, "Etiopczyk"],
    [/Murzyńsk/g, "Etiopsk"],
    [/murzyńsk/g, "etiopsk"],
  ],
  sv: [
    // The notes, from the first mark that stands on its own to the end of the verse.
    [/\s\[\d+\].*$/, ""],
    [/\[\d+\]/g, ""],
    [/^\[|\]$/g, ""],
    [/\s&gt;.*$/, ""],
    [/\s+$/, ""],
    // 2 Kings 5:12 lost its preposition in the module.
    [/alla vatten Israel/g, "alla vatten i Israel"],
  ],
  da: [
    [/[[\]*]/g, ""],
    [/\bjsom\b/g, "som"],
  ],
  nb: [
    [/\*/g, ""],
    [/Ã¦/g, "æ"],
    [/Ã¸/g, "ø"],
  ],
};

/** A verse's text with its edition's garbles mended (REPAIRS). */
export const repair = (locale: string, text: string): string =>
  (REPAIRS[locale as Locale] ?? []).reduce((t, [re, to]) => t.replace(re, to), text);
