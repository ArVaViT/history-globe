import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import {
  alignedByLength,
  CALVIN,
  OSIS,
  readBiblia1914,
  readSword,
  readTsarigrad,
  repair,
  septuagintView,
  swordVersification,
} from "./bible-text.ts";

const books = Object.values(OSIS);
/**
 * A small KJV: Genesis 1 (2 verses), 3 John 1 (14) and Revelation, whose chapters are a verse
 * each but 12 (17); a book's chapters run on from its first, as readSword reads them.
 */
const KJV_SIZES: Readonly<Record<string, number>> = {
  "Gen.1": 2,
  "3John.1": 14,
  ...Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`Rev.${String(i + 1)}`, 1])),
  "Rev.12": 17,
};
/** The NRSV's grid for the same: 3 John has 15 verses, Revelation 12 has 18. */
const NRSV_SIZES: Readonly<Record<string, number>> = { ...KJV_SIZES, "3John.1": 15, "Rev.12": 18 };
const kjv = new Map<string, string>();
for (const [ch, n] of Object.entries(KJV_SIZES))
  for (let v = 1; v <= n; v++) kjv.set(`${ch}.${String(v)}`, "x");

/** A testament's index as a zText module lays it out: null for a header entry. */
function slots(list: readonly string[], sizes: Readonly<Record<string, number>>) {
  const out: (string | null)[] = [null, null];
  for (const book of list) {
    out.push(null);
    for (let c = 1; sizes[`${book}.${String(c)}`]; c++) {
      out.push(null);
      for (let v = 1; v <= (sizes[`${book}.${String(c)}`] ?? 0); v++)
        out.push(`${book}.${String(c)}.${String(v)}`);
    }
  }
  return out;
}

const dir = mkdtempSync(join(tmpdir(), "sword-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * A zText module zip with one block per testament: every verse "Text of <ref>" with a note,
 * the Old Testament followed by `apocrypha` more entries where the grid has them.
 */
function writeModule(
  name: string,
  sizes: Readonly<Record<string, number>>,
  conf: string,
  apocrypha = 0,
): string {
  const root = join(dir, name);
  const data = join(root, "modules/texts/ztext", name);
  mkdirSync(data, { recursive: true });
  mkdirSync(join(root, "mods.d"), { recursive: true });
  for (const [testament, list] of [
    ["ot", books.slice(0, 39)],
    ["nt", books.slice(39)],
  ] as const) {
    const refs = slots(list, sizes);
    if (testament === "ot") for (let v = 1; v <= apocrypha; v++) refs.push(`Tob.1.${String(v)}`);
    const bzv = Buffer.alloc(refs.length * 10);
    let text = "";
    refs.forEach((ref, i) => {
      if (!ref) return;
      const osis = `<verse osisID="${ref}">Text of ${ref}<note>a note</note></verse>`;
      bzv.writeUInt32LE(0, i * 10);
      bzv.writeUInt32LE(Buffer.byteLength(text), i * 10 + 4);
      bzv.writeUInt16LE(Buffer.byteLength(osis), i * 10 + 8);
      text += osis;
    });
    const raw = Buffer.from(text);
    const packed = deflateSync(raw);
    const bzs = Buffer.alloc(12);
    bzs.writeUInt32LE(0, 0);
    bzs.writeUInt32LE(packed.length, 4);
    bzs.writeUInt32LE(raw.length, 8);
    writeFileSync(join(data, `${testament}.bzs`), bzs);
    writeFileSync(join(data, `${testament}.bzv`), bzv);
    writeFileSync(join(data, `${testament}.bzz`), packed);
  }
  writeFileSync(join(root, "mods.d", `${name}.conf`), `[${name}]\nModDrv=zText\n${conf}`);
  const zip = join(dir, `${name}.zip`);
  execFileSync("zip", ["-qr", zip, "mods.d", "modules"], { cwd: root });
  return zip;
}

describe("readSword", () => {
  it("reads a module in the KJV's grid, which a .conf without Versification means", () => {
    const zip = writeModule("kjv", KJV_SIZES, "");
    expect(swordVersification(zip)).toBe("KJV");
    const bible = readSword(zip, kjv);
    expect(bible.get("Gen.1.2")).toBe("Text of Gen.1.2");
    expect(bible.get("3John.1.14")).toBe("Text of 3John.1.14");
    expect(bible.has("3John.1.15")).toBe(false);
    expect(bible.size).toBe(kjv.size);
  });

  it("reads an NRSV module's longer 3 John 1 and Revelation 12, by its .conf", () => {
    const zip = writeModule("nrsv", NRSV_SIZES, "Versification=NRSV\n");
    expect(swordVersification(zip)).toBe("NRSV");
    const bible = readSword(zip, kjv);
    expect(bible.get("3John.1.15")).toBe("Text of 3John.1.15");
    expect(bible.get("Rev.12.18")).toBe("Text of Rev.12.18");
    expect(bible.get("Rev.13.1")).toBe("Text of Rev.13.1");
    // Read as a KJV module, its New Testament index would not fit.
    expect(() => readSword(zip, kjv, "KJV")).toThrow(/nt index does not fit the KJV/);
  });

  it("lets an NRSVA module's Old Testament run on into the Apocrypha", () => {
    const zip = writeModule("nrsva", NRSV_SIZES, "Versification=NRSVA\n", 5);
    expect(swordVersification(zip)).toBe("NRSVA");
    const bible = readSword(zip, kjv);
    expect(bible.get("Gen.1.1")).toBe("Text of Gen.1.1");
    expect(bible.get("Rev.12.18")).toBe("Text of Rev.12.18");
    expect(() => readSword(zip, kjv, "NRSV")).toThrow(/ot index does not fit the NRSV/);
  });

  it("reads a Calvin module (the Hungarian Károli) in the Geneva Bibles' grid", () => {
    // SWORD's canon_calvin.h: the psalms count their titles, a few chapters move a verse.
    expect(CALVIN["Ps.3"]).toBe(9);
    expect(CALVIN["Num.12"]).toBe(15);
    expect(CALVIN["Num.13"]).toBe(34);
    expect(CALVIN["Mark.9"]).toBe(51);
    expect(CALVIN["Rev.12"]).toBe(18);
    expect(CALVIN["John.3"]).toBeUndefined();
    expect(Object.keys(CALVIN)).toHaveLength(94);
    // Of the small KJV's books, Jonah has its chapters 1-2 a verse apart in the Calvin grid.
    const zip = writeModule(
      "calvin",
      { ...NRSV_SIZES, "Jonah.1": 16, "Jonah.2": 11 },
      "Versification=Calvin\n",
    );
    expect(swordVersification(zip)).toBe("Calvin");
    const bible = readSword(zip, kjv);
    expect(bible.get("3John.1.15")).toBe("Text of 3John.1.15");
    expect(bible.get("Rev.12.18")).toBe("Text of Rev.12.18");
    expect(bible.get("Jonah.1.16")).toBe("Text of Jonah.1.16");
    expect(bible.get("Jonah.2.11")).toBe("Text of Jonah.2.11");
    expect(() => readSword(zip, kjv, "NRSV")).toThrow(/ot index does not fit the NRSV/);
  });

  it("refuses a grid it cannot place verses in", () => {
    const zip = writeModule("vulg", KJV_SIZES, "Versification=Vulg\n");
    expect(() => swordVersification(zip)).toThrow(/Vulg/);
  });
});

describe("repair", () => {
  it("takes the Swedish module's footnotes out of its verses", () => {
    expect(repair("sv", "Och mannen gav sin hustru namnet Eva[1], ty hon blev en moder.")).toBe(
      "Och mannen gav sin hustru namnet Eva, ty hon blev en moder.",
    );
    expect(repair("sv", "och blygdes icke för varandra. [1] Hebr adám [2] Hebr. adamá")).toBe(
      "och blygdes icke för varandra.",
    );
    expect(repair("sv", "Herren Jesu nåd vare med alla. [1] Se A och O i Ordförkl.")).toBe(
      "Herren Jesu nåd vare med alla.",
    );
    // The brackets round Mark 16:9-20 and John 7:53-8:11, and a slot with a mark alone.
    expect(repair("sv", "[Men efter sin uppståndelse visade han sig")).toBe(
      "Men efter sin uppståndelse visade han sig",
    );
    expect(repair("sv", "Gå, och synda icke härefter.»][1]")).toBe("Gå, och synda icke härefter.»");
    expect(repair("sv", "[1]")).toBe("");
    expect(repair("sv", "Hans moder hette Sibja, från Beer-Seba. &gt;2 Krön 24,1 f.")).toBe(
      "Hans moder hette Sibja, från Beer-Seba.",
    );
  });

  it("takes the Danish brackets and the Norwegian note marks off the words", () => {
    expect(
      repair("da", "og den var Sky og Mørke [for hine], men oplyste Natten [for disse];"),
    ).toBe("og den var Sky og Mørke for hine, men oplyste Natten for disse;");
    expect(repair("da", "[Men Jesus gik til Oliebjerget.")).toBe("Men Jesus gik til Oliebjerget.");
    expect(repair("da", "som kaldes paa Hebraisk Harmagedon**.")).toBe(
      "som kaldes paa Hebraisk Harmagedon.",
    );
    expect(
      repair("nb", "som har skapt Bjørnen, Orion* og Syvstjernen* og Sydens stjernekammere,"),
    ).toBe("som har skapt Bjørnen, Orion og Syvstjernen og Sydens stjernekammere,");
    expect(repair("nb", "skal ikke bli lÃ¦gt. likesom Salman Ã¸dela")).toBe(
      "skal ikke bli lægt. likesom Salman ødela",
    );
  });

  it("takes the Finnish and Vietnamese verse numbers and the Turkish joins out", () => {
    expect(repair("fi", "{13:1} Sen jälkeen kansa lähti liikkeelle Haserotista")).toBe(
      "Sen jälkeen kansa lähti liikkeelle Haserotista",
    );
    expect(repair("fi", "niin että hän aikoi tuhota teidät. 9:")).toBe(
      "niin että hän aikoi tuhota teidät.",
    );
    expect(
      repair("fi", "päästä meidät pahasta, &lt;FO&gt;sillä sinun on valtakunta. Amen.&lt;Fo&gt;"),
    ).toBe("päästä meidät pahasta, sillä sinun on valtakunta. Amen.");
    expect(repair("vi", "(030-1) Môi-se nói cùng dân Y-sơ-ra-ên")).toBe(
      "Môi-se nói cùng dân Y-sơ-ra-ên",
    );
    expect(repair("vi", "đến đời đời. 20-43 Vậy, Đa-vít chổi dậy")).toBe(
      "đến đời đời. Vậy, Đa-vít chổi dậy",
    );
    expect(repair("tr", "-18 Tanrı, yeryüzüne ışık vermesi")).toBe("Tanrı, yeryüzüne ışık vermesi");
    expect(repair("vi", "(022:49) Giô-sa-phát")).toBe("Giô-sa-phát");
    expect(repair("vi", "Aáy chính Ngài, Bết-lê-hem Eùp-ra-ta, Aùp-ra-ham")).toBe(
      "Ấy chính Ngài, Bết-lê-hem Ép-ra-ta, Áp-ra-ham",
    );
    expect(repair("vi", "dấu lạ phép k” của ta; “Hãy đi”")).toBe("dấu lạ phép kỳ của ta; “Hãy đi”");
  });

  it("takes the Swahili ULB's notes and editors' marks out of its verses", () => {
    expect(
      repair(
        "sw",
        "Iweni macho. (Zingatia: Mstari huu, “Muwe waangalifu” haumo kwenye nakala za kale).",
      ),
    ).toBe("Iweni macho.");
    expect(
      repair("sw", "(Zingatia: Nakala za kale hazina Marko 16: 9-20) Mapema katika siku"),
    ).toBe("Mapema katika siku");
    expect(
      repair(
        "sw",
        "“Naye BWANA atawaondoa maadui wa Daudi.” (KISWAHILI IDIOM? ==== ULB ENGLISH IDIOM)",
      ),
    ).toBe("“Naye BWANA atawaondoa maadui wa Daudi.”");
    expect(
      repair(
        "sw",
        "Zingatia: Msatri huu, “Naya atakapokuja atasema nanyi,” haumo kwenye maandiko ya kale.",
      ),
    ).toBe("");
    expect(repair("sw", "madhabahu ya uvumba+ kutokana na mbao za mshita. + Mkono mmoja")).toBe(
      "madhabahu ya uvumba kutokana na mbao za mshita. Mkono mmoja",
    );
    expect(repair("sw", "umri wa miaka [thelathini] alipoanza")).toBe(
      "umri wa miaka thelathini alipoanza",
    );
    expect(repair("sw", "kuona katika jangwa __tete likitikiswa")).toBe(
      "kuona katika jangwa—tete likitikiswa",
    );
    // Words of the text itself in brackets stay, and so does a plain parenthesis.
    expect(repair("sw", "Barzilai {ambaye alipata mke}")).toBe("Barzilai ambaye alipata mke");
    expect(repair("sw", "Goligotha (maana ya tafsiri hii ni, Sehemu ya Fuvu la kichwa).")).toBe(
      "Goligotha (maana ya tafsiri hii ni, Sehemu ya Fuvu la kichwa).",
    );
  });

  it("mends Biblia 1914's transcription slips and keeps its 1914 spelling", () => {
    expect(
      repair("ro", "taurul cu pietre să se omoare, și stăpânul lui încă să moară. Fac. 9, 5."),
    ).toBe("taurul cu pietre să se omoare, și stăpânul lui încă să moară.");
    expect(repair("ro", "iar osebiți Domnului, șaptezeci și doi»")).toBe(
      "iar osebiți Domnului, șaptezeci și doi.",
    );
    expect(repair("ro", "aluatul Fariseilor și al Saducheiior.")).toBe(
      "aluatul Fariseilor și al Saducheilor.",
    );
    expect(repair("ro", "Și au zis Dumnezeu: să se facă lumină și s’a făcut lumină.")).toBe(
      "Și au zis Dumnezeu: să se facă lumină și s’a făcut lumină.",
    );
  });

  it("takes the Tsarigrad text's brackets and stray Latin letters out", () => {
    expect(repair("bg", "[ Проводи ] на онези които [ живееха ] във Ветил,")).toBe(
      "Проводи на онези които живееха във Ветил,",
    );
    expect(repair("bg", "свидетелствуват [на небеса, Отец, Слово и Дух Светий;")).toBe(
      "свидетелствуват на небеса, Отец, Слово и Дух Светий;",
    );
    expect(repair("bg", "Името ти е маст излeяна; в Tарсис, Дело на художник[D1] И")).toBe(
      "Името ти е маст излеяна; в Тарсис, Дело на художник И",
    );
    expect(repair("bg", "(4) Изпроважда заповедта си")).toBe("Изпроважда заповедта си");
    expect(repair("bg", "[ (По Слав.147) ] (1) Слави, Ерусалиме, Господа")).toBe(
      "Слави, Ерусалиме, Господа",
    );
    expect(repair("bg", "проводи царят волята си за това. Глава 6")).toBe(
      "проводи царят волята си за това.",
    );
    expect(repair("bg", "живееха там по- напред в Ен- гади")).toBe(
      "живееха там по-напред в Ен-гади",
    );
    expect(repair("bg", "и ковачите излsзоха от Ерусалим")).toBe("и ковачите излязоха от Ерусалим");
  });

  it("mends the Kralice code page and leaves the other editions alone", () => {
    expect(repair("cs", "Èlověk a Ïábel")).toBe("Člověk a Ďábel");
    expect(repair("en", "In the beginning [1]")).toBe("In the beginning [1]");
  });
});

describe("Biblia 1914 and the Tsarigrad Bible", () => {
  it("reads Biblia 1914's wikitext by its anchors, without its titles, notes and numbers", () => {
    const path = join(dir, "ro.json");
    const gen = [
      "==CAP. 1.==",
      "<center>''Facerea lumii.''</center>",
      '<span id="1.1"/>Întru început au făcut Dumnezeu cerul și pământul.',
      '<div style="text-align: right;">[[../Ioan#1.1|Ioan 1, 1, 2]].</div>',
      '<span id="1.2"/>2. Și pământul erà nevăzut și <i/>netocmit</i/>.',
      '<span id="1.3"/>3, Și au zis Dumnezeu: să se facă lumină.',
      "''Prologul nu este un verset.''",
    ].join("\n");
    writeFileSync(
      path,
      JSON.stringify({ Gen: gen, Ps: '<span id="118.1288"/>128. Pentru aceasta.' }),
    );
    expect([...readBiblia1914(path)]).toEqual([
      ["Gen.1.1", "Întru început au făcut Dumnezeu cerul și pământul."],
      ["Gen.1.2", "Și pământul erà nevăzut și netocmit."],
      ["Gen.1.3", "Și au zis Dumnezeu: să se facă lumină."],
      ["Ps.118.128", "Pentru aceasta."],
    ]);
  });

  it("reads the Tsarigrad text's books in the KJV's order, a psalm's title taken off", () => {
    const path = join(dir, "bg.txt");
    const lines = ["# Стария завет", ""];
    for (const [i, book] of books.entries()) {
      lines.push(`## ${book}`, "", book === "Ps" ? "### 23 Псалм" : "### 1 Глава");
      lines.push(
        book === "Ps"
          ? "1. [ (по Слав. 22) Псалом Давидов. ] Господ е Пастир мой:"
          : `1. Стих ${String(i)}.`,
      );
      lines.push("21", "");
    }
    writeFileSync(path, lines.join("\r\n"));
    const bible = readTsarigrad(path);
    expect(bible.get("Gen.1.1")).toBe("Стих 0.");
    expect(bible.get("Ps.23.1")).toBe("Господ е Пастир мой:");
    expect(bible.get("Rev.1.1")).toBe("Стих 65.");
    expect(bible.size).toBe(66);
    writeFileSync(path, lines.slice(0, 20).join("\n"));
    expect(() => readTsarigrad(path)).toThrow(/not 66/);
  });

  it("pairs verses one to one by their lengths, and not round a verse cut otherwise", () => {
    const a = [40, 120, 60, 90, 30, 150, 70, 100, 50, 80];
    expect(
      alignedByLength(
        a,
        a.map((n) => Math.round(n * 1.2)),
      ),
    ).toEqual(a.map(() => true));
    // The edition's verse 3 holds the KJV's 3 and 4, its 5 and 6 the KJV's 6: verses 3–6 are
    // off, and so are the verses next to them (2, 7), whose boundary is in doubt.
    const b = [48, 144, 180, 36, 90, 90, 84, 120, 60, 96];
    const ok = alignedByLength(a, b);
    expect(ok[0]).toBe(true);
    expect(ok.slice(1, 7).some(Boolean)).toBe(false);
    expect(ok.slice(7)).toEqual([true, true, true]);
  });

  it("places the Septuagint's chapters and psalms in the KJV's numbering where it can", () => {
    const lens = (n: number, at: number) =>
      Array.from({ length: n }, (_, i) => "x".repeat(30 + ((i * 37 + at) % 90)));
    const kjv = new Map<string, string>();
    const lxx = new Map<string, string>();
    const ru = new Map<string, string>();
    const fill = (m: Map<string, string>, ch: string, texts: string[]) => {
      for (const [i, t] of texts.entries()) m.set(`${ch}.${String(i + 1)}`, t);
    };
    // John 3 as it is; Jonah 1:17 is the Synodal (and the Septuagint's) 2:1.
    fill(kjv, "John.3", lens(12, 1));
    fill(lxx, "John.3", lens(12, 1));
    const jonah = lens(27, 5);
    fill(kjv, "Jonah.1", jonah.slice(0, 17));
    fill(kjv, "Jonah.2", jonah.slice(17));
    for (const m of [lxx, ru]) {
      fill(m, "Jonah.1", jonah.slice(0, 16));
      fill(m, "Jonah.2", jonah.slice(16));
    }
    // Ps 23 is the Septuagint's 22; Ps 24 its 23, divided otherwise (8 verses to 10): left out.
    fill(kjv, "Ps.23", lens(6, 2));
    fill(lxx, "Ps.22", lens(6, 2));
    fill(kjv, "Ps.24", lens(10, 3));
    fill(lxx, "Ps.23", lens(8, 3));
    const view = septuagintView(lxx, kjv, ru);
    expect(view.get("John.3.5")).toBe(lxx.get("John.3.5"));
    expect(view.get("Jonah.1.17")).toBe(lxx.get("Jonah.2.1"));
    expect(view.get("Jonah.2.10")).toBe(lxx.get("Jonah.2.11"));
    expect(view.get("Ps.23.1")).toBe(lxx.get("Ps.22.1"));
    expect([...view.keys()].some((k) => k.startsWith("Ps.24."))).toBe(false);
  });
});
