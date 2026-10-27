import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_FONTS } from "./fonts";

const root = join(import.meta.dirname, "../../..");
const fontsource = join(root, "apps/web/node_modules/@fontsource-variable");

/** A string's characters (code points). */
const chars = (s: string) => s.match(/./gsu) ?? [];

/** Every letter Vietnamese writes, both cases, precomposed (NFC), with the đồng sign. */
const VIETNAMESE_LETTERS = [
  ...chars("aăâbcdđeêghiklmnoôơpqrstuưvxy"),
  ...chars("áàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ"),
  "₫",
].flatMap((c) => [c, c.toUpperCase()]);
const SAMPLE = "Giê-ru-sa-lem, Bết-lê-hem, Ca-bê-na-um, thế kỷ 6 TCN — Kinh Thánh";

type Range = [number, number];
const parseRanges = (css: string): Range[] =>
  css.split(",").map((r) => {
    const [a, b] = r.trim().replace(/^U\+/i, "").split("-");
    const start = parseInt(a ?? "", 16);
    return [start, b === undefined ? start : parseInt(b, 16)];
  });
const inRanges = (ranges: Range[], c: string) => {
  const cp = c.codePointAt(0) ?? -1;
  return ranges.some(([a, b]) => cp >= a && cp <= b);
};

describe("map label fonts", () => {
  it("has the upright and the italic map font", () => {
    expect(Object.keys(MAP_FONTS)).toEqual(["Map Serif", "Map Serif Italic"]);
  });
  for (const [family, files] of Object.entries(MAP_FONTS)) {
    it(`${family} draws every Vietnamese letter from a Literata file`, () => {
      const ranges = files.map((f) => parseRanges(f.unicodeRange));
      const missing = VIETNAMESE_LETTERS.filter((c) => !ranges.some((r) => inRanges(r, c)));
      expect(missing).toEqual([]);
      expect(files.at(-1)?.url).toMatch(/literata-vietnamese-wght-/);
    });
  }
});

/** The `@font-face` rules of a stylesheet: family, file and unicode-range. */
function faces(css: string) {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body = ""]) => ({
    family: /font-family:\s*["']?([^"';]+)/.exec(body)?.[1] ?? "",
    url: /url\(["']?([^"')]+)/.exec(body)?.[1] ?? "",
    ranges: parseRanges(/unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? "U+0-10FFFF"),
  }));
}

const STYLESHEETS = [
  { file: "apps/web/src/styles.css", sans: "Golos Text Variable", vi: "Onest Variable", serif: "" },
  { file: "apps/web/public/pages.css", sans: "Golos Text", vi: "Onest", serif: "Literata" },
  { file: "content/docs/docs.css", sans: "Golos Text", vi: "Onest", serif: "" },
];

describe.each(STYLESHEETS)("Vietnamese in $file", ({ file, sans, vi, serif }) => {
  const css = readFileSync(join(root, file), "utf8");
  const all = faces(css);
  const of = (family: string) => all.filter((f) => f.family === family);

  it("sets a page in Vietnamese in Onest, which has every letter", () => {
    const sample = [...new Set([...VIETNAMESE_LETTERS, ...chars(SAMPLE)])];
    expect(sample.filter((c) => !of(vi).some((f) => inRanges(f.ranges, c)))).toEqual([]);
    const variable = file.endsWith("styles.css") ? "--font-sans" : "--sans";
    expect(css).toMatch(
      new RegExp(`:root:lang\\(vi\\)\\s*{\\s*${variable}:\\s*"${vi}", "${sans}"`),
    );
  });

  it("gives Golos Text only the Vietnamese letters it has no glyph for", () => {
    const island = of(sans).filter((f) => /onest-vietnamese/.test(f.url));
    expect(island).toHaveLength(1);
    // Golos Text's own Ă, Đ, Ỳ and plain Latin stay its own.
    for (const c of ["a", "A", "ă", "Ă", "đ", "Đ", "ỳ", "Ỳ", "é", "́"])
      expect(inRanges(island[0]?.ranges ?? [], c), c).toBe(false);
    for (const c of ["ế", "ộ", "ữ", "ặ", "Ơ", "ư", "ỹ"])
      expect(inRanges(island[0]?.ranges ?? [], c), c).toBe(true);
  });

  if (serif)
    it("has Literata's own Vietnamese file", () => {
      expect(of(serif).some((f) => /literata-vietnamese-wght-normal/.test(f.url))).toBe(true);
    });

  it("points at font files that exist", () => {
    for (const { url } of all) {
      const name = url.split("/").at(-1) ?? "";
      const pkg = name.startsWith("golos-text") ? "golos-text" : (name.split("-")[0] ?? "");
      expect(existsSync(join(fontsource, pkg, "files", name)), url).toBe(true);
    }
  });
});

it("the static pages copy the Vietnamese files they name", () => {
  const docs = readFileSync(join(root, "scripts/build-docs.ts"), "utf8");
  for (const name of [
    "literata-vietnamese-wght-normal.woff2",
    "onest-latin-wght-normal.woff2",
    "onest-latin-ext-wght-normal.woff2",
    "onest-vietnamese-wght-normal.woff2",
  ])
    expect(docs).toContain(`"${name}"]`);
});
