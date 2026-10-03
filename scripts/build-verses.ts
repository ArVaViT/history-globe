/**
 * Writes apps/web/public/data/verses/<locale>/<Book>.json: the text of every verse the
 * places cite, keyed by its English (OSIS) reference, so the place card can show a
 * verse without sending the reader away. Russian is the Synodal text, English the KJV,
 * both public domain, from eBible.org's USFM editions (downloaded once into
 * pipeline/.cache, their sha256 written to verses/sources.json).
 *
 * Russian verses come through toSynodal (Ps 68:15 → 67:16). Chapters whose Synodal
 * verses are merged or added in ways the mapping does not convert are left out in
 * Russian, so the card never shows a neighbouring verse: the link remains.
 *
 * Usage: node scripts/build-verses.ts  (after the data build: it reads places.geojson)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toSynodal } from "../packages/model/src/synodal.ts";
import { readBible } from "./bible-text.ts";

const root = join(import.meta.dirname, "..");
const cache = join(root, "pipeline/.cache");
const out = join(root, "apps/web/public/data/verses");

const SOURCES = {
  ru: {
    name: "Russian Synodal Bible (eBible.org russyn)",
    url: "https://ebible.org/Scriptures/russyn_usfm.zip",
    file: "russyn_usfm.zip",
    license: "public domain",
  },
  en: {
    name: "King James Version (eBible.org eng-kjv2006)",
    url: "https://ebible.org/Scriptures/eng-kjv2006_usfm.zip",
    file: "eng-kjv2006_usfm.zip",
    license: "public domain (Crown copyright in the UK)",
  },
} as const;

/** Chapters (English numbering) whose Synodal verses toSynodal keeps as they are, though
 * the Synodal text merges or adds verses in them (see synodal.ts). */
const RU_UNCERTAIN = new Set([
  "Lev.14",
  "Josh.24",
  "Prov.4",
  "Prov.13",
  "Rom.14",
  "Rom.15",
  "Rom.16",
  "Rev.12",
]);

function fetchSource(src: (typeof SOURCES)[keyof typeof SOURCES]): string {
  const path = join(cache, src.file);
  if (!existsSync(path)) {
    mkdirSync(cache, { recursive: true });
    // Into a part file, tested, then moved: a broken download never stays in the cache.
    const part = `${path}.part`;
    execFileSync("curl", ["-sSfL", "-o", part, src.url]);
    execFileSync("unzip", ["-tq", part]);
    renameSync(part, path);
  }
  return path;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const places = JSON.parse(
  readFileSync(join(root, "apps/web/public/data/places.geojson"), "utf8"),
) as { features: { properties: { osis: string[] } }[] };
const cited = [...new Set(places.features.flatMap((f) => f.properties.osis))].sort();

// Built beside the old texts and swapped in at the end: a failed build leaves them be.
const next = `${out}.next`;
rmSync(next, { recursive: true, force: true });
const counts: Record<string, { verses: number; missing: number; uncertain: number }> = {};
for (const [locale, src] of Object.entries(SOURCES)) {
  const bible = readBible(fetchSource(src));
  const byBook = new Map<string, Record<string, string>>();
  let missing = 0;
  let uncertain = 0;
  for (const ref of cited) {
    const [book = "", ch = "", v = ""] = ref.split(".");
    let text: string | undefined;
    if (locale === "ru") {
      if (RU_UNCERTAIN.has(`${book}.${ch}`)) {
        uncertain++;
        continue;
      }
      const s = toSynodal(book, Number(ch), Number(v));
      text = bible.get(`${book}.${String(s.chapter)}.${String(s.verse)}`);
    } else text = bible.get(ref);
    if (!text) {
      missing++;
      continue;
    }
    if (text.includes("\\")) throw new Error(`USFM markup left in ${locale} ${ref}: ${text}`);
    const verses = byBook.get(book) ?? {};
    // The digital Synodal text sets its dashes as hyphens: « - » → « — ».
    verses[ref] = locale === "ru" ? text.replaceAll(" - ", " — ") : text;
    byBook.set(book, verses);
  }
  mkdirSync(join(next, locale), { recursive: true });
  for (const [book, verses] of byBook) {
    writeFileSync(join(next, locale, `${book}.json`), JSON.stringify(verses));
  }
  counts[locale] = { verses: cited.length - missing - uncertain, missing, uncertain };
}
writeFileSync(
  join(next, "sources.json"),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(SOURCES).map(([locale, s]) => [
        locale,
        { ...s, sha256: sha256(join(cache, s.file)) },
      ]),
    ),
    null,
    2,
  ),
);
rmSync(out, { recursive: true, force: true });
renameSync(next, out);
console.log(
  `verses: ${String(cited.length)} cited;`,
  Object.entries(counts)
    .map(
      ([l, c]) =>
        `${l} ${String(c.verses)} (missing ${String(c.missing)}, left out ${String(c.uncertain)})`,
    )
    .join(", "),
);
