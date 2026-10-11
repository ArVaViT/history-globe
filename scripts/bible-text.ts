/**
 * The whole Bible from one of eBible.org's USFM zips (pipeline/.cache): verse texts keyed
 * "Gen.12.6", in the edition's own numbering. Used by build-verses.ts for the verses the
 * places cite and by build-text-places.ts to tell names from ordinary words.
 */
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";

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

/**
 * The whole Bible from a CrossWire SWORD zText module zip (pipeline/.cache), for an edition
 * eBible.org does not carry. The module's verse index follows the KJV versification, so the
 * chapter sizes come from the KJV (`kjv`, as readBible returns it): each testament opens with
 * two header entries, each book with one, each chapter with one, then its verses.
 */
export function readSword(zip: string, kjv: Map<string, string>): Map<string, string> {
  const sizes = new Map<string, number>();
  for (const ref of kjv.keys()) {
    const ch = ref.split(".").slice(0, 2).join(".");
    sizes.set(ch, (sizes.get(ch) ?? 0) + 1);
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
    if (index * 10 !== bzv.length)
      throw new Error(`${zip}: ${testament} index does not fit the KJV`);
  }
  return verses;
}
