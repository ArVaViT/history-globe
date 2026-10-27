/**
 * The whole Bible from one of eBible.org's USFM zips or a CrossWire SWORD module
 * (pipeline/.cache): verse texts keyed "Gen.12.6", in the edition's own numbering. Used by
 * build-verses.ts for the verses the places cite and by build-text-places.ts to tell names
 * from ordinary words. The editions themselves (SOURCES) and the mending of what their
 * digital texts garbled (REPAIRS) are here too, so both scripts read the same Bible.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { toSynodal } from "../packages/model/src/synodal.ts";
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
export type Versification = "KJV" | "NRSV" | "NRSVA" | "Calvin";

/**
 * The chapters whose verse count in SWORD's Calvin grid (the Geneva Bibles' numbering, which
 * the Hungarian Károli Bible follows) differs from the KJV's: the psalms count their titles
 * as verse 1, and a few chapters start or end a verse off (Num 12–13, Job 38–41, Mark 9–10).
 * Read from vm_calvin in SWORD's include/canon_calvin.h; its books and chapters are the KJV's.
 */
export const CALVIN: Readonly<Record<string, number>> = {
  "Num.12": 15,
  "Num.13": 34,
  "Num.29": 39,
  "Num.30": 17,
  "1Sam.20": 43,
  "1Sam.23": 28,
  "1Sam.24": 23,
  "1Kgs.22": 54,
  "Job.38": 38,
  "Job.39": 38,
  "Job.40": 28,
  "Job.41": 25,
  "Ps.3": 9,
  "Ps.4": 9,
  "Ps.5": 13,
  "Ps.6": 11,
  "Ps.7": 18,
  "Ps.8": 10,
  "Ps.9": 21,
  "Ps.12": 9,
  "Ps.18": 51,
  "Ps.19": 15,
  "Ps.20": 10,
  "Ps.21": 14,
  "Ps.22": 32,
  "Ps.30": 13,
  "Ps.31": 25,
  "Ps.34": 23,
  "Ps.36": 13,
  "Ps.38": 23,
  "Ps.39": 14,
  "Ps.40": 18,
  "Ps.41": 14,
  "Ps.42": 12,
  "Ps.44": 27,
  "Ps.45": 18,
  "Ps.46": 12,
  "Ps.47": 10,
  "Ps.48": 15,
  "Ps.49": 21,
  "Ps.51": 21,
  "Ps.52": 11,
  "Ps.53": 7,
  "Ps.54": 9,
  "Ps.55": 24,
  "Ps.56": 14,
  "Ps.57": 12,
  "Ps.58": 12,
  "Ps.59": 18,
  "Ps.60": 14,
  "Ps.61": 9,
  "Ps.62": 13,
  "Ps.63": 12,
  "Ps.64": 11,
  "Ps.65": 14,
  "Ps.67": 8,
  "Ps.68": 36,
  "Ps.69": 37,
  "Ps.70": 6,
  "Ps.75": 11,
  "Ps.76": 13,
  "Ps.77": 21,
  "Ps.80": 20,
  "Ps.81": 17,
  "Ps.83": 19,
  "Ps.84": 13,
  "Ps.85": 14,
  "Ps.88": 19,
  "Ps.89": 53,
  "Ps.92": 16,
  "Ps.102": 29,
  "Ps.108": 14,
  "Ps.140": 14,
  "Ps.142": 8,
  "Eccl.11": 8,
  "Eccl.12": 16,
  "Isa.8": 23,
  "Isa.9": 20,
  "Ezek.20": 44,
  "Ezek.21": 37,
  "Hos.11": 11,
  "Hos.12": 15,
  "Jonah.1": 16,
  "Jonah.2": 11,
  "Mark.9": 51,
  "Mark.10": 53,
  "Acts.19": 40,
  "Acts.24": 28,
  "Rom.3": 30,
  "Rom.8": 38,
  "1Cor.3": 22,
  "2Cor.13": 13,
  "3John.1": 15,
  "Rev.12": 18,
};

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
  if (v !== "KJV" && v !== "NRSV" && v !== "NRSVA" && v !== "Calvin")
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
 * the 39 books read here. Calvin (the Geneva Bibles' grid, Hungarian Károli) differs in the
 * chapters CALVIN lists. The module's own .conf names its grid; a caller may say otherwise.
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
  if (versification === "Calvin") for (const [ch, n] of Object.entries(CALVIN)) sizes.set(ch, n);
  else if (versification !== "KJV") {
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

/** Verses per chapter ("Ps.51" → 19) of a Bible keyed "Gen.12.6". */
export function chapterSizes(bible: ReadonlyMap<string, string>): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const ref of bible.keys()) {
    const ch = ref.split(".").slice(0, 2).join(".");
    sizes.set(ch, (sizes.get(ch) ?? 0) + 1);
  }
  return sizes;
}

/**
 * Chapters (English numbering) whose Synodal verses toSynodal keeps as they are, though the
 * Synodal text merges or adds verses in them (see synodal.ts): no verse there can be placed
 * through the Synodal grid.
 */
export const SYNODAL_UNCERTAIN: ReadonlySet<string> = new Set([
  "Lev.14",
  "Josh.24",
  "Prov.4",
  "Prov.13",
  "Rom.14",
  "Rom.15",
  "Rom.16",
  "Rev.12",
]);

/** Wikisource's own numbering slips in Biblia 1914 (an anchor typed with a digit too many). */
const ANCHOR_SLIPS: Readonly<Record<string, string>> = { "Ps.118.1288": "Ps.118.128" };

/** Plain verse text from a line of Wikisource's wikitext: words kept, markup dropped. */
function plainWiki(text: string): string {
  return text
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The 66 books of Biblia 1914 from the bundle build-verses.ts makes of its Wikisource pages
 * (`{ "Gen": wikitext, … }`, scripts/biblia-1914.json pins each page's revision), in the
 * edition's own numbering, the Septuagint's (Ps 22 is the Lord-my-shepherd psalm). Each verse
 * is a line opened by its anchor, `<span id="1.2"/>2. Și pământul …`: the anchor gives the
 * chapter and verse, the printed number goes; section titles (`<center>`), the
 * cross-references (`<div>`), the prologues and the epistles' closing notes are not verses.
 */
export function readBiblia1914(path: string): Map<string, string> {
  const pages = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  const verses = new Map<string, string>();
  for (const [book, wiki] of Object.entries(pages)) {
    for (const line of wiki.split("\n")) {
      const m = /^<span id="(\d+)\.(\d+)"\/>(.*)$/.exec(line.trim());
      if (!m) continue;
      const ref = `${book}.${m[1] ?? ""}.${m[2] ?? ""}`;
      // The printed number, typed «6.», now and then «6,», «19:», «4» or «65.Și».
      const text = plainWiki(m[3] ?? "").replace(/^\d+\s?[.,:;]?\s*/, "");
      if (text) verses.set(ANCHOR_SLIPS[ref] ?? ref, text);
    }
  }
  return verses;
}

/**
 * The Tsarigrad Bible (1871, the 1914 printing in modern spelling) from its plain text at the
 * Internet Archive: `## Битие` opens a book (the 66 in the KJV's order), `### 3 Глава` or
 * `### 23 Псалм` a chapter, `16. …` a verse, numbered as the KJV numbers them. A psalm's title
 * opens its verse 1 in brackets (`1. [ Псалом Давидов. ] Господ е Пастир мой`), with the
 * Slavonic number of the psalm: it is not part of the verse, as in the KJV. Stray lines (a
 * lone number) are not verses.
 */
export function readTsarigrad(path: string): Map<string, string> {
  const books = Object.values(OSIS);
  const verses = new Map<string, string>();
  let b = -1;
  let chapter = 0;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      b++;
      chapter = 0;
      continue;
    }
    const c = /^### (\d+) (?:Глава|Псалм)$/.exec(line);
    if (c) {
      chapter = Number(c[1]);
      continue;
    }
    const v = /^(\d+)\. (.*)$/.exec(line);
    const book = books[b];
    if (!v || !book || !chapter) continue;
    let text = (v[2] ?? "").replace(/\s+/g, " ").trim();
    if (book === "Ps" && v[1] === "1") text = text.replace(/^\[[^\]]*\]\s*/, "");
    if (text) verses.set(`${book}.${String(chapter)}.${v[1] ?? ""}`, text);
  }
  if (b !== books.length - 1) throw new Error(`${path}: ${String(b + 1)} books, not 66`);
  return verses;
}

/**
 * The psalm and verse of the Septuagint's Psalter (Biblia 1914) for a psalm verse in the
 * English numbering, before any verse division is compared: 9–10 are one psalm (9), 114–115
 * one (113), 116 two (114, 115), 147 two (146, 147); the psalms between count one less. The
 * offsets are the verses of the psalm that comes first in the joined one (Ps 9 has 20, Ps 114
 * has 8), or of the part split off.
 */
function septuagintPsalm(chapter: number, verse: number): [number, number] {
  if (chapter <= 8 || chapter >= 148) return [chapter, verse];
  if (chapter === 10) return [9, verse + 20];
  if (chapter === 115) return [113, verse + 8];
  if (chapter === 116) return verse <= 9 ? [114, verse] : [115, verse - 9];
  if (chapter === 147) return verse <= 11 ? [146, verse] : [147, verse - 11];
  return [chapter <= 9 ? chapter : chapter - 1, verse];
}

/**
 * Gale and Church's length-based alignment (Computational Linguistics 19:1, 1993), verse
 * by verse: the cheapest way to pair the verse lengths `a` (the KJV's) with `b` (another
 * edition's), each pairing 1–1, 1–0, 0–1, 2–1, 1–2 or 2–2 verses, a pair's cost the
 * improbability of its length difference (the chapter's own length ratio, variance 6.8 per
 * character) and of its kind. Returns, for each index of `a`, whether it was paired 1–1 with
 * the same index of `b` and its neighbours were too: a verse cut otherwise in the edition
 * (Gen 24:57–58, the Septuagint's extra Exod 2:22) changes the pairing round it.
 */
export function alignedByLength(a: readonly number[], b: readonly number[]): boolean[] {
  const kinds: readonly (readonly [number, number, number])[] = [
    [1, 1, 0.89],
    [1, 0, 0.005],
    [0, 1, 0.005],
    [2, 1, 0.045],
    [1, 2, 0.045],
    [2, 2, 0.011],
  ];
  const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
  const ratio = sum(b) / Math.max(1, sum(a));
  // The normal distribution's two tails beyond |z| (Abramowitz and Stegun 7.1.26).
  const tails = (z: number) => {
    const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
    const poly =
      t *
      (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return poly * Math.exp(-(z * z) / 2);
  };
  const cost = (la: number, lb: number, prior: number) => {
    const mean = (la + lb / ratio) / 2;
    const z = mean > 0 ? (ratio * la - lb) / Math.sqrt(mean * 6.8) : 0;
    return -Math.log(Math.max(tails(z), 1e-12)) - Math.log(prior);
  };
  const n = a.length;
  const m = b.length;
  const best = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const step = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(-1));
  (best[0] as number[])[0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const here = best[i]?.[j] ?? Infinity;
      if (here === Infinity) continue;
      for (const [k, [da, db, prior]] of kinds.entries()) {
        if (i + da > n || j + db > m) continue;
        const c = here + cost(sum(a.slice(i, i + da)), sum(b.slice(j, j + db)), prior);
        if (c < (best[i + da]?.[j + db] ?? Infinity)) {
          (best[i + da] as number[])[j + db] = c;
          (step[i + da] as number[])[j + db] = k;
        }
      }
    }
  const one = new Array<boolean>(n).fill(false);
  for (let i = n, j = m; i > 0 || j > 0;) {
    const [da, db] = kinds[step[i]?.[j] ?? 0] ?? [1, 1];
    i -= da;
    j -= db;
    if (da === 1 && db === 1 && i === j) one[i] = true;
  }
  return one.map(
    (ok, i) => ok && (i === 0 || one[i - 1] === true) && (i === n - 1 || one[i + 1] === true),
  );
}

/** Pearson's correlation of two equally long lists of lengths (0 when either is flat). */
function correlation(a: readonly number[], b: readonly number[]): number {
  const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(a);
  const mb = mean(b);
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (const [i, x] of a.entries()) {
    const y = b[i] ?? 0;
    ab += (x - ma) * (y - mb);
    aa += (x - ma) ** 2;
    bb += (y - mb) ** 2;
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/**
 * An edition in the Septuagint's numbering (Biblia 1914, `lxx`) keyed by the English verse it
 * holds, for the verses that can be placed with certainty; the rest are left out, as for the
 * other editions. Each English chapter is first given its place in the edition:
 *
 * - as it is, when the edition's chapter has the KJV's number of verses;
 * - else through the Synodal grid (toSynodal: Num 12–13 and 29–30, 1 Sam 23–24, Eccl 4–5,
 *   Dan 3–4, Hos 13–14, Jonah 1–2 …), when every chapter it falls in has the Synodal text's
 *   number of verses (`synodal`, the Russian edition). Verses the Synodal text joins into one
 *   (Song 1:1–2, Isa 3:23–24) are left out, both of them;
 * - a psalm by its Septuagint number (septuagintPsalm), when the Septuagint psalm has as many
 *   verses as the English verses that fall in it (the edition does not count a psalm's title
 *   as a verse).
 *
 * The same number of verses does not make the same verses: the edition cuts many verses where
 * the Septuagint does (its Ps 22 has 8 verses to the KJV's 6 in Ps 23; Isa 3:3 is half of the
 * KJV's 3:3–4 and the chapter catches up at 3:24). So each chapter of the edition is then laid
 * against the English verses that fall in it, by their lengths (alignedByLength), and a verse
 * is placed only where the two pair one to one, as do the verses either side of it. A chapter
 * of 8 verses or more whose lengths do not go together at all (correlation under 0.4: another
 * text, as where the Septuagint orders Exodus 36–39 otherwise) is left out whole, and so is one
 * of 5 or more whose lengths go together better one verse off (its verses all a verse late).
 */
export function septuagintView(
  lxx: ReadonlyMap<string, string>,
  kjv: ReadonlyMap<string, string>,
  synodal: ReadonlyMap<string, string>,
): Map<string, string> {
  const own = chapterSizes(lxx);
  const english = chapterSizes(kjv);
  const ru = chapterSizes(synodal);
  // Each chapter of the edition with the English verses placed in it, in its own order.
  const into = new Map<string, (readonly [string, string])[]>();
  const add = (pairs: readonly (readonly [string, string])[]) => {
    for (const pair of pairs) {
      const ch = pair[1].split(".").slice(0, 2).join(".");
      into.set(ch, [...(into.get(ch) ?? []), pair]);
    }
  };
  const psalms = new Map<string, [string, string][]>();
  for (const ref of kjv.keys()) {
    const [book = "", c = "", v = ""] = ref.split(".");
    if (book !== "Ps") continue;
    const [pc, pv] = septuagintPsalm(Number(c), Number(v));
    const ch = `Ps.${String(pc)}`;
    psalms.set(ch, [...(psalms.get(ch) ?? []), [ref, `${ch}.${String(pv)}`]]);
  }
  for (const [ch, pairs] of psalms) if (own.get(ch) === pairs.length) add(pairs);

  const same = (sizes: Map<string, number>, other: Map<string, number>, ch: string) =>
    (sizes.get(ch) ?? 0) > 0 && sizes.get(ch) === other.get(ch);
  for (const [ch, n] of english) {
    const [book = "", c = ""] = ch.split(".");
    if (book === "Ps") continue;
    const verses = Array.from({ length: n }, (_, i) => `${ch}.${String(i + 1)}`);
    if (same(own, english, ch)) {
      add(verses.map((ref) => [ref, ref] as const));
      continue;
    }
    if (SYNODAL_UNCERTAIN.has(ch)) continue;
    const pairs = verses.map((ref, i) => {
      const s = toSynodal(book, Number(c), i + 1);
      return [ref, `${book}.${String(s.chapter)}.${String(s.verse)}`] as const;
    });
    // Only where the Synodal grid moves a verse: else it says nothing the KJV's did not.
    const moves = pairs.some(([from, to]) => from !== to);
    const fits = pairs.every(([, to]) => same(own, ru, to.split(".").slice(0, 2).join(".")));
    if (!moves || !fits) continue;
    const targets = pairs.map(([, to]) => to);
    add(pairs.filter(([, to]) => targets.indexOf(to) === targets.lastIndexOf(to)));
  }

  const view = new Map<string, string>();
  for (const pairs of into.values()) {
    pairs.sort((x, y) => Number(x[1].split(".")[2]) - Number(y[1].split(".")[2]));
    // A chapter the Synodal grid fills from two English ones, or one missing a joined verse:
    // laid out in the edition's order, a verse left unfilled taken out on both sides.
    const a = pairs.map(([from]) => kjv.get(from)?.length ?? 0);
    const b = pairs.map(([, to]) => lxx.get(to)?.length ?? 0);
    if (b.includes(0) || a.includes(0)) continue;
    const r = correlation(a, b);
    if (pairs.length >= 8 && r < 0.4) continue;
    // The edition's verses one off from the English throughout (a boundary moved at both ends).
    const off = (x: number[], y: number[]) => correlation(x.slice(1), y.slice(0, -1));
    if (pairs.length >= 5 && (off(a, b) > r || off(b, a) > r)) continue;
    const ok = alignedByLength(a, b);
    for (const [i, [from, to]] of pairs.entries()) if (ok[i]) view.set(from, lxx.get(to) ?? "");
  }
  return view;
}

/** One edition the verse cards quote: where it comes from and what it is. */
export interface BibleSource {
  readonly name: string;
  readonly url: string;
  /**
   * Its file in pipeline/.cache: eBible.org's `*_usfm.zip`, a SWORD module's zip, the bundle
   * of an edition's Wikisource pages (`.json`, from `pages`) or a plain text (`.txt`).
   */
  readonly file: string;
  readonly license: string;
  /** The edition as its own title names it, for the sources page (docs/sources.html). */
  readonly title: string;
  /** The edition's page at eBible.org or CrossWire, the electronic text credited. */
  readonly page: string;
  /** The text's SHA-256, where the file is pinned here: a download that hashes otherwise is refused. */
  readonly sha256?: string;
  /** For an edition put together from Wikisource pages: the file (in scripts/) pinning each page. */
  readonly pages?: string;
  /** The sources page's link text, where it is neither eBible.org's nor CrossWire's. */
  readonly label?: string;
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
  // Wave 4 (2026-10-25), known to the code before the site publishes them. The Hungarian
  // module files its verses in the Calvin grid (CALVIN), the Finnish one in the NRSVA's.
  hu: {
    name: "Károli Bible, revised 1908 (CrossWire HunKar)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/HunKar.zip",
    file: "HunKar.zip",
    license: "public domain",
    title: "Revideált Károli Biblia (1908)",
    page: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=HunKar",
  },
  fi: {
    name: "Finnish Bible 1933/1938 (CrossWire FinPR)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/FinPR.zip",
    file: "FinPR.zip",
    license: "public domain",
    title: "Pyhä Raamattu (1933/1938)",
    page: "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FinPR",
  },
  vi: {
    name: "Vietnamese Bible, William Cadman's translation, 1925 (eBible.org vie1934)",
    url: "https://ebible.org/Scriptures/vie1934_usfm.zip",
    file: "vie1934_usfm.zip",
    license: "public domain",
    title: "Kinh Thánh, bản dịch Cadman (1925)",
    page: "https://ebible.org/vie1934/",
  },
  // Wave 5 (2026-10-25), known to the code before the site publishes them; neither edition is
  // on eBible.org or CrossWire. The Romanian Bible is the Orthodox Synod's of 1914 as Romanian
  // Wikisource transcribes it, each page pinned at its revision (scripts/biblia-1914.json), in
  // the Septuagint's numbering (septuagintView places it in the KJV's), its 1914 spelling kept.
  // The Bulgarian one is the Tsarigrad translation (1871), the 1914 printing typed in modern
  // spelling, from the Internet Archive, pinned by its SHA-256.
  ro: {
    name: "Biblia 1914, Holy Synod edition (Romanian Wikisource)",
    url: "https://ro.wikisource.org/wiki/Biblia_1914",
    file: "ro-biblia1914_wikisource.json",
    license: "public domain",
    title:
      "Biblia adică Dumnezeeasca Scriptură a Legii Vechi și a celei Nouă, Ediția Sfântului Sinod (1914)",
    page: "https://ro.wikisource.org/wiki/Biblia_1914",
    pages: "biblia-1914.json",
    label: "Wikisource Biblia 1914",
  },
  bg: {
    name: "Tsarigrad Bible, 1871 translation, 1914 printing in modern spelling (Internet Archive)",
    url: "https://archive.org/download/bibliya-tsarigradska-viensko-izdanie-1885/%D0%A6%D0%B0%D1%80%D0%B8%D0%B3%D1%80%D0%B0%D0%B4%D1%81%D0%BA%D0%B0%20%D0%91%D0%B8%D0%B1%D0%BB%D0%B8%D1%8F%2C%201914%20%D0%B3.%20%28%D1%81%D1%8A%D0%B2%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%B5%D0%BD%20%D0%BF%D1%80%D0%B0%D0%B2%D0%BE%D0%BF%D0%B8%D1%81%29.txt",
    file: "bg-tsarigrad1914.txt",
    license: "public domain",
    title: "Цариградска Библия (1871), издание 1914 г.",
    page: "https://archive.org/details/bibliya-tsarigradska-viensko-izdanie-1885",
    sha256: "ac822b41bf206abd16eab534f5f04d7922ba4e4396c45e6160705a322e3378d8",
    label: "Internet Archive bibliya-tsarigradska",
  },
};

/** Whether an edition is an eBible.org USFM zip (else a SWORD module, read by readSword). */
export const isUsfm = (src: BibleSource): boolean => src.file.endsWith("_usfm.zip");

/** Whether an edition is in the Septuagint's grid (Biblia 1914), placed by septuagintView. */
export const isSeptuagint = (src: BibleSource): boolean => src.file.endsWith("_wikisource.json");

/**
 * An edition's verses keyed by the English (KJV) reference where its grid is not the KJV's
 * own (Biblia 1914, through septuagintView), else in its own numbering, as readBible and
 * readSword give it. `cache` holds the files (pipeline/.cache); the KJV and the Synodal text
 * are read from there too when an edition needs them.
 */
export function readEdition(src: BibleSource, cache: string): Map<string, string> {
  const path = join(cache, src.file);
  const kjv = () => readBible(join(cache, SOURCES.en.file));
  if (isUsfm(src)) return readBible(path);
  if (src.file.endsWith(".zip")) return readSword(path, kjv());
  if (src.file.endsWith(".txt")) return readTsarigrad(path);
  if (!isSeptuagint(src)) throw new Error(`${src.file}: not a format readEdition knows`);
  return septuagintView(readBiblia1914(path), kjv(), readBible(join(cache, SOURCES.ru.file)));
}

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
 *
 * Wave 4: the Finnish and Vietnamese texts sit in the KJV's slots but print their own
 * numbering where it differs («{13:1}», «(030-1)», «20-43»); the Vietnamese one keeps a
 * capital vowel's tone mark in the old VNI code («Aáy», «Eùp-ra-im») and has «ỳ» as «”»
 * («phép k”»); the Finnish one brackets the doxology of Matthew 6:13 in escaped tags
 * («&lt;FO&gt;»).
 *
 * Wave 5: Biblia 1914 keeps its spelling of 1914 («au făcut Dumnezeu», «erà», «pre», «s’a»);
 * only what Wikisource's transcription garbled is mended: a cross-reference typed into a verse
 * (Exod 21:29 «Fac. 9, 5.»), a «»» for the full stop (Num 31:38) and «Saducheiior» (Matt
 * 16:6). The Tsarigrad text sets in brackets the words its translators supplied («[ Проводи
 * ]») and the passage of 1 John 5:7–8 they doubted: the cards show the words without them, as
 * the KJV's supplied words are shown. It has a few Latin letters in Cyrillic words («излeяна»,
 * «Tарсис», «излsзоха» for излязоха), a stray «[D1]» (Jer 10:9), the Slavonic verse numbers
 * in Ps 116 and 147 («[ (По Слав.147) ] (1) Слави», «(4) Изпроважда»), a chapter heading
 * run into Ezra 5:17 («… за това. Глава 6») and compounds broken over a line («по- напред»).
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
  fi: [
    [/\{\d+:\d+\}\s*/g, ""],
    [/\s\d+:$/, ""],
    [/&lt;F[Oo]&gt;/g, ""],
  ],
  vi: [
    [/\(\d{2,3}[-:]\d+\)\s*/g, ""],
    [/\s\d+-\d+\s(?=\p{Lu})/gu, " "],
    // A capital vowel's tone left in the old VNI code: «Aáy» Ấy, «Aùp-ra-ham» Áp-ra-ham.
    [/(?<!\p{L})Aá/gu, "Ấ"],
    [/(?<!\p{L})Eá/gu, "Ế"],
    [/(?<!\p{L})Oá/gu, "Ố"],
    [/(?<!\p{L})Aù/gu, "Á"],
    [/(?<!\p{L})Eù/gu, "É"],
    [/(?<!\p{L})Où/gu, "Ó"],
    [/(?<!\p{L})Uù/gu, "Ú"],
    // A capital's hat, breve or dot left in VNI: «Eân» Ên, «Oâi» Ôi, «Aâm» Âm, «Aên» Ăn,
    // «Aït-nôn» Ạt-nôn, «Oït-nan» Ọt-nan, «Uûa» Ủa.
    [/(?<!\p{L})Eâ/gu, "Ê"],
    [/(?<!\p{L})Oâ/gu, "Ô"],
    [/(?<!\p{L})Aâ/gu, "Â"],
    [/(?<!\p{L})Aê/gu, "Ă"],
    [/(?<!\p{L})Aï/gu, "Ạ"],
    [/(?<!\p{L})Oï/gu, "Ọ"],
    [/(?<!\p{L})Uû/gu, "Ủ"],
    // «ỳ» read as a quotation mark: «phép k”» is phép kỳ, «hu”nh» huỳnh.
    [/(?<!\p{L})([kK])”/gu, "$1ỳ"],
    [/([Hh]u)”nh/g, "$1ỳnh"],
    // «Ở» lost to a lone «ỳ» (87 verses): «ỳ đó» is Ở đó, «ỳ Bê-xéc» Ở Bê-xéc (Judg 1:5).
    [/(?<!\p{L})ỳ(?=\s)/gu, "Ở"],
    // The vocative «Ớ» lost to a lone «ù» (30 verses): «ù lão trọc» Ớ lão trọc (2 Kgs 2:23).
    [/(?<!\p{L})ù(?=\s)/gu, "Ớ"],
    // Capitals of two inscriptions: THỜ CHÚA KHÔNG BIẾT (Acts 17:23), NGƯỜI (John 19:19).
    [/THù CHúA KHÔNG BIôT/g, "THỜ CHÚA KHÔNG BIẾT"],
    [/NGƯùI/g, "NGƯỜI"],
    [/NA-XA-RẵT, Là VUA DĂN/g, "NA-XA-RÉT, LÀ VUA DÂN"],
    // The lone «ỳ» above was «ở» mid-sentence once (Mark 15:43).
    [/Giô-sép, Ở thành/g, "Giô-sép, ở thành"],
    // Four single misprints: trụng (Josh 19:27), trì vì (Gen 36:32), Tháo-bu-ách (Josh 17:8), hát tốt (Amos 6:2).
    [/ trụng /g, " trũng "],
    [/ trì vì /g, " trị vì "],
    [/Tháo-bu-ách/g, "Tháp-bu-ách"],
    [/ hát tốt /g, " há tốt "],
    // «Ích» lost its capital to «ỗ» (Ích-ma-ên, Gen 16–37), and three more misprints.
    [/ỗch/g, "Ích"],
    [/Biển-dỏ/g, "Biển-đỏ"],
    [/Ạt-nnôn/g, "Ạt-nôn"],
    // A name broken at a line end kept the space: «Na-xa- rét», «Ga- li-lê».
    [/(\p{L})- (?=\p{Ll})/gu, "$1-"],
  ],
  ro: [
    [/ Fac\. 9, 5\.$/, ""],
    [/doi»$/, "doi."],
    [/Saducheiior/g, "Saducheilor"],
  ],
  bg: [
    [/\[D1\]/g, ""],
    // The Slavonic number where a psalm is split (Ps 116:10, 147:12), a heading run into a verse.
    [/^\[ ?\(По Слав[^\]]*\]\s*/, ""],
    [/ Глава \d+$/, ""],
    [/\[ ?| ?\]/g, ""],
    [/^\(\d+\)\s*/, ""],
    [/излsзоха/g, "излязоха"],
    [/e/g, "е"],
    [/a/g, "а"],
    [/T/g, "Т"],
    [/(\p{L})- (?=\p{Ll})/gu, "$1-"],
    // Single misprints: Jn 2:16, Am 7:13, Acts 23:11, 1 Sam 28:4, Zech 14:4, 2 Kgs 10:33, Ezek 16:3.
    [/Дне правете/g, "Не правете"],
    [/проорочествуваш/g, "пророчествуваш"],
    [/требва са свидетелствуваш/g, "требва да свидетелствуваш"],
    [/Телвуе/g, "Гелвуе"],
    [/Ппрез/g, "През"],
    [/потока Арион/g, "потока Арнон"],
    [/Аморееец/g, "Амореец"],
    [/Флистимците/g, "Филистимците"],
  ],
};

/** A verse's text with its edition's garbles mended (REPAIRS). */
export const repair = (locale: string, text: string): string =>
  (REPAIRS[locale as Locale] ?? []).reduce((t, [re, to]) => t.replace(re, to), text);
