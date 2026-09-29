import { describe, expect, it } from "vitest";
import { formatRef, NT_BOOKS } from "./scripture.ts";

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
    expect(() => formatRef(osis, "en")).toThrow(SyntaxError);
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
