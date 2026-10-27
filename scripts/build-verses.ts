/**
 * Writes apps/web/public/data/verses/<locale>/<Book>.json: the text of every verse the
 * places cite, keyed by its English (OSIS) reference, so the place card can show a
 * verse without sending the reader away. Russian is the Synodal text, English the KJV,
 * both public domain (the others too, but the Turkish and Swahili editions, each under its
 * open licence), from eBible.org's USFM editions, CrossWire's SWORD modules, Romanian
 * Wikisource (Biblia 1914, each page at a pinned revision and hash) and the Internet Archive
 * (the Tsarigrad Bible, pinned by its hash) (SOURCES and REPAIRS in bible-text.ts; downloaded
 * once into pipeline/.cache, their sha256 written to verses/sources.json).
 *
 * Biblia 1914 is numbered as the Septuagint: readEdition gives it keyed by the English verse,
 * for the chapters septuagintView can place, and the rest is left out.
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
import {
  type BibleSource,
  chapterSizes,
  isSeptuagint,
  isUsfm,
  readEdition,
  repair,
  SOURCES,
  SYNODAL_UNCERTAIN,
} from "./bible-text.ts";

const root = join(import.meta.dirname, "..");
const cache = join(root, "pipeline/.cache");
const out = join(root, "apps/web/public/data/verses");

const UA = "history-globe-pipeline/1.0 (github.com/ArVaViT/history-globe)";

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** A pinned download that does not hash as pinned: removed, and the build stops. */
function refuse(path: string, what: string, got: string, want: string): never {
  rmSync(path, { force: true });
  throw new Error(
    `${what} hashes to ${got.slice(0, 12)}…, expected ${want.slice(0, 12)}…; the file is removed. ` +
      "If the text has changed upstream on purpose, re-pin it (bible-text.ts, scripts/biblia-1914.json).",
  );
}

/**
 * An edition's Wikisource pages, each at its pinned revision and checked against its hash,
 * bundled into one file (`{ "Gen": wikitext, … }`) in the manifest's order.
 */
function fetchPages(src: BibleSource, part: string): void {
  const manifest = JSON.parse(readFileSync(join(root, "scripts", src.pages ?? ""), "utf8")) as {
    pages: Record<string, { title: string; oldid: number; sha256: string }>;
  };
  const host = new URL(src.url).origin;
  const bundle: Record<string, string> = {};
  for (const [book, page] of Object.entries(manifest.pages)) {
    const url = `${host}/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${String(page.oldid)}&action=raw`;
    const raw = execFileSync("curl", ["-sSfL", "-A", UA, url], { maxBuffer: 1 << 26 });
    const got = createHash("sha256").update(raw).digest("hex");
    if (got !== page.sha256)
      refuse(part, `${page.title} (oldid ${String(page.oldid)})`, got, page.sha256);
    bundle[book] = raw.toString("utf8");
  }
  writeFileSync(part, JSON.stringify(bundle));
}

function fetchSource(src: BibleSource): string {
  const path = join(cache, src.file);
  if (!existsSync(path)) {
    mkdirSync(cache, { recursive: true });
    // Into a part file, tested, then moved: a broken download never stays in the cache.
    const part = `${path}.part`;
    if (src.pages) fetchPages(src, part);
    else execFileSync("curl", ["-sSfL", "-A", UA, "-o", part, src.url]);
    if (src.file.endsWith(".zip")) execFileSync("unzip", ["-tq", part]);
    renameSync(part, path);
  }
  // A pinned file is checked whether it came from the network just now or sat in the cache.
  const got = src.sha256 && sha256(path);
  if (src.sha256 && got !== src.sha256) refuse(path, src.file, got || "", src.sha256);
  return path;
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
  return shifted(bible, book, ch);
}

/**
 * A chapter with a verse missing, or after one: the edition moved a boundary there (the
 * Tsarigrad text has 1 Sam 23:29 at the head of 24:1), so neither chapter is quoted.
 */
function shifted(bible: Map<string, string>, book: string, ch: number): boolean {
  const gap = (c: number) => {
    const n = kjvSizes.get(`${book}.${String(c)}`) ?? 0;
    for (let v = 1; v <= n; v++) if (!bible.has(`${book}.${String(c)}.${String(v)}`)) return true;
    return false;
  };
  return gap(ch) || (ch > 1 && gap(ch - 1));
}

/** A CrossWire SWORD module (a zip that is not eBible.org's USFM). */
const isSword = (src: BibleSource) => src.file.endsWith(".zip") && !isUsfm(src);

// Built beside the old texts and swapped in at the end: a failed build leaves them be.
const next = `${out}.next`;
rmSync(next, { recursive: true, force: true });
const counts: Record<string, { verses: number; missing: number; uncertain: number }> = {};
fetchSource(SOURCES.en);
fetchSource(SOURCES.ru);
const kjvSizes = chapterSizes(readEdition(SOURCES.en, cache));
for (const [locale, src] of Object.entries(SOURCES)) {
  fetchSource(src);
  const bible = readEdition(src, cache);
  const sizes = chapterSizes(bible);
  const byBook = new Map<string, Record<string, string>>();
  let missing = 0;
  let uncertain = 0;
  for (const ref of cited) {
    const [book = "", ch = "", v = ""] = ref.split(".");
    let text: string | undefined;
    if (locale === "ru") {
      if (SYNODAL_UNCERTAIN.has(`${book}.${ch}`)) {
        uncertain++;
        continue;
      }
      const s = toSynodal(book, Number(ch), Number(v));
      text = bible.get(`${book}.${String(s.chapter)}.${String(s.verse)}`);
    } else if (isSeptuagint(src) && !bible.has(ref)) {
      // Not placed in the KJV's numbering with certainty (septuagintView): left out.
      uncertain++;
      continue;
    } else if (
      locale !== "en" &&
      !isSeptuagint(src) &&
      (sizes.get(`${book}.${ch}`) !== kjvSizes.get(`${book}.${ch}`) ||
        (isSword(src) && swordShifted(bible, book, Number(ch))) ||
        (!isSword(src) && !isUsfm(src) && shifted(bible, book, Number(ch))))
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
