import { describe, expect, it } from "vitest";
import { formatRef } from "./scripture.ts";
import { toSynodal } from "./synodal.ts";
import { VERSES } from "./versification.ts";

// Each pair was read in the Synodal text (russyn USFM): the English verse on the left
// is the Synodal one on the right.
const SEAMS: readonly (readonly [string, number, number, number, number])[] = [
  ["Ps", 68, 15, 67, 16], // "Гора Божия — гора Васанская"
  ["Ps", 51, 1, 50, 3], // "Помилуй меня, Боже"
  ["Ps", 23, 1, 22, 1], // "Господь — Пастырь мой"
  ["Ps", 9, 1, 9, 2],
  ["Ps", 10, 1, 9, 22], // "Для чего, Господи, стоишь вдали"
  ["Ps", 115, 1, 113, 9], // "Не нам, Господи, не нам"
  ["Ps", 116, 9, 114, 9],
  ["Ps", 116, 10, 115, 1], // "Я веровал, и потому говорил"
  ["Ps", 147, 12, 147, 1], // "Хвали, Иерусалим, Господа"
  ["Ps", 150, 6, 150, 6],
  ["Num", 12, 16, 13, 1], // "народ двинулся из Асирофа"
  ["Num", 13, 1, 13, 2],
  ["Num", 29, 40, 30, 1],
  ["Josh", 6, 1, 5, 16], // "Иерихон заперся"
  ["Josh", 6, 20, 6, 19],
  ["Job", 41, 1, 40, 20], // "вытащить левиафана"
  ["Eccl", 5, 1, 4, 17],
  ["Song", 6, 13, 7, 1], // "Оглянись, Суламита"
  ["Dan", 4, 1, 3, 31],
  ["Hos", 13, 16, 14, 1],
  ["Jonah", 1, 17, 2, 1], // "большому киту"
  ["1Sam", 23, 29, 24, 1], // "жил в безопасных местах Ен-Гадди"
  ["1Sam", 24, 1, 24, 2],
  ["2Cor", 11, 33, 11, 32], // "в корзине был спущен"
  ["2Cor", 13, 14, 13, 13], // "Благодать Господа нашего"
  ["Acts", 19, 41, 19, 40], // "Сказав это, он распустил собрание"
];

describe("toSynodal", () => {
  it.each(SEAMS)("%s %i:%i is Synodal %i:%i", (book, c, v, sc, sv) => {
    expect(toSynodal(book, c, v)).toEqual({ chapter: sc, verse: sv });
  });

  it("leaves books with the same numbering alone", () => {
    expect(toSynodal("Gen", 12, 6)).toEqual({ chapter: 12, verse: 6 });
    expect(toSynodal("Acts", 19, 40)).toEqual({ chapter: 19, verse: 40 });
    expect(toSynodal("1Kgs", 6, 1)).toEqual({ chapter: 6, verse: 1 });
  });

  it("maps every verse of a shifted run inside the Synodal chapters", () => {
    for (const [book, first, lengths] of [
      ["Num", 12, [15, 34]],
      ["Job", 39, [35, 27, 26]],
      ["Jonah", 1, [16, 11]],
    ] as const) {
      for (let c = first; c < first + lengths.length; c++) {
        for (let v = 1; v <= (VERSES[book]?.[c - 1] ?? 0); v++) {
          const s = toSynodal(book, c, v);
          expect(s.verse).toBeGreaterThan(0);
          expect(s.verse).toBeLessThanOrEqual(lengths[s.chapter - first] ?? 0);
        }
      }
    }
  });

  it("numbers every psalm verse within 1-151 chapters and forward", () => {
    let last = { chapter: 0, verse: 0 };
    for (let c = 1; c <= 150; c++) {
      for (let v = 1; v <= (VERSES.Ps?.[c - 1] ?? 0); v++) {
        const s = toSynodal("Ps", c, v);
        const after =
          s.chapter > last.chapter || (s.chapter === last.chapter && (s.verse ?? 0) > last.verse);
        expect(after).toBe(true);
        last = { chapter: s.chapter, verse: s.verse ?? 0 };
      }
    }
  });
});

describe("formatRef in Russian", () => {
  it("shows the Synodal numbers, the English ones in English", () => {
    expect(formatRef("Ps.68.15", "ru")).toBe("Пс 67:16");
    expect(formatRef("Ps.68.15", "en")).toBe("Ps 68:15");
    expect(formatRef("Num.13.26-Num.14.34", "ru")).toBe("Чис 13:27–14:34");
    expect(formatRef("Josh.6.1-Josh.6.20", "ru")).toBe("Нав 5:16–6:19");
    expect(formatRef("Jonah.1.17-Jonah.2.2", "ru")).toBe("Ион 2:1–3");
  });
});
