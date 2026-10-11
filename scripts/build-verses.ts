/**
 * Writes apps/web/public/data/verses/<locale>/<Book>.json: the text of every verse the
 * places cite, keyed by its English (OSIS) reference, so the place card can show a
 * verse without sending the reader away. Russian is the Synodal text, English the KJV,
 * both public domain, from eBible.org's USFM editions (Polish from CrossWire's SWORD module) (downloaded once into
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
import { readBible, readSword } from "./bible-text.ts";

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
  // The other languages: classic public-domain editions, eBible.org.
  uk: {
    name: "Ukrainian Bible, P. Kulish (eBible.org ukr1871)",
    url: "https://ebible.org/Scriptures/ukr1871_usfm.zip",
    file: "ukr1871_usfm.zip",
    license: "public domain",
  },
  es: {
    name: "Reina-Valera 1909 (eBible.org spaRV1909)",
    url: "https://ebible.org/Scriptures/spaRV1909_usfm.zip",
    file: "spaRV1909_usfm.zip",
    license: "public domain",
  },
  pt: {
    name: "World Portuguese Bible (eBible.org porbrbsl)",
    url: "https://ebible.org/Scriptures/porbrbsl_usfm.zip",
    file: "porbrbsl_usfm.zip",
    license: "public domain",
  },
  fr: {
    name: "Louis Segond 1910 (eBible.org fraLSG)",
    url: "https://ebible.org/Scriptures/fraLSG_usfm.zip",
    file: "fraLSG_usfm.zip",
    license: "public domain",
  },
  de: {
    name: "Luther Bible 1912 (eBible.org deu1912)",
    url: "https://ebible.org/Scriptures/deu1912_usfm.zip",
    file: "deu1912_usfm.zip",
    license: "public domain",
  },
  it: {
    name: "Riveduta 1927 (eBible.org ita1927)",
    url: "https://ebible.org/Scriptures/ita1927_usfm.zip",
    file: "ita1927_usfm.zip",
    license: "public domain",
  },
  nl: {
    name: "Statenvertaling, 1917 edition (eBible.org nld)",
    url: "https://ebible.org/Scriptures/nld_usfm.zip",
    file: "nld_usfm.zip",
    license: "public domain",
  },
  // Not on eBible.org: CrossWire's SWORD module of the Gdańsk Bible.
  pl: {
    name: "Biblia Gdańska 1881 (CrossWire PolGdanska)",
    url: "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/PolGdanska.zip",
    file: "PolGdanska.zip",
    license: "public domain",
  },
  cs: {
    name: "Bible kralická 1613 (eBible.org ces1613)",
    url: "https://ebible.org/Scriptures/ces1613_usfm.zip",
    file: "ces1613_usfm.zip",
    license: "public domain",
  },
  zh: {
    name: "Chinese Union Version, simplified (eBible.org cmn-cu89s)",
    url: "https://ebible.org/Scriptures/cmn-cu89s_usfm.zip",
    file: "cmn-cu89s_usfm.zip",
    license: "public domain",
  },
} as const;

/**
 * Characters the digital editions garbled, mended before a verse is shown: the Kralice
 * text has its capital Č and Ď in the wrong code page (È, Ï), and the Gdańsk module a
 * handful of misread letters.
 */
const REPAIRS: Readonly<
  Partial<Record<keyof typeof SOURCES, readonly (readonly [RegExp, string])[]>>
> = {
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
};
const repair = (locale: string, text: string): string =>
  (REPAIRS[locale as keyof typeof SOURCES] ?? []).reduce((t, [re, to]) => t.replace(re, to), text);

/** Verses per chapter ("Ps.51" → 19) of an edition, to compare its numbering with the KJV. */
function chapterSizes(bible: Map<string, string>): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const ref of bible.keys()) {
    const ch = ref.split(".").slice(0, 2).join(".");
    sizes.set(ch, (sizes.get(ch) ?? 0) + 1);
  }
  return sizes;
}

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

/**
 * A SWORD module files its verses into the KJV's slots whatever its own numbering, so a
 * chapter numbered otherwise looks complete. The Gdańsk Bible numbers as the KJV except
 * that a psalm's title is its verse 1 and a few chapters start or end a verse off; such
 * a chapter leaves a slot empty (Num 12:16, its verse being 13:1), shifting the rest of it
 * and the chapter after. All psalms, those chapters and Rev 12 (whose 12:18 the KJV has as
 * 13:1) are left out rather than show a neighbouring verse.
 */
function swordShifted(bible: Map<string, string>, book: string, ch: number): boolean {
  if (book === "Ps" || `${book}.${String(ch)}` === "Rev.12") return true;
  const gap = (c: number) => {
    const n = kjvSizes.get(`${book}.${String(c)}`) ?? 0;
    for (let v = 1; v <= n; v++) if (!bible.has(`${book}.${String(c)}.${String(v)}`)) return true;
    return false;
  };
  return gap(ch) || (ch > 1 && gap(ch - 1));
}

// Built beside the old texts and swapped in at the end: a failed build leaves them be.
const next = `${out}.next`;
rmSync(next, { recursive: true, force: true });
const counts: Record<string, { verses: number; missing: number; uncertain: number }> = {};
const kjv = readBible(fetchSource(SOURCES.en));
const kjvSizes = chapterSizes(kjv);
for (const [locale, src] of Object.entries(SOURCES)) {
  const bible = src.file.endsWith("_usfm.zip")
    ? readBible(fetchSource(src))
    : readSword(fetchSource(src), kjv);
  const sizes = chapterSizes(bible);
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
    } else if (
      locale !== "en" &&
      (sizes.get(`${book}.${ch}`) !== kjvSizes.get(`${book}.${ch}`) ||
        (src.file.endsWith(".zip") &&
          !src.file.endsWith("_usfm.zip") &&
          swordShifted(bible, book, Number(ch))))
    ) {
      // Numbered otherwise than the KJV (a psalm's title counted as verse 1, Malachi 3-4):
      // left out rather than show a neighbouring verse; the link remains.
      uncertain++;
      continue;
    } else text = bible.get(ref);
    if (!text) {
      missing++;
      continue;
    }
    if (text.includes("\\")) throw new Error(`USFM markup left in ${locale} ${ref}: ${text}`);
    text = repair(locale, text);
    const verses = byBook.get(book) ?? {};
    // The digital Synodal text sets its dashes as hyphens: « - » → « — ».
    verses[ref] =
      locale === "ru"
        ? text.replaceAll(" - ", " — ")
        : locale === "zh"
          ? // The Union Version marks names with a space before them: Chinese has none.
            text.replace(/\s+(?=[\u4e00-\u9fff])/g, "")
          : text;
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
