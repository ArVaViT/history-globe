import { describe, expect, it } from "vitest";
import { checkRef } from "./verses.ts";
import {
  canonicalPosition,
  formatRef,
  isDeuterocanon,
  NT_BOOKS,
  parseChapter,
  refCovers,
} from "./scripture.ts";

describe("formatRef", () => {
  it.each([
    ["Acts.13.4", "ru", "Деян 13:4"],
    ["Acts.13.4", "en", "Acts 13:4"],
    ["1Kgs.6.1", "ru", "3 Цар 6:1"],
    ["2Sam.5.6-2Sam.5.9", "ru", "2 Цар 5:6–9"],
    ["Acts.13.4-Acts.14.26", "ru", "Деян 13:4–14:26"],
    ["Luke.7", "ru", "Лк 7"],
  ] as const)("%s (%s) → %s", (osis, locale, text) => {
    expect(formatRef(osis, locale)).toBe(text);
  });

  it("rejects unknown books and cross-book ranges", () => {
    expect(() => formatRef("Enoch.1.1", "ru")).toThrow(SyntaxError);
    expect(() => formatRef("Matt.1.1-Mark.1.1", "ru")).toThrow(SyntaxError);
  });

  it.each([
    "Acts.x",
    "Acts.",
    "Acts.0.1",
    "Acts.13.0",
    "Acts.0.99999",
    "Acts.13.4.9",
    "Acts.13.4-Acts.13.2",
    "Acts.13.4-Acts.13.4",
    "Acts.13.4-Acts.13",
    "Acts.13-Acts.13.9",
    "Acts.13.1-Acts.13.2-Acts.13.3",
    "acts.13.4",
    "Acts.29.1",
    "Acts.28.32",
    "Jude.2.1",
    "Rom.14.24",
  ])("rejects %s", (osis) => {
    expect(() => {
      checkRef(osis);
    }).toThrow(SyntaxError);
  });

  it("accepts the last verse of a book", () => {
    expect(formatRef("Acts.28.31", "en")).toBe("Acts 28:31");
    expect(formatRef("Ps.119.176", "en")).toBe("Ps 119:176");
    // The English numbering keeps the doxology of Romans at 16:25-27.
    expect(formatRef("Rom.16.27", "en")).toBe("Rom 16:27");
  });

  it("accepts whole-chapter ranges", () => {
    expect(formatRef("Acts.13-Acts.14", "en")).toBe("Acts 13–14");
  });

  it("knows all 27 New Testament books", () => {
    expect(NT_BOOKS.size).toBe(27);
  });
});

describe("refCovers", () => {
  const caesarea = new Set(["Acts.21.8", "Acts.25.13", "Acts.25.24"]);

  it("finds a tagged verse inside a range, within or across chapters", () => {
    expect(refCovers("Acts.21.8-Acts.21.14", caesarea)).toBe(true);
    expect(refCovers("Acts.24.1-Acts.25.13", caesarea)).toBe(true);
    expect(refCovers("Acts.25.24", caesarea)).toBe(true);
  });

  it("finds nothing outside the range or in another book", () => {
    expect(refCovers("Acts.27.1-Acts.27.2", caesarea)).toBe(false);
    expect(refCovers("Rom.25.13", caesarea)).toBe(false);
  });

  it("reads a whole-chapter end as the end of that chapter", () => {
    expect(refCovers("Acts.25", caesarea)).toBe(true);
    expect(refCovers("Acts.24-Acts.25", caesarea)).toBe(true);
  });
});

describe("canonicalPosition", () => {
  it("orders references as the Bible does, by book, chapter and verse", () => {
    const refs = ["Judg.18.1-Judg.18.2", "Judg.3.12", "Ruth.1.1", "Judg.4.4-Judg.4.5", "Gen.12.1"];
    expect([...refs].sort((a, b) => canonicalPosition(a) - canonicalPosition(b))).toEqual([
      "Gen.12.1",
      "Judg.3.12",
      "Judg.4.4-Judg.4.5",
      "Judg.18.1-Judg.18.2",
      "Ruth.1.1",
    ]);
  });
});

describe("parseChapter", () => {
  it("reads Russian and English book names, abbreviations and the Gospels' genitive", () => {
    expect(parseChapter("Деян 16", "ru")).toEqual({ ref: "Acts.16", label: "Деян 16" });
    expect(parseChapter("деяния 16", "ru")?.ref).toBe("Acts.16");
    expect(parseChapter("1 Цар 17", "ru")?.ref).toBe("1Sam.17");
    expect(parseChapter("3 Цар. 18", "ru")?.ref).toBe("1Kgs.18");
    expect(parseChapter("Иоанн 4", "ru")?.ref).toBe("John.4");
    expect(parseChapter("от Иоанна 3", "ru")?.ref).toBe("John.3");
    expect(parseChapter("Матфея 5", "ru")?.ref).toBe("Matt.5");
    expect(parseChapter("Луки 2", "ru")?.ref).toBe("Luke.2");
    // Synodal Josh 6 starts at English 6:2 (Josh 6:1 is Synodal 5:16).
    expect(parseChapter("Иисус Навин 6", "ru")?.ref).toBe("Josh.6.2-Josh.6.27");
    expect(parseChapter("Acts 16", "en")).toEqual({ ref: "Acts.16", label: "Acts 16" });
    expect(parseChapter("1 Sam 17", "en")?.ref).toBe("1Sam.17");
    expect(parseChapter("Acts 29", "en")).toBeNull();
  });

  it("maps a Synodal psalm to the English verses it holds", () => {
    expect(parseChapter("Пс 22", "ru")?.ref).toBe("Ps.23");
    // Synodal 9 = English 9 and 10; 114 and 115 are halves of English 116; 146 and 147
    // are halves of English 147.
    expect(parseChapter("Пс 9", "ru")?.ref).toBe("Ps.9-Ps.10");
    expect(parseChapter("Пс 114", "ru")?.ref).toBe("Ps.116.1-Ps.116.9");
    expect(parseChapter("Пс 115", "ru")?.ref).toBe("Ps.116.10-Ps.116.19");
    expect(parseChapter("Пс 147", "ru")?.ref).toBe("Ps.147.12-Ps.147.20");
  });
});

describe("parseChapter: a whole book", () => {
  it("takes a book typed exactly, not the start of a place's name", () => {
    expect(parseChapter("Деян", "ru")).toEqual({ ref: "Acts", label: "Деян" });
    expect(parseChapter("Acts", "en")).toEqual({ ref: "Acts", label: "Acts" });
    expect(parseChapter("Иерусалим", "ru")).toBeNull();
  });
});

describe("books outside the Hebrew canon", () => {
  it("are cited with a note that says so, in both languages", () => {
    expect(formatRef("1Macc.4.36-1Macc.4.59", "ru")).toBe("1 Мак 4:36–59 (неканоническая книга)");
    expect(formatRef("2Macc.4.7", "en")).toBe("2 Macc 4:7 (deuterocanonical)");
    expect(formatRef("Gen.12.6", "ru")).toBe("Быт 12:6");
  });

  it("check their verses as the others: 1 Maccabees has 16 chapters", () => {
    expect(() => formatRef("1Macc.16.24", "en")).not.toThrow();
    expect(isDeuterocanon("1Macc.16.24")).toBe(true);
    expect(isDeuterocanon("Mal.4.6")).toBe(false);
  });
});

describe("parseChapter with an English book name in Russian", () => {
  it("counts the chapter the English way and labels it the Synodal way", () => {
    expect(parseChapter("Psalm 23", "ru")).toEqual({ ref: "Ps.23", label: "Пс 22" });
    expect(parseChapter("Psalms 23:1", "ru")?.ref).toBe("Ps.23");
    expect(parseChapter("Пс 23", "ru")?.label).toBe("Пс 23");
  });
});
