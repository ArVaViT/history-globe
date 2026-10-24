/**
 * Writes apps/web/public/data/verses/<locale>/<Book>.json: the text of every verse the
 * places cite, keyed by its English (OSIS) reference, so the place card can show a
 * verse without sending the reader away. Russian is the Synodal text, English the KJV,
 * both public domain, from eBible.org's USFM editions or CrossWire's SWORD modules (SOURCES
 * and REPAIRS in bible-text.ts; downloaded once into pipeline/.cache, their sha256 written to
 * verses/sources.json).
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
import { type BibleSource, isUsfm, readBible, readSword, repair, SOURCES } from "./bible-text.ts";

const root = join(import.meta.dirname, "..");
const cache = join(root, "pipeline/.cache");
const out = join(root, "apps/web/public/data/verses");

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

function fetchSource(src: BibleSource): string {
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
  const bible = isUsfm(src) ? readBible(fetchSource(src)) : readSword(fetchSource(src), kjv);
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
        (!isUsfm(src) && swordShifted(bible, book, Number(ch))))
    ) {
      // Numbered otherwise than the KJV (a psalm's title counted as verse 1, Malachi 3-4):
      // left out rather than show a neighbouring verse; the link remains.
      uncertain++;
      continue;
    } else text = bible.get(ref);
    // Mended first: a verse the Swedish module fills with a footnote mark alone is missing.
    text = repair(locale, text ?? "");
    if (!text) {
      missing++;
      continue;
    }
    if (text.includes("\\")) throw new Error(`USFM markup left in ${locale} ${ref}: ${text}`);
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
