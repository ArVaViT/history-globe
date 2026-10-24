import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { OSIS, readSword, repair, swordVersification } from "./bible-text.ts";

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

  it("mends the Kralice code page and leaves the other editions alone", () => {
    expect(repair("cs", "Èlověk a Ïábel")).toBe("Člověk a Ďábel");
    expect(repair("en", "In the beginning [1]")).toBe("In the beginning [1]");
  });
});
