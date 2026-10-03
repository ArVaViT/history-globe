/**
 * The whole Bible from one of eBible.org's USFM zips (pipeline/.cache): verse texts keyed
 * "Gen.12.6", in the edition's own numbering. Used by build-verses.ts for the verses the
 * places cite and by build-text-places.ts to tell names from ordinary words.
 */
import { execFileSync } from "node:child_process";

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
